import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { leadId, construtora, cidade } = await req.json();

    if (!leadId || !construtora || construtora === 'Não identificada' || construtora === 'A identificar') {
      return NextResponse.json({ success: false, error: 'Nome de construtora inválido ou não informado.' }, { status: 400 });
    }

    const PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!PLACES_API_KEY) {
      return NextResponse.json({ success: false, error: 'API Key não configurada.' }, { status: 500 });
    }

    // Usar apenas Google Places para buscar os detalhes firmes (sem alucinações de IA)
    // 1. Text Search para achar o Place ID da sede da empresa
    const query = `${construtora} em ${cidade || 'SP'}`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_API_KEY}&language=pt-BR`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    let website = null;
    let phone = null;
    let summary = '';

    if (searchData.status === 'OK' && searchData.results && searchData.results.length > 0) {
      const placeId = searchData.results[0].place_id;
      
      // 2. Place Details para pegar o site e telefone
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,name,formatted_address&key=${PLACES_API_KEY}&language=pt-BR`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();

      if (detailsData.status === 'OK' && detailsData.result) {
        website = detailsData.result.website || null;
        phone = detailsData.result.formatted_phone_number || null;
        
        summary = `Dados extraídos oficialmente do Google Places para "${detailsData.result.name}" no endereço: ${detailsData.result.formatted_address}.`;
      }
    }

    if (!website && !phone) {
       return NextResponse.json({ success: false, error: 'As informações da empresa não foram encontradas na web de forma segura. Enriquecimento falhou.' }, { status: 404 });
    }

    const enrichedData = {
      website,
      phone,
      summary
    };

    // Atualiza Firestore
    const leadRef = adminDb.collection('leads').doc(leadId);
    await leadRef.update({
      enrichedData,
      atualizadoEm: new Date()
    });

    return NextResponse.json({ success: true, enrichedData });

  } catch (error: any) {
    console.error('Lead Enrichment Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
