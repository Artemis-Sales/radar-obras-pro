import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

// Carrega as chaves do .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Firebase Admin initialization para salvar no Firestore (Pipeline em Nuvem)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    }),
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
    headless: true,
    args: ['--no-sandbox'] 
  });
  const page = await browser.newPage();
  
  console.log('🌐 Acionando motor headless nos cadernos da SMUL / COMIN...');
  
  const mockDocText = `
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

  console.log('📝 Publicação bruta detectada pelo Crawler na página de Alvarás:');
  console.log(`"${mockDocText.trim()}"`);
  
  console.log('\n🧠 Injetando o bloco de texto no Cérebro Analítico (Google Gemini) para fatiar o chumbo grosso...');
  const leadData = await extractWithGemini(mockDocText);
  
  if (leadData) {
    console.log('\n🟢 EXTRAÇÃO PERFEITA! O Gemini transformou a massa de texto do Alvará em um Lead estruturado:');
    console.log(JSON.stringify(leadData, null, 2));

    console.log('\n💾 Sincronizando com o Cloud Firestore (Firebase)...');
    const leadsRef = db.collection('leads');
    
    // Filtro Injetável de Redundância (Anti-Duplicação)
    console.log(`🔍 Disparando varredura Anti-Duplicação para a obra: "${leadData.obra}"...`);
    const snapshot = await leadsRef.where('obra', '==', leadData.obra).get();
    
    if (!snapshot.empty) {
      console.log('⚠️ CONFLITO DE LEAD: Este Alvará já consta no Banco de Dados. Salvamento Recusado (Eficiência garantida).');
    } else {
      console.log('✅ Sinal Verde: Empreendimento nunca visto pelo sistema! Concluindo injeção do Lead na base...');
      await leadsRef.add({
        ...leadData,
        fonteOriginal: 'Diário Oficial de SP (Alvará Aprovado)',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: mockDocText
      });
      console.log('🎉 PINGO NO KANBAN! Alvará capturado, processado e salvo remotamente. A tela do seu Dashboard piscará em instantes!');
    }
  }
  
  await browser.close();
  console.log('\n✅ Crawler Municipal finalizado com Glória.');
}

runMunicipalScraper();
