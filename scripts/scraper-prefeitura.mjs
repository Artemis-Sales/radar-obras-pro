import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { geocodeAddress, buildAddressString } from './geocode.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    credential = admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });
  }
  admin.initializeApp({ credential });
}
const db = admin.firestore();

// Calcula a janela das últimas duas semanas
const hoje = new Date();
const duasSemanas = new Date();
duasSemanas.setDate(hoje.getDate() - 14);
const limitData = duasSemanas.toISOString().split('T')[0];

const URL_ORIGEM = 'https://www.doe.sp.gov.br/busca-avancada';
const TERMO_BUSCA = 'Alvará Aprovação Execução Edificação SMUL';

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  Você é um especialista em análise do Diário Oficial de São Paulo.
  Busque APENAS ocorrências de Alvarás de Aprovação e Execução para EDIFICAÇÕES NOVAS.
  Data da pesquisa limite: ${limitData}. IGNORE QUALQUER ocorrência que for de uma data mais antiga que isso.
  DEVOLVA PURAMENTE um array de instâncias de JSON, sem escapes com crase. NÃO INVENTE DADOS de forma alguma.
  Não crie projetos fakes, leia APENAS o que consta no texto bruto fornecido abaixo. Se não houver nenhum novo Alvará, retorne \`null\`.
  
  Padrão exigido do JSON:
  [
    {
      "obra": "Nome real extraído do texto. Nunca crie nomes genéricos.",
      "construtora": "Obrigatório construtora, engenharia, proprietário ou declarante do projeto real.",
      "cidade": "Sempre 'São Paulo' para SMUL, mas extraia.",
      "endereco_aproximado": "Local do imóvel real aprovado.",
      "estagio": "Neste caderno retorna sempre 'Alvará Aprovado'."
    }
  ]

  TEXTO BRUTO DE ALVARÁS (Últimos 14 dias):
  "${rawText}"
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (text.toLowerCase() === 'null' || text === '') return null;
    const p = JSON.parse(text);
    return Array.isArray(p) ? p : [p];
  } catch (err) {
    console.error('Gemini API falhou:', err);
    return null;
  }
}

async function runMunicipalScraper() {
  console.log('🚀 Iniciando Crawler Municipal da Prefeitura SP via DOE (Últimas 2 Semanas)...');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  console.log(`🌐 Navegando a ${URL_ORIGEM}`);
  try {
    await page.goto(URL_ORIGEM, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {}
  
  await new Promise(r => setTimeout(r, 3000));

  try {
    const closeBtn = await page.$('button[aria-label="close"]');
    if (closeBtn) await closeBtn.click();
  } catch (_) { }

  console.log(`🔍 Pesquisando termo rigoroso: "${TERMO_BUSCA}"`);
  try {
    const termInput = await page.waitForSelector('input[type="text"]', { timeout: 15000 });
    await termInput.click({ clickCount: 3 });
    await termInput.type(TERMO_BUSCA, { delay: 50 });
  } catch(e) {}

  // Como é pra 14 dias, selecionar Mês vai envolver, e o LLM elimina o resto
  try {
    const dateDrop = await page.$('.MuiSelect-select');
    if (dateDrop) {
      await dateDrop.click();
      await new Promise(r => setTimeout(r, 1000));
      const opts = await page.$$('li[role="option"]');
      for (const o of opts) {
        const txt = await o.evaluate(e => e.textContent.trim());
        if (txt.toLowerCase().includes('mês') || txt.toLowerCase().includes('mes')) {
           await o.click(); break;
        }
      }
    }
  } catch (_) { }

  try {
    const searchBtn = await page.$('button[type="submit"]');
    if (searchBtn) await searchBtn.click();
  } catch(e) {}

  await new Promise(r => setTimeout(r, 5000));

  const rawExtractedContent = await page.evaluate(() => {
    let textos = [];
    document.querySelectorAll('article, p.MuiTypography-body1').forEach(el => {
      const t = el.innerText?.trim();
      if (t && t.length > 20) textos.push(t);
    });
    return textos.slice(0, 30).join('\\n---\\n');
  });

  if (!rawExtractedContent || rawExtractedContent.trim().length < 50) {
    console.warn('⚠️ Nenhum trecho extraído, prefeitura sem expediente neste momento ou layout do site diferente.');
    await browser.close();
    return;
  }

  console.log('\n🧠 Pedindo Processamento ao Modelo para Identificação Exata...');
  const leadsArray = await extractWithGemini(rawExtractedContent);
  
  if (leadsArray && leadsArray.length > 0) {
    console.log(`\n🟢 Foram validados ${leadsArray.length} alvará(s) real(is)! Acionando Anti-Duplicação...`);
    const leadsRef = db.collection('leads');

    for (const lead of leadsArray) {
       if(!lead.obra || !lead.construtora) continue;

       const snap = await leadsRef
         .where('obra', '==', lead.obra)
         .where('construtora', '==', lead.construtora)
         .get();
       
       if (!snap.empty) {
         console.log(`⚠️ ALERTA GESTÃO: Negócio "${lead.obra}" foi descartado pois a inteligência já catalogou antes.`);
       } else {
         console.log(`✅ EXCEPCIONAL ALVARÁ! Registrando o novo "${lead.obra}"...`);
         const endAprox = buildAddressString(lead);
         const coord = await geocodeAddress(endAprox, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

         await leadsRef.add({
           ...lead,
           lat: coord ? coord.lat : null,
           lng: coord ? coord.lng : null,
           fonteOriginal: 'Diário Oficial de SP (Alvará Aprovado)',
           urlOrigem: URL_ORIGEM,
           createdAt: admin.firestore.FieldValue.serverTimestamp(),
           criadoEm: admin.firestore.FieldValue.serverTimestamp()
         });
         console.log(`🎉 Gravado com Sucesso.`);
       }
    }
  } else {
    console.log('ℹ️ Sem alvarás emitidos dentro dessa janela de corte limpa.');
  }
  
  await browser.close();
  console.log('\n✅ Fim da raspagem municipal.');
}

runMunicipalScraper();
