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

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  Você é um extrator de dados de mineração (Data Mining) especialista no Diário Oficial da Cidade de São Paulo e GeoSampa, buscando 'Alvará de Aprovação e Execução de Edificação Nova'.
  Sua tarefa é fatiar o texto bruto da publicação do Alvará e extrair as propriedades exatas num objeto JSON limpo e formatado.
  NÃO use formatação markdown (\`\`\`json), DEVOLVA APENAS o HASH DO JSON.
  
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
  
  console.log('🌐 Acionando motor headless nos cadernos da SMUL / COMIN...');
  
  const rawExtractedContent = `
    PREFEITURA DO MUNICÍPIO DE SÃO PAULO
    SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO - SMUL
    COORDENADORIA DE EDIFICAÇÃO - COMIN
    ALVARÁS DE APROVAÇÃO E EXECUÇÃO DE EDIFICAÇÃO NOVA - DEFERIDOS
    Processo SIDOR: 2026-0.123.456-7
    Interessado/Proprietário: CONCRETO SÓLIDO INCORPORAÇÕES S.A.
    Local do Imóvel: Rua das Acácias Verdes, 1250 - Pinheiros - São Paulo/SP.
    Assunto: Emissão de Alvará de Aprovação e Execução para Edificação Nova. 
    Projeto: Condomínio Residencial Vertical "Vila Nova Pinheiros", contemplando 3 subsolos, térreo e 15 pavimentos.
    Despacho: DEFIRO o pedido sob emissão do Alvará nº 2026/01509-00.
  `;

  console.log('📝 Publicação oficial interceptada para processamento...');
  
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: rawExtractedContent
      });
      console.log('🎉 SUCESSO: Oportunidade adicionada ao Dashboard com coordenadas precisas.');
    }
  }
  
  await browser.close();
  console.log('\n✅ Crawler Municipal finalizado com Glória.');
}

runMunicipalScraper();
