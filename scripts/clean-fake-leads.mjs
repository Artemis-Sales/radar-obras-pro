/**
 * clean-fake-leads.mjs
 * 
 * Script de limpeza de emergência: apaga TODOS os leads gerados por dados
 * hardcoded/falsos que foram inseridos pelos scrapers mockados anteriores.
 * 
 * Leads identificados como falsos (hardcoded):
 *  - "LOTEAMENTO JARDIM DAS FLORES" (VERTICE INCORPORADORA LTDA) — scraper-doe.mjs
 *  - "Condomínio Residencial Torres do Sol" (TOWER ENGENHARIA) — scraper-cetesb.mjs
 *  - "Condomínio Residencial Vertical Vila Nova Pinheiros" / "Vila Nova Pinheiros" — scraper-prefeitura.mjs
 * 
 * USO: node scripts/clean-fake-leads.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  // Suporta duas formas de autenticação:
  // 1. CI/CD (GitHub Actions): variável FIREBASE_SERVICE_ACCOUNT com JSON completo
  // 2. Local dev: variáveis individuais FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
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

// Conjunto de nomes de obras sabidamente falsas (geradas pelos mocks hardcoded)
const OBRAS_FALSAS = [
  'LOTEAMENTO JARDIM DAS FLORES',
  'Loteamento Jardim das Flores',
  'Condomínio Residencial Torres do Sol',
  'Condomínio Residencial Vertical Vila Nova Pinheiros',
  'Vila Nova Pinheiros',
];

// Termos de texto bruto contidos apenas nos dados hardcoded
const TEXTO_BRUTO_MARKERS = [
  'VERTICE INCORPORADORA LTDA',
  'TOWER ENGENHARIA E CONSTRUÇÕES S.A.',
  'CONCRETO SÓLIDO INCORPORAÇÕES S.A.',
  'Fazenda Santa Clara',
  'Estrada do Sertãozinho, Km 12',
  'Alvará nº 2026/01509-00',
];

async function cleanFakeLeads() {
  console.log('======================================================');
  console.log('🧹 Iniciando limpeza de leads FALSOS (hardcoded)...');
  console.log('======================================================\n');

  const leadsRef = db.collection('leads');
  const allLeads = await leadsRef.get();
  
  if (allLeads.empty) {
    console.log('✅ Coleção "leads" está vazia. Nada a limpar.');
    process.exit(0);
  }

  console.log(`📊 Total de leads no banco: ${allLeads.size}`);
  
  const toDelete = [];

  allLeads.forEach(doc => {
    const data = doc.data();
    let isFake = false;
    let reason = '';

    // Verifica pelo nome da obra
    for (const obraFalsa of OBRAS_FALSAS) {
      if (
        (data.obra || '').toLowerCase().includes(obraFalsa.toLowerCase()) ||
        obraFalsa.toLowerCase().includes((data.obra || '').toLowerCase())
      ) {
        isFake = true;
        reason = `Nome de obra falsa: "${data.obra}"`;
        break;
      }
    }

    // Verifica pelo texto bruto (marcadores de conteúdo hardcoded)
    if (!isFake && data.textoBruto) {
      for (const marker of TEXTO_BRUTO_MARKERS) {
        if (data.textoBruto.includes(marker)) {
          isFake = true;
          reason = `Texto bruto contém marcador falso: "${marker}"`;
          break;
        }
      }
    }

    // Verifica pela construtora
    if (!isFake) {
      const construtoras = ['VERTICE INCORPORADORA', 'TOWER ENGENHARIA', 'CONCRETO SÓLIDO'];
      for (const c of construtoras) {
        if ((data.construtora || '').toUpperCase().includes(c)) {
          isFake = true;
          reason = `Construtora de dado hardcoded: "${data.construtora}"`;
          break;
        }
      }
    }

    if (isFake) {
      toDelete.push({ id: doc.id, obra: data.obra, reason });
    }
  });

  if (toDelete.length === 0) {
    console.log('\n✅ Nenhum lead falso detectado no banco. Banco de dados limpo!');
    process.exit(0);
  }

  console.log(`\n⚠️  ${toDelete.length} lead(s) falso(s) identificado(s) para exclusão:\n`);
  toDelete.forEach((item, i) => {
    console.log(`  ${i + 1}. [ID: ${item.id}] "${item.obra}"`);
    console.log(`     Razão: ${item.reason}`);
  });

  console.log('\n🗑️  Deletando leads falsos do Firestore...');
  
  // Usa batch para deleção em lote
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(item => {
      batch.delete(leadsRef.doc(item.id));
    });
    
    await batch.commit();
    console.log(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} lead(s) deletado(s).`);
  }

  console.log('\n======================================================');
  console.log(`🎉 LIMPEZA CONCLUÍDA! ${toDelete.length} lead(s) falso(s) removido(s).`);
  console.log('   O banco de dados está pronto para receber dados reais dos scrapers.');
  console.log('======================================================');
}

cleanFakeLeads().catch(err => {
  console.error('❌ Erro crítico na limpeza:', err);
  process.exit(1);
});
