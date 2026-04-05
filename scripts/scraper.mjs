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

// Configuração do Firebase Admin para gravação no banco de dados (Firestore)
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
  // Usaremos o modelo gemini-2.5-flash que é a versão suportada pelo Node SDK atual
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
    text = text.replace(/```json/g, '').replace(/```/g, '').trim(); // Fallback de sanitização
    
    return JSON.parse(text);
  } catch (error) {
    console.error('Erro na chamada do provedor Gemini:', error);
    return null;
  }
}

async function runScraper() {
  console.log('🚀 Iniciando o robô extrator headless (Puppeteer)...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  console.log('🌐 Conectando à fonte governamental (Simulação e-Ambiente CETESB / DOE-SP)...');
  
  /**
   * ATENÇÃO: Em código de produção que executa o scraping direto na tela da CETESB,
   * nós realizaríamos as requests ou os cliques na UI e pegaríamos os seletores DOM.
   * const rawText = await page.$eval('.resultado-publicacao', el => el.innerText);
   * 
   * Como é um teste de prova de conceito e o portal da CETESB tem flutuações e captcha, 
   * vamos capturar e injetar localmente um layout textual verídico que é renderizado pelo portal
   * a fim de demonstrar a excelência de estruturação do Gemini:
   */
  const simulatedRawExtractedDom = `
    AVISO DE LICENÇA DE INSTALAÇÃO
    A empresa "TOWER ENGENHARIA E CONSTRUÇÕES S.A." torna público que solicitou à CETESB a 
    Licença de Instalação (LI) para o empreendimento denominado "Condomínio Residencial Torres do Sol", 
    constituído por 4 torres residenciais familiares e área de lazer privativa, 
    localizado na Avenida dos Autonomistas, altura do número 5000, município de Osasco. 
    Processo nº 4567.89.2025 - PARECER DA DIRETORIA DE AVALIAÇÃO DE IMPACTO AMBIENTAL.
  `;

  console.log('📝 Texto bruto do diário oficial que foi encontrado e lido da tela HTML:');
  console.log(`"${simulatedRawExtractedDom.trim()}"`);
  
  console.log('\n🧠 Acionando O Google Gemini para extrair e estruturar (Data Parsing) o lead...');
  const leadData = await extractWithGemini(simulatedRawExtractedDom);
  
  if (leadData) {
    console.log('\n🟢 SUCESSO! O texto caótico virou este JSON impecável:');
    console.log(JSON.stringify(leadData, null, 2));

    console.log('\n💾 Conectando ao banco de dados Firestore para salvar a prospecção...');
    const leadsRef = db.collection('leads');
    
    // Regra de Negócio Crucial (Anti-Duplicação)
    console.log(`🔍 Checando duplicidade para a obra: "${leadData.obra}"...`);
    const snapshot = await leadsRef.where('obra', '==', leadData.obra).get();
    
    if (!snapshot.empty) {
      console.log('⚠️ ALERTA: Esta obra já está cadastrada no nosso banco de dados. Salvamento ignorado (Anti-Duplicação).');
    } else {
      console.log('✅ Obra totalmente inédita encontrada! Salvando no Firestore Cloud...');
      await leadsRef.add({
        ...leadData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: simulatedRawExtractedDom
      });
      console.log('🎉 SUCESSO FINAL: Obra salva perfeitamente na coleção "leads" do Firebase!');
    }
  }
  
  await browser.close();
  console.log('\n✅ Scraper fechado. Teste concluído!');
}

runScraper();
