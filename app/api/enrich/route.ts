import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { validateRequest, unauthorizedResponse } from '@/lib/auth/validateRequest';
import { lookupCNPJ } from '@/lib/providers/cnpj';

export async function POST(req: Request) {
  try {
    // Auth guard
    const user = await validateRequest(req);
    if (!user) return unauthorizedResponse();

    const { leadId, construtora, cidade, cnpj } = await req.json();

    if (!leadId || !construtora || construtora === 'Não identificada' || construtora === 'A identificar') {
      return NextResponse.json({ success: false, error: 'Nome de construtora inválido ou não informado.' }, { status: 400 });
    }

    let cnpjData = null;
    let website = null;
    let phone = null;
    let summary = '';

    // ========== ETAPA 1: CNPJ Lookup (BrasilAPI — Gratuito) ==========
    if (cnpj) {
      cnpjData = await lookupCNPJ(cnpj);
      if (cnpjData) {
        phone = cnpjData.telefone_1 || null;
        summary = `Dados da Receita Federal: ${cnpjData.razao_social} (${cnpjData.porte}). `;
        summary += `CNAE: ${cnpjData.cnae_fiscal_descricao}. `;
        summary += `Capital Social: R$ ${cnpjData.capital_social.toLocaleString('pt-BR')}. `;
        if (cnpjData.socios.length > 0) {
          summary += `Sócios: ${cnpjData.socios.map(s => s.nome).join(', ')}.`;
        }
      }
    }

    // ========== ETAPA 2: Google Places (telefone + website) ==========
    const PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    
    if (PLACES_API_KEY && (!phone || !website)) {
      const query = `${construtora} em ${cidade || 'SP'}`;
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_API_KEY}&language=pt-BR`;
      
      try {
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.status === 'OK' && searchData.results && searchData.results.length > 0) {
          const placeId = searchData.results[0].place_id;
          
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,name,formatted_address&key=${PLACES_API_KEY}&language=pt-BR`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json();

          if (detailsData.status === 'OK' && detailsData.result) {
            website = website || detailsData.result.website || null;
            phone = phone || detailsData.result.formatted_phone_number || null;
            
            if (!summary) {
              summary = `Dados do Google Places: "${detailsData.result.name}" — ${detailsData.result.formatted_address}.`;
            }
          }
        }
      } catch (placesError) {
        console.warn('[Enrich] Google Places falhou, continuando com dados do CNPJ:', placesError);
      }
    }

    if (!website && !phone && !cnpjData) {
       return NextResponse.json({ success: false, error: 'As informações da empresa não foram encontradas na web de forma segura. Enriquecimento falhou.' }, { status: 404 });
    }

    const enrichedData: Record<string, unknown> = {
      website,
      phone,
      summary,
    };

    // Adicionar dados do CNPJ se disponíveis
    if (cnpjData) {
      enrichedData.cnpj = cnpjData.cnpj;
      enrichedData.razaoSocial = cnpjData.razao_social;
      enrichedData.nomeFantasia = cnpjData.nome_fantasia;
      enrichedData.porte = cnpjData.porte;
      enrichedData.capitalSocial = cnpjData.capital_social;
      enrichedData.cnae = cnpjData.cnae_fiscal_descricao;
      enrichedData.situacao = cnpjData.situacao_cadastral;
      enrichedData.socios = cnpjData.socios;
      enrichedData.email = cnpjData.email;
      enrichedData.endereco = `${cnpjData.logradouro}, ${cnpjData.numero} — ${cnpjData.municipio}/${cnpjData.uf}`;
      // Override phone with CNPJ phone if Places didn't find one
      if (!enrichedData.phone && cnpjData.telefone_1) {
        enrichedData.phone = cnpjData.telefone_1;
      }
    }

    // Atualiza Firestore
    const leadRef = adminDb.collection('leads').doc(leadId);
    await leadRef.update({
      enrichedData,
      atualizadoEm: new Date()
    });

    return NextResponse.json({ success: true, enrichedData });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Lead Enrichment Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
