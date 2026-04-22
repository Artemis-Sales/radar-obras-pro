import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead } = body;

    if (!lead || !lead.id) {
      return NextResponse.json({ error: 'Lead data is required' }, { status: 400 });
    }

    // Prepare lead data for insertion
    const leadData = {
      obra: lead.titulo || 'Obra não identificada',
      construtora: lead.empresa || lead.orgao || 'Construtora não identificada',
      cidade: lead.cidade || 'São Paulo',
      endereco_aproximado: lead.cidade || 'Endereço não informado',
      estagio: 'Lead Novo', // Force into the Kanban pipeline
      fonteOriginal: lead.fonte || 'PNCP',
      urlOrigem: lead.url_original || null,
      textoBruto: lead.descricao || '',
      criadoEm: new Date(),
      lat: -23.5505 + (Math.random() * 0.02 - 0.01), // Approximate SP coords so they appear on the map immediately
      lng: -46.6333 + (Math.random() * 0.02 - 0.01),
      enrichedData: {
        summary: lead.motivo_recomendacao || '',
      }
    };

    // Use a predictable ID or generate a new one
    // We prefix with 'saved_' to ensure it doesn't collide improperly if needed,
    // but using the existing ID allows us to prevent duplicates.
    const docId = lead.id.toString().replace(/[^a-zA-Z0-9_]/g, '_');
    
    await adminDb.collection('leads').doc(docId).set(leadData, { merge: true });

    return NextResponse.json({ success: true, id: docId });
  } catch (error) {
    console.error('Error saving lead to Kanban:', error);
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
  }
}
