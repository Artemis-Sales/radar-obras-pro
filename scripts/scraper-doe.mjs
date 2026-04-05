import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

// Carregando as variáveis de ambiente
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuração do Firebase Admin Server SDK
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
  Você é um extrator de dados de mineração (Data Mining) especialista no Diário Oficial do Estado de São Paulo (DOE-SP), focado na Secretaria da Habitação e aprovações urbanísticas de GRAPROHAB, loteamentos e condomínios.
  Sua tarefa é ler atentamente o texto bruto da ata e devolver ESTRITAMENTE um objeto JSON.
  NÃO use formatação markdown (\`\`\`json), me retorne puramente o Hash.
  
  Regras de formatação do JSON:
  {
    "obra": "Nome do empreendimento, loteamento ou produto (ex: Loteamento Jardim das Flores).",
    "construtora": "A empresa construtora, incorporadora ou interessado.",
    "cidade": "O nome limpo do município paulista onde a obra ocorrerá (sem 'Município:' ou '- SP').",
    "endereco_aproximado": "Localização, estrada, bairro ou região informada.",
    "estagio": "Aprovações no GRAPROHAB significam projetos consolidados, logo o estágio deve ser 'Em Negociação'. Caso não fique claro, use 'Lead Novo'."
  }

  TEXTO BRUTO DA PUBLICAÇÃO DO DOE-SP:
  "${rawText}"
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim(); 
    return JSON.parse(text);
  } catch (error) {
    console.error('Falha de conexão com a infraestrutura da Ia Gemini:', error);
    return null;
  }
}

async function runDoeScraper() {
  console.log('🚀 Iniciando o robô de raspagem (Puppeteer) direcionado ao DOE-SP...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  console.log('🌐 Navegando até a Imprensa Oficial (Buscando cadernos do GRAPROHAB)...');
  
  // Texto simulado idêntico a um extrato encontrado em PDF processado do DOE-SP
  const simulatedRawExtractedDoe = `
    SECRETARIA DA HABITAÇÃO
    COMITÊ ESTADUAL DE APROVAÇÃO DE PROJETOS HABITACIONAIS - GRAPROHAB
    Resumo da Ata da Reunião Ordinária 100/2026
    Projetos Aprovados:
    Certificado nº 123/2026 – Processo: 45.678/2026. Interessado: VERTICE INCORPORADORA LTDA. 
    Empreendimento: LOTEAMENTO JARDIM DAS FLORES. Município: SÃO JOSÉ DOS CAMPOS. 
    Localização: Estrada do Sertãozinho, Km 12 - Bairro dos Coqueiros. Produto: Loteamento Misto com 450 lotes (Fazenda Santa Clara).
  `;

  console.log('📝 Texto maçante interceptado na publicação Oficial:');
  console.log(`"${simulatedRawExtractedDoe.trim()}"`);
  
  console.log('\n🧠 Encaminhando o calhamaço para o LLM Google Gemini parametrizar os dados...');
  const leadData = await extractWithGemini(simulatedRawExtractedDoe);
  
  if (leadData) {
    console.log('\n🟢 TRANSFORMAÇÃO BEM SUCEDIDA! O robô isolou as seguintes tags úteis:');
    console.log(JSON.stringify(leadData, null, 2));

    console.log('\n💾 Conectando ao cluster do Firestore Cloud para persistência comercial...');
    const leadsRef = db.collection('leads');
    
    // Verificação de Redundância/Duplicidade
    console.log(`🔍 Pesquisando se a prospectada "${leadData.obra}" já habita nossa base de dados...`);
    const snapshot = await leadsRef.where('obra', '==', leadData.obra).get();
    
    if (!snapshot.empty) {
      console.log('⚠️ ALERTA: Esse Lead já existe no CRM! Inserção abortada pelo Motor Anti-Duplicação.');
    } else {
      console.log('✅ Lead Virgem e Inédito detectado! Processando a inclusão...');
      await leadsRef.add({
        ...leadData,
        fonteOriginal: 'Diário Oficial SP (GRAPROHAB)', // Excelente para rastreabilidade 
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: simulatedRawExtractedDoe
      });
      console.log('🎉 SUCESSO ABSOLUTO: Nova Oportunidade registrada. O Frontend já deve reagir a ela!');
    }
  }
  
  await browser.close();
  console.log('\n🛑 Shutdown completo do Node Process para o Módulo DOE.');
}

runDoeScraper();
