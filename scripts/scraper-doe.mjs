import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { geocodeAddress, buildAddressString } from './geocode.mjs';

// Carregando as variáveis de ambiente
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuração do Firebase Admin Server SDK
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// URL de origem real do portal DOE-SP (Caderno Executivo - Secretaria da Habitação / GRAPROHAB)
const URL_ORIGEM = 'https://www.doe.sp.gov.br/busca-avancada';
const TERMO_BUSCA = 'GRAPROHAB';

async function extractWithGemini(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  Você é um extrator de dados de mineração (Data Mining) especialista no Diário Oficial do Estado de São Paulo (DOE-SP), focado na Secretaria da Habitação e aprovações urbanísticas de GRAPROHAB, loteamentos e condomínios.
  Sua tarefa é ler atentamente o texto bruto da ata e devolver ESTRITAMENTE um objeto JSON.
  NÃO use formatação markdown (\`\`\`json), me retorne puramente o Hash.
  Se o texto não contiver dados de obras ou empreendimentos relevantes, retorne null.
  
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
    if (text.toLowerCase() === 'null' || text === '') return null;
    return JSON.parse(text);
  } catch (error) {
    console.error('Falha de conexão com a infraestrutura da IA Gemini:', error);
    return null;
  }
}

async function runDoeScraper() {
  console.log('🚀 Iniciando o robô de raspagem (Puppeteer) direcionado ao DOE-SP...');
  
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

  console.log(`🌐 Navegando até a Busca Avançada do DOE-SP: ${URL_ORIGEM}`);
  await page.goto(URL_ORIGEM, { waitUntil: 'networkidle2', timeout: 60000 });

  // Aguarda a SPA React carregar e fecha modal inicial se existir
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Fecha modal de boas-vindas, se existir
    const closeBtn = await page.$('button[aria-label="close"], button[aria-label="fechar"], .MuiModal-root button:first-child');
    if (closeBtn) {
      await closeBtn.click();
      console.log('ℹ️ Modal de boas-vindas fechado.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (_) { /* modal não existe */ }

  // Digita o termo de busca no campo de texto
  console.log(`🔍 Digitando termo de busca: "${TERMO_BUSCA}"...`);
  const termInput = await page.waitForSelector('input[type="text"], input[placeholder*="termo"], input[placeholder*="busca"], input[placeholder*="Buscar"]', { timeout: 15000 });
  await termInput.click({ clickCount: 3 });
  await termInput.type(TERMO_BUSCA, { delay: 80 });

  // Seleciona período "Mês" para capturar publicações recentes
  try {
    const dateDropdown = await page.$('div[aria-label*="data"], div[aria-label*="Data"], .MuiSelect-select');
    if (dateDropdown) {
      await dateDropdown.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Procura pela opção "Mês"
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
    console.log('ℹ️ Selector de período não localizado, prosseguindo sem filtro de data.');
  }

  // Clica no botão de pesquisa
  console.log('🔎 Executando a pesquisa...');
  const searchBtn = await page.$('button[type="submit"], button:has(svg[data-testid="SearchIcon"]), button:contains("PESQUISAR")');
  if (searchBtn) {
    await searchBtn.click();
  } else {
    await termInput.press('Enter');
  }

  // Aguarda resultados carregarem
  console.log('⏳ Aguardando resultados da pesquisa (SPA)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Extrai os snippets de texto dos resultados
  console.log('📝 Extraindo conteúdo real da página...');
  const rawExtractedContent = await page.evaluate(() => {
    // Captura o texto de todos os cards/items de resultado
    const selectors = [
      'article', '.resultado', '.result-item', '.MuiCard-root',
      'h6', '.MuiTypography-h6', 'p.MuiTypography-body1',
      '[class*="result"]', '[class*="publicacao"]', '[class*="noticia"]'
    ];
    
    let textos = [];
    
    // Tenta capturar via selectors específicos
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        els.forEach(el => {
          const t = el.innerText?.trim();
          if (t && t.length > 30) textos.push(t);
        });
      }
    }
    
    // Fallback: captura o innerText geral da área principal
    if (textos.length === 0) {
      const main = document.querySelector('main, #root, .App, [role="main"]');
      if (main) {
        textos.push(main.innerText.substring(0, 8000));
      }
    }
    
    return textos.slice(0, 20).join('\n---\n');
  });

  console.log(`📄 Conteúdo extraído (${rawExtractedContent.length} chars). Amostra: ${rawExtractedContent.substring(0, 200)}...`);

  if (!rawExtractedContent || rawExtractedContent.trim().length < 50) {
    console.warn('⚠️ Conteúdo insuficiente extraído. O site pode ter bloqueado o acesso ou a estrutura mudou.');
    await browser.close();
    return;
  }

  console.log('\n🧠 Encaminhando para o LLM Google Gemini parametrizar os dados...');
  const leadData = await extractWithGemini(rawExtractedContent);
  
  if (leadData) {
    console.log('\n🟢 TRANSFORMAÇÃO CONCLUÍDA: Dados estruturados com sucesso.');
    console.log(JSON.stringify(leadData, null, 2));

    console.log('\n💾 Sincronizando com o Cloud Firestore...');
    const leadsRef = db.collection('leads');
    
    // Verificação de Redundância/Duplicidade
    console.log(`🔍 Verificando se "${leadData.obra}" já existe na base...`);
    const snapshot = await leadsRef.where('obra', '==', leadData.obra).get();
    
    if (!snapshot.empty) {
      console.log('⚠️ CONFLITO: Lead já existente. Operação ignorada.');
    } else {
      console.log('✅ Lead inédito detectado! Geocodificando localização...');
      const enderecoCompleto = buildAddressString(leadData);
      const coordenadas = await geocodeAddress(enderecoCompleto, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

      console.log('💾 Processando inclusão...');
      await leadsRef.add({
        ...leadData,
        lat: coordenadas ? coordenadas.lat : null,
        lng: coordenadas ? coordenadas.lng : null,
        fonteOriginal: 'Diário Oficial SP (GRAPROHAB)',
        urlOrigem: URL_ORIGEM,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        textoBruto: rawExtractedContent.substring(0, 5000),
      });
      console.log('🎉 SUCESSO: Registro inserido no funil de vendas com coordenadas precisas.');
    }
  } else {
    console.log('ℹ️ Nenhum lead relevante identificado pelo Gemini nesta extração.');
  }
  
  await browser.close();
  console.log('\n🛑 Shutdown completo do Node Process para o Módulo DOE.');
}

runDoeScraper();
