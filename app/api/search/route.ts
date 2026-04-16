import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase/admin';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ success: false, error: 'Busca vazia' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ success: false, error: 'API Keys não configuradas' }, { status: 500 });
    }

    // 1. Extrair info com Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const extractionPrompt = `Extraia a intenção de localização e as palavras-chave relevantes da seguinte busca natural de obras/projetos.
Retorne APENAS um JSON válido com o seguinte formato, sem formatação markdown:
{
  "keywords": "foco principal da obra (ex: hospital, saneamento, construção vertical)",
  "region": "localização especificada (ex: interior de SP, Osasco, Campinas, Vila Mariana)"
}
Busca: "${query}"`;

    const result = await model.generateContent(extractionPrompt);
    const responseText = result.response.text().trim();
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let extracted;
    try {
      extracted = JSON.parse(cleanJsonText);
    } catch (e) {
      console.error('Erro ao parsear JSON do Gemini:', e);
      return NextResponse.json({ success: false, error: 'Falha ao interpretar a busca.' }, { status: 500 });
    }

    const { keywords, region } = extracted;
    const placesQuery = `${keywords} em ${region}`;

    // 2. Buscar no Google Places API
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placesQuery)}&key=${PLACES_API_KEY}&language=pt-BR`;
    const placesRes = await fetch(placesUrl);
    const placesData = await placesRes.json();

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('Erro no Places API:', placesData);
      return NextResponse.json({ success: false, error: 'Erro ao buscar no Google Places' }, { status: 500 });
    }

    const results = placesData.results || [];
    const leadsCriados = [];

    // 3. Salvar no Firestore
    for (const place of results.slice(0, 10)) { // Limitar a 10 resultados para nao floodar
      const docId = `places_${place.place_id}`;
      const docRef = adminDb.collection('leads').doc(docId);
      
      const exists = await docRef.get();
      if (!exists.exists) {
        const novoLead = {
          obra: place.name || 'Obra Encontrada',
          construtora: 'A identificar',
          cidade: region, // ou tentar extrair de formatted_address
          endereco_aproximado: place.formatted_address || '',
          estagio: 'Lead Novo',
          fonteOriginal: 'Busca Ativa (Places)',
          urlOrigem: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          lat: place.geometry?.location?.lat || null,
          lng: place.geometry?.location?.lng || null,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          textoBruto: `ID Places: ${place.place_id}\nBusca: ${placesQuery}`
        };
        
        await docRef.set(novoLead);
        leadsCriados.push({ id: docId, ...novoLead, criadoEm: novoLead.criadoEm.toISOString(), atualizadoEm: novoLead.atualizadoEm.toISOString() });
      }
    }

    return NextResponse.json({
      success: true,
      extracted,
      placesFound: results.length,
      newLeads: leadsCriados
    });

  } catch (error: any) {
    console.error('Busca Ativa Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
