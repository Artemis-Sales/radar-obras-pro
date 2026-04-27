import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { validateRequest, unauthorizedResponse } from '@/lib/auth/validateRequest';

export async function POST(request: Request) {
  try {
    // Auth guard
    const user = await validateRequest(request);
    if (!user) return unauthorizedResponse();

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
      // BUG FIX: Do NOT generate random coordinates. Use null and geocode later.
      lat: null,
      lng: null,
      enrichedData: {
        summary: lead.motivo_recomendacao || '',
      },
      savedByUserId: user.uid,
    };

    // Use a predictable ID to prevent duplicates.
    const docId = lead.id.toString().replace(/[^a-zA-Z0-9_]/g, '_');
    
    await adminDb.collection('leads').doc(docId).set(leadData, { merge: true });

    return NextResponse.json({ success: true, id: docId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error saving lead to Kanban:', msg);
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
  }
}
