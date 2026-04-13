import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { geocodeAddress, buildAddressString } from './geocode.mjs';

// Carrega as chaves do .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Firebase Admin initialization para salvar no Firestore (Produção via GitHub Actions)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// URL real: Diário Oficial da Cidade de SP — busca por alvarás SMUL
// O portal do Diário Oficial da Cidade usa o mesmo domínio do estado (doe.sp.gov.br)
// com caderno específico da Prefeitura (Município)
const URL_ORIGEM = 'https://www.doe.sp.gov.br/busca-avancada';
const TERMO_BUSCA = 'Alvará Aprovação Execução Edificação SMUL';

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  Você é um extrator de dados de mineração (Data Mining) especialista no Diário Oficial da Cidade de São Paulo e GeoSampa, buscando 'Alvará de Aprovação e Execução de Edificação Nova'.
  Sua tarefa é fatiar o texto bruto da publicação do Alvará e extrair as propriedades exatas num objeto JSON limpo e formatado.
  NÃO use formatação markdown (\`\`\`json), DEVOLVA APENAS o HASH DO JSON.
  Se o texto não contiver dados de obras ou alvarás relevantes, retorne null.
  
  Preencha estritamente seguindo o contrato:
  {
    "obra": "Nome da obra, do edifício ou Condomínio. Ex: 'Condomínio Residencial Vertical Vila Nova'. Extraia apenas o nome forte.",
    "construtora": "A empresa construtora, engenharia, proprietário ou declarante do projeto.",
    "cidade": "Sempre 'São Paulo' para este contexto, mas confirme no texto.",
    "endereco_aproximado": "Local do imóvel aprovado (Rua, avenida, lote).",
    "estagio": "Neste contexto documental de aprovação de planta final, retorne OBRIGATORIAMENTE a string 'Alvará Aprovado'."
  }

  PEDAÇO BRUTO EXTRAÍDO DA PUBLICAÇÃO:
  "${rawText}"
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (text.toLowerCase() === 'null' || text === '') return null;
    return JSON.parse(text);
  } catch (err) {
    console.error('Gemini API Error:', err);
    return null;
  }
}

async function runMunicipalScraper() {
  console.log('🚀 Iniciando Robô de Mineração focado no Diário Oficial Municipal (Prefeitura SP)...');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  
  console.log(`🌐 Acionando motor headless nos cadernos da SMUL / COMIN: ${URL_ORIGEM}`);
  await page.goto(URL_ORIGEM, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fecha modal de boas-vindas, se existir
  try {
    const closeBtn = await page.$('button[aria-label="close"], button[aria-label="fechar"], .MuiModal-root button:first-child');
    if (closeBtn) {
      await closeBtn.click();
      console.log('ℹ️ Modal de boas-vindas fechado.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (_) { /* modal não existe */ }

  // Digita o termo de busca
  console.log(`🔍 Digitando termo de busca: "${TERMO_BUSCA}"...`);
  const termInput = await page.waitForSelector('input[type="text"], input[placeholder*="termo"], input[placeholder*="busca"], input[placeholder*="Buscar"]', { timeout: 15000 });
  await termInput.click({ clickCount: 3 });
  await termInput.type(TERMO_BUSCA, { delay: 80 });

  // Seleciona caderno Município (Prefeitura) se disponível
  try {
    // Tenta filtrar pelo caderno "Município" para focar no Diário Oficial da Cidade
    const cadernos = await page.$$('label, .MuiFormControlLabel-root, [class*="caderno"], [class*="opcao"]');
    for (const c of cadernos) {
      const txt = await c.evaluate(el => el.textContent?.toLowerCase() || '');
      if (txt.includes('município') || txt.includes('municipio') || txt.includes('prefeitura')) {
        await c.click();
        console.log('📋 Caderno "Município" selecionado.');
        break;
      }
    }
  } catch (_) {
    console.log('ℹ️ Filtro de caderno não localizado.');
  }

  // Seleciona período "Mês"
  try {
    const dateDropdown = await page.$('div[aria-label*="data"], div[aria-label*="Data"], .MuiSelect-select');
    if (dateDropdown) {
      await dateDropdown.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const options = await page.$$('li[role="option"], .MuiMenuItem-root');
      for (const opt of options) {
        const txt = await opt.evaluate(el => el.textContent.trim());
        if (txt.toLowerCase().includes('mês') || txt.toLowerCase().includes('mes')) {
          await opt.click();
          console.log('📅 Período "Mês" selecionado.');
          break;
        }
      }
    }
  } catch (_) {
    console.log('ℹ️ Selector de período não localizado.');
  }

  // Submete a busca
  console.log('🔎 Executando pesquisa...');
  const searchBtn = await page.$('button[type="submit"], button:has(svg[data-testid="SearchIcon"])');
  if (searchBtn) {
    await searchBtn.click();
  } else {
    await termInput.press('Enter');
  }

  // Aguarda resultado da SPA carregar
  console.log('⏳ Aguardando resultados (SPA React)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Extrai o texto real dos resultados
  console.log('📝 Extraindo publicação oficial da SMUL...');
  const rawExtractedContent = await page.evaluate(() => {
    document.querySelectorAll('script, style').forEach(el => el.remove());
    
    const selectors = [
      'article', '.resultado', '.result-item', '.MuiCard-root',
      'h6', '.MuiTypography-h6', 'p.MuiTypography-body1',
      '[class*="result"]', '[class*="publicacao"]'
    ];
    
    let textos = [];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        els.forEach(el => {
          const t = el.innerText?.trim();
          if (t && t.length > 30) textos.push(t);
        });
      }
    }

    if (textos.length === 0) {
      const main = document.querySelector('main, #root, .App, [role="main"]');
      if (main) textos.push(main.innerText.substring(0, 8000));
    }

    return textos.slice(0, 20).join('\n---\n');
  });

  console.log(`📄 Publicação oficial interceptada (${rawExtractedContent.length} chars). Amostra: ${rawExtractedContent.substring(0, 200)}...`);

  if (!rawExtractedContent || rawExtractedContent.trim().length < 50) {
    console.warn('⚠️ Conteúdo insuficiente. O site pode ter bloqueado o acesso ou a estrutura mudou.');
    await browser.close();
    return;
  }

  console.log('\n🧠 Analisando com Google Gemini para estruturação de dados...');
  const leadData = await extractWithGemini(rawExtractedContent);
  
  if (leadData) {
    console.log('\n🟢 EXTRAÇÃO CONCLUÍDA: Lead estruturado com sucesso.');
    console.log(JSON.stringify(leadData, null, 2));

    console.log('\n💾 Sincronizando com o Cloud Firestore...');
    const leadsRef = db.collection('leads');
    
    // Filtro Anti-Duplicação
    console.log(`🔍 Verificando duplicidade para a obra: "${leadData.obra}"...`);
    const snapshot = await leadsRef.where('obra', '==', leadData.obra).get();
    
    if (!snapshot.empty) {
      console.log('⚠️ CONFLITO: Este alvará já consta na base de dados.');
    } else {
      console.log('✅ Lead novo detectado! Geocodificando localização...');
      const enderecoCompleto = buildAddressString(leadData);
      const coordenadas = await geocodeAddress(enderecoCompleto, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

      console.log('💾 Concluindo inserção...');
      await leadsRef.add({
        ...leadData,
        lat: coordenadas ? coordenadas.lat : null,
        lng: coordenadas ? coordenadas.lng : null,
        fonteOriginal: 'Diário Oficial de SP (Alvará Aprovado)',
        urlOrigem: URL_ORIGEM,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: rawExtractedContent.substring(0, 5000),
      });
      console.log('🎉 SUCESSO: Oportunidade adicionada ao Dashboard com coordenadas precisas.');
    }
  } else {
    console.log('ℹ️ Nenhum lead relevante de Alvará identificado pelo Gemini nesta extração.');
  }
  
  await browser.close();
  console.log('\n✅ Crawler Municipal finalizado.');
}

runMunicipalScraper();
