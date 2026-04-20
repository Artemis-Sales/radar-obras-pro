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

// Pega a data exata de 14 dias atrás
const hoje = new Date();
const duasSemanasAtras = new Date();
duasSemanasAtras.setDate(hoje.getDate() - 14);
const cutoffStr = duasSemanasAtras.toISOString().split('T')[0];

const URL_ORIGEM = 'https://www.doe.sp.gov.br/busca-avancada';
const TERMO_BUSCA = 'GRAPROHAB';

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = `
  Você é um extrator de dados de mineração especialista no Diário Oficial do Estado de São Paulo (DOE-SP), focado na Secretaria da Habitação e aprovações urbanísticas de GRAPROHAB, loteamentos e condomínios.
  A data limite mais antiga que nos interessa é: ${cutoffStr} (14 dias atrás).
  Avalie o texto da publicação. Se for anterior a esta data, IGNORAR (restornar nulo).
  Se houver empreendimentos válidos, extraia as informações ESTRITAMENTE pro formato JSON. NÃO INVENTE DADOS.
  NÃO retorne nomes como 'Vila Nova', 'Jardim das Flores' a menos que EXATAMENTE escritos no texto.
  
  Retorne um ARRAY DE JSON puramente texto (sem crases tipo \`\`\`json):
  [
    {
      "obra": "Nome do empreendimento, loteamento ou produto real mencionado no texto.",
      "construtora": "A empresa construtora, incorporadora ou interessado.",
      "cidade": "Nome limpo do município.",
      "endereco_aproximado": "Localização, estrada ou bairro informada.",
      "estagio": "Neste contexto de GRAPROHAB, retorne sempre 'Em Negociação', exceto se explícito sobre paralisação."
    }
  ]

  TEXTO BRUTO DA PUBLICAÇÃO DO DOE-SP:
  "${rawText}"
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (text.toLowerCase() === 'null' || text === '') return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error('Falha de conexão com a IA Gemini:', error);
    return null;
  }
}

async function runDoeScraper() {
  console.log('🚀 Iniciando Puppeteer (DOE-SP GRAPROHAB - Últimos 14 dias)...');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'User-Agent': 'Mozilla/5.0'
  });

  console.log(`🌐 Acessando a Busca do DOE-SP: ${URL_ORIGEM}`);
  
  try {
    await page.goto(URL_ORIGEM, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch(e) {
    console.log(`Falha no timeout do Chrome: ${e.message}`);
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const closeBtn = await page.$('button[aria-label="close"], button[aria-label="fechar"]');
    if (closeBtn) {
      await closeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (_) { }

  console.log(`🔍 Buscando: "${TERMO_BUSCA}"...`);
  try {
    const termInput = await page.waitForSelector('input[placeholder*="termo"], input[type="text"]', { timeout: 10000 });
    await termInput.click({ clickCount: 3 });
    await termInput.type(TERMO_BUSCA, { delay: 50 });
  } catch(e) {}

  try {
    const dateDropdown = await page.$('div[aria-label*="data"], .MuiSelect-select');
    if (dateDropdown) {
      await dateDropdown.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const options = await page.$$('li[role="option"]');
      for (const opt of options) {
        const txt = await opt.evaluate(el => el.textContent.trim());
        if (txt.toLowerCase().includes('mês')) {
           await opt.click();
           break;
        }
      }
    }
  } catch (_) { }

  console.log('🔎 Acionando Busca Avançada...');
  try {
    const searchBtn = await page.$('button[type="submit"], button:has(svg[data-testid="SearchIcon"])');
    if (searchBtn) await searchBtn.click();
  } catch(e) {}

  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('📝 Lendo extrato de despachos no SPA React...');
  const rawExtractedContent = await page.evaluate(() => {
    let textos = [];
    const elements = document.querySelectorAll('article, .resultado, h6, p.MuiTypography-body1');
    elements.forEach(el => {
      const t = el.innerText?.trim();
      if (t && t.length > 20) textos.push(t);
    });
    return textos.slice(0, 15).map(t => t.substring(0, 800)).join('\\n---\\n');
  });

  if (!rawExtractedContent || rawExtractedContent.trim().length < 50) {
    console.warn('⚠️ O site do DOE-SP não carregou blocos de publicações pesquisáveis no momento.');
    await browser.close();
    return;
  }

  console.log('\n🧠 Acionando a IA para estruturar (Limite 14 dias atrás)...');
  const leadsArray = await extractWithGemini(rawExtractedContent);
  
  if (leadsArray && leadsArray.length > 0) {
    console.log(`\n🟢 FORAM COMPILADOS ${leadsArray.length} PROCESSO(S). Verificando redundância...`);
    
    const leadsRef = db.collection('leads');

    for (const leadData of leadsArray) {
       if(!leadData.obra || !leadData.construtora) continue;

       const snapshot = await leadsRef
         .where('obra', '==', leadData.obra)
         .where('construtora', '==', leadData.construtora)
         .get();
       
       if (!snapshot.empty) {
         console.log(`⚠️ ALERTA DE REPETIÇÃO: [${leadData.obra}] já foi detectado anteriormente.`);
       } else {
         console.log(`✅ [${leadData.obra}] É UM LEAD EXCLUSIVO! Adicionando...`);
         const localStr = buildAddressString(leadData);
         const coordenadas = await geocodeAddress(localStr, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

         await leadsRef.add({
           ...leadData,
           lat: coordenadas ? coordenadas.lat : null,
           lng: coordenadas ? coordenadas.lng : null,
           fonteOriginal: 'Diário Oficial SP (GRAPROHAB)',
           urlOrigem: URL_ORIGEM,
           createdAt: admin.firestore.FieldValue.serverTimestamp(),
           criadoEm: admin.firestore.FieldValue.serverTimestamp()
         });
         console.log('🎉 INCLUSÃO FEITA COM SUCESSO E COORDENADAS GRAVADAS.');
       }
    }
  } else {
    console.log('ℹ️ Nenhuma nova licença relevante nesses últimos dias.');
  }
  
  await browser.close();
  console.log('\n🛑 Execução DOE Finalizada.');
}

runDoeScraper();
