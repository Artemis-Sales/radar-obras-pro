import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

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

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  Você é um extrator de dados de mineração (Data Mining) especialista em diários oficiais e licenças ambientais com foco na construção civil.
  Sua tarefa é ler e analisar cirurgicamente o texto bruto de uma publicação de licenciamento e devolver ESTRITAMENTE um objeto JSON.
  NAO use formatação markdown (\`\`\`json), apenas o hash de chaves do JSON puro.
  
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
  
  console.log('🌐 Conectando à fonte governamental (Simulação e-Ambiente CETESB)...');
  
  // Captura do conteúdo bruto
  const rawExtractedContent = `
    AVISO DE LICENÇA DE INSTALAÇÃO
    A empresa "TOWER ENGENHARIA E CONSTRUÇÕES S.A." torna público que solicitou à CETESB a 
    Licença de Instalação (LI) para o empreendimento denominado "Condomínio Residencial Torres do Sol", 
    constituído por 4 torres residenciais familiares e área de lazer privativa, 
    localizado na Avenida dos Autonomistas, altura do número 5000, município de Osasco. 
    Processo nº 4567.89.2025 - PARECER DA DIRETORIA DE AVALIAÇÃO DE IMPACTO AMBIENTAL.
  `;

  console.log('📝 Conteúdo interceptado para análise técnica...');
  
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
      console.log('✅ Nova obra encontrada! Salvando no cloud...');
      await leadsRef.add({
        ...leadData,
        fonteOriginal: 'CETESB (Licença Ambiental)',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: rawExtractedContent
      });
      console.log('🎉 SUCESSO: Lead adicionado com rastreabilidade.');
    }
  }
  
  await browser.close();
  console.log('\n✅ Scraper CETESB finalizado.');
}

runCetesbScraper();
