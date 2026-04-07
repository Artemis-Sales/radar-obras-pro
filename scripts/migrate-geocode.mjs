/**
 * migrate-geocode.mjs
 * Script de migração ONE-TIME: percorre todos os leads do Firestore que não possuem
 * lat/lng e geocodifica seus endereços, atualizando os documentos com coordenadas reais.
 *
 * Uso:
 *   node scripts/migrate-geocode.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { geocodeAddress, buildAddressString } from './geocode.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Inicializa Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!serviceAccount.project_id) {
    // Fallback: usa credenciais individuais do .env.local
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
}

const db = admin.firestore();
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function migrateLeads() {
  console.log('🗺️  Iniciando migração de geocodificação dos leads existentes...\n');

  if (!MAPS_API_KEY) {
    console.error('❌ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não encontrada no .env.local');
    process.exit(1);
  }

  const leadsRef = db.collection('leads');
  const snapshot = await leadsRef.get();

  if (snapshot.empty) {
    console.log('ℹ️  Nenhum lead encontrado na coleção.');
    return;
  }

  console.log(`📊 Total de leads no Firestore: ${snapshot.size}`);

  let atualizados = 0;
  let semEndereco = 0;
  let jaComCoords = 0;
  let falhas = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Pula leads que já têm coordenadas válidas
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      jaComCoords++;
      console.log(`⏭️  [${docSnap.id.slice(0, 8)}] "${data.obra}" — já possui coords (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})`);
      continue;
    }

    // Monta endereço a partir dos campos disponíveis
    const leadParaEndereco = {
      endereco_aproximado: data.endereco_aproximado || '',
      cidade: data.cidade || '',
    };
    const enderecoCompleto = buildAddressString(leadParaEndereco);

    if (!enderecoCompleto || enderecoCompleto === 'São Paulo, SP') {
      semEndereco++;
      console.log(`⚠️  [${docSnap.id.slice(0, 8)}] "${data.obra}" — endereço insuficiente, pulando.`);
      continue;
    }

    console.log(`🔍 [${docSnap.id.slice(0, 8)}] "${data.obra}" — geocodificando: "${enderecoCompleto}"...`);

    // Adiciona delay para respeitar rate limit da Geocoding API (50 req/s free tier)
    await new Promise(r => setTimeout(r, 200));

    const coords = await geocodeAddress(enderecoCompleto, MAPS_API_KEY);

    if (coords) {
      await docSnap.ref.update({ lat: coords.lat, lng: coords.lng });
      console.log(`   ✅ Atualizado → lat: ${coords.lat}, lng: ${coords.lng}`);
      atualizados++;
    } else {
      console.log(`   ❌ Geocodificação sem resultado.`);
      falhas++;
    }
  }

  console.log('\n======================================================');
  console.log('📋 RELATÓRIO DE MIGRAÇÃO:');
  console.log(`   ✅ Geocodificados e atualizados: ${atualizados}`);
  console.log(`   ⏭️  Já possuíam coordenadas:     ${jaComCoords}`);
  console.log(`   ⚠️  Sem endereço suficiente:     ${semEndereco}`);
  console.log(`   ❌ Falhas na geocodificação:     ${falhas}`);
  console.log('======================================================\n');
}

migrateLeads().catch(err => {
  console.error('❌ Erro fatal na migração:', err);
  process.exit(1);
});
