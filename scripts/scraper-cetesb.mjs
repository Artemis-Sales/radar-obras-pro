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

// Formata as datas para a consulta (últimos 14 dias)
const today = new Date();
const twoWeeksAgo = new Date();
twoWeeksAgo.setDate(today.getDate() - 14);

const formatDate = (date) => {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const dateInic = formatDate(twoWeeksAgo);
const dateEnd = formatDate(today);

// URL real de pesquisa da CETESB filtrando pelos últimos 14 dias
const URL_ORIGEM = `https://sistemasinter02.cetesb.sp.gov.br/consultaLicenciamento/public/Index.php?dateInic=${dateInic}&dateEnd=${dateEnd}`;

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  
  const prompt = `
  Você é um extrator de dados de mineração (Data Mining) especialista em diários oficiais e licenças ambientais.
  Leia as informações brutas (tabela de processos da CETESB) e devolva APENAS registros que claramente se refiram à CONSTRUÇÃO CIVIL ou INCORPORAÇÃO IMOBILIÁRIA (loteamentos, condomínios, residenciais, galpões).
  Se o texto não contiver empreendimentos de construção relevantes ou se estiver vazio, retorne \`null\`.
  NÃO invente dados. NÃO use os mesmos exemplos anteriores na sua resposta. Extraia estritamente o que está no texto.
  NÃO use formatação markdown, apenas retorne um array de JSONs (caso haja mais de um), ou um único JSON.
  
  Formato e regras:
  [
    {
      "obra": "Nome do empreendimento ou local extraído exatamente como está. NÃO invente nomes.",
      "construtora": "Nome do Interessado ou requerente.",
      "cidade": "Município informado.",
      "endereco_aproximado": "Endereço extraído.",
      "estagio": "Se o Tipo for Licença Prévia ou LP, retorne 'Lead Novo'. Se for Licença de Instalação ou LI, retorne 'Em Negociação'. Caso não especificado mas seja construção civil, retorne 'Lead Novo'."
    }
  ]

  TEXTO BRUTO DA CETESB (Tabela de Resultados dos últimos 14 dias):
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
    console.error('Erro na chamada do provedor Gemini:', error);
    return null;
  }
}

async function runCetesbScraper() {
  console.log('🚀 Iniciando o robô extrator headless (CETESB - Últimas 2 semanas)...');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  console.log(`🌐 Navegando: ${URL_ORIGEM}`);
  
  try {
    await page.goto(URL_ORIGEM, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch(e) {
    console.log(`Erro ao acessar a página: ${e.message}`);
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('📝 Extraindo e limpando a tabela de publicações...');
  const rawExtractedContent = await page.evaluate(() => {
    // Pegando apenas a tabela de resultados para evitar lixo
    const rows = document.querySelectorAll('tr');
    let text = [];
    rows.forEach(tr => {
      // Ignora linhas sem texto útil
      if(tr.innerText && tr.innerText.trim().length > 10) {
         text.push(tr.innerText.replace(/\\s+/g, ' ').trim());
      }
    });
    return text.slice(0, 40).join('\\n'); // Limita o tamanho para o Gemini
  });

  if (!rawExtractedContent || rawExtractedContent.trim().length < 50) {
    console.warn('⚠️ Conteúdo insuficiente extraído da CETESB. Pode não haver novos leads nos últimos 14 dias.');
    await browser.close();
    return;
  }

  console.log('\n🧠 Acionando O Google Gemini...');
  const leadsArray = await extractWithGemini(rawExtractedContent);
  
  if (leadsArray && leadsArray.length > 0) {
    console.log(`\n🟢 SUCESSO: ${leadsArray.length} lead(s) extraído(s) da API LLM.`);
    
    const leadsRef = db.collection('leads');

    for (const leadData of leadsArray) {
      if(!leadData.obra || !leadData.construtora) continue;

      console.log(`\n🔍 Verificando na base: "${leadData.obra}" (${leadData.cidade})...`);
      
      // Busca composta e exata (anti-duplicação forte por nome e construtora)
      const snapshot = await leadsRef
        .where('obra', '==', leadData.obra)
        .where('construtora', '==', leadData.construtora)
        .get();
        
      if (!snapshot.empty) {
        console.log('⚠️ AVISO: Empreendimento já consta na base. Ignorado.');
      } else {
        console.log('✅ Lead é INÉDITO! Geocodificando endereço...');
        const enderecoCompleto = buildAddressString(leadData);
        const coordenadas = await geocodeAddress(enderecoCompleto, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

        console.log('💾 Inserindo lead...');
        await leadsRef.add({
          ...leadData,
          lat: coordenadas ? coordenadas.lat : null,
          lng: coordenadas ? coordenadas.lng : null,
          fonteOriginal: 'CETESB (Licença Ambiental)',
          urlOrigem: URL_ORIGEM,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          criadoEm: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`🎉 SUCESSO: [${leadData.obra}] sincronizado.`);
      }
    }
  } else {
    console.log('ℹ️ Nenhum dado de obra civil relevante classificado pelo Gemini nestes últimos 14 dias.');
  }
  
  await browser.close();
  console.log('\n✅ Scraper CETESB concluído.');
}

runCetesbScraper();
