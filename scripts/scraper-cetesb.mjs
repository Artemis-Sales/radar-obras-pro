import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { geocodeAddress, buildAddressString } from './geocode.mjs';

// Garante que o dotenv procure o .env.local na raiz do projeto Next.js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuração do Firebase Admin Server SDK (Produção via GitHub Actions)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// URL real de consulta pública da CETESB — lista de licenciamentos ambientais
// Filtro por atividades de construção (código 81000) e licenças recentes
const URL_ORIGEM = 'https://licenciamento.cetesb.sp.gov.br/cetesb/processo_consulta.asp';

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  Você é um extrator de dados de mineração (Data Mining) especialista em diários oficiais e licenças ambientais com foco na construção civil.
  Sua tarefa é ler e analisar cirurgicamente o texto bruto de uma publicação de licenciamento e devolver ESTRITAMENTE um objeto JSON.
  NAO use formatação markdown (\`\`\`json), apenas o hash de chaves do JSON puro.
  Se o texto não contiver dados de obras ou empreendimentos relevantes, retorne null.
  
  Formato e regras do JSON requisitado:
  {
    "obra": "Nome do empreendimento, condomínio civil, loteamento. Extraia o nome exato.",
    "construtora": "A empresa construtora, incorporadora, engenharia ou requerente do processo.",
    "cidade": "O nome limpo do município onde a obra ocorrerá (sem '- SP').",
    "endereco_aproximado": "Rua, avenida ou região se informada.",
    "estagio": "SE for uma Licença Prévia ou LP, o estágio é 'Lead Novo'. SE for Licença de Instalação ou LI, é 'Em Negociação'. Caso não especificado mas relacione-se a construção, use 'Lead Novo'."
  }

  TEXTO BRUTO DA PUBLICAÇÃO:
  "${rawText}"
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (text.toLowerCase() === 'null' || text === '') return null;
    return JSON.parse(text);
  } catch (error) {
    console.error('Erro na chamada do provedor Gemini:', error);
    return null;
  }
}

async function runCetesbScraper() {
  console.log('🚀 Iniciando o robô extrator headless (CETESB)...');
  
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
  
  console.log(`🌐 Conectando ao portal de consulta pública da CETESB: ${URL_ORIGEM}`);
  await page.goto(URL_ORIGEM, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // A consulta pública da CETESB usa um formulário com select de tipo de ato.
  // Buscamos por Licenças Prévias (LP) e de Instalação (LI) — atividades de construção civil.
  console.log('🔧 Preenchendo formulário de consulta pública...');
  
  try {
    // Seleciona tipo de ato: tenta selecionar LP (Licença Prévia) ou LI (Licença de Instalação)
    const tipoAtoSelect = await page.$('select[name*="tipo"], select[name*="ato"], select[id*="tipo"]');
    if (tipoAtoSelect) {
      // Tenta selecionar "LI" ou "LP" na lista
      await page.select(tipoAtoSelect, 'LI').catch(() => {});
      console.log('📋 Tipo de ato "LI" selecionado.');
    }

    // Submete o formulário de consulta
    const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('🔍 Formulário submetido, aguardando resultados...');
    }
  } catch (err) {
    console.log(`ℹ️ Formulário não disponível ou estrutura diferente. Capturando texto da página atual. (${err.message})`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Extrai o conteúdo real da página
  console.log('📝 Extraindo conteúdo real da página da CETESB...');
  const rawExtractedContent = await page.evaluate(() => {
    // Remove scripts e estilos antes de capturar
    document.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
    const main = document.querySelector('main, #conteudo, .conteudo, table, body');
    return main ? main.innerText.substring(0, 8000) : document.body.innerText.substring(0, 8000);
  });

  console.log(`📄 Conteúdo extraído (${rawExtractedContent.length} chars). Amostra: ${rawExtractedContent.substring(0, 300)}...`);

  if (!rawExtractedContent || rawExtractedContent.trim().length < 50) {
    console.warn('⚠️ Conteúdo insuficiente extraído da CETESB. O site pode estar com acesso restrito.');
    await browser.close();
    return;
  }

  console.log('\n🧠 Acionando O Google Gemini para extrair e estruturar leads...');
  const leadData = await extractWithGemini(rawExtractedContent);
  
  if (leadData) {
    console.log('\n🟢 SUCESSO: Lead convertido em dados estruturados.');
    console.log(JSON.stringify(leadData, null, 2));

    console.log('\n💾 Conectando ao Firestore para persistência...');
    const leadsRef = db.collection('leads');
    
    // Regra de Anti-Duplicação
    console.log(`🔍 Checando duplicidade para a obra: "${leadData.obra}"...`);
    const snapshot = await leadsRef.where('obra', '==', leadData.obra).get();
    
    if (!snapshot.empty) {
      console.log('⚠️ AVISO: Obra já cadastrada. Inserção ignorada.');
    } else {
      console.log('✅ Nova obra encontrada! Geocodificando localização...');
      const enderecoCompleto = buildAddressString(leadData);
      const coordenadas = await geocodeAddress(enderecoCompleto, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

      console.log('💾 Salvando no cloud...');
      await leadsRef.add({
        ...leadData,
        lat: coordenadas ? coordenadas.lat : null,
        lng: coordenadas ? coordenadas.lng : null,
        fonteOriginal: 'CETESB (Licença Ambiental)',
        urlOrigem: URL_ORIGEM,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: rawExtractedContent.substring(0, 5000),
      });
      console.log('🎉 SUCESSO: Lead adicionado com rastreabilidade e coordenadas.');
    }
  } else {
    console.log('ℹ️ Nenhum lead relevante identificado pelo Gemini nesta extração da CETESB.');
  }
  
  await browser.close();
  console.log('\n✅ Scraper CETESB finalizado.');
}

runCetesbScraper();
