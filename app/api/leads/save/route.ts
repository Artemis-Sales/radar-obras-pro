// ============================================================
// API /api/leads/save — Salva um resultado de busca como lead
// Converte SearchResult → Lead no Firestore
// ============================================================

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resultado } = body;

    if (!resultado || !resultado.titulo) {
      return NextResponse.json(
        { success: false, error: 'Resultado inválido.' },
        { status: 400 }
      );
    }

    // Gerar ID determinístico baseado na fonte + título para anti-duplicação
    const sanitizedTitle = resultado.titulo
      .toLowerCase()
      .replace(/[^\w]/g, '_')
      .substring(0, 50);
    const docId = `search_${resultado.fonte}_${sanitizedTitle}`;

    const docRef = adminDb.collection('leads').doc(docId);
    const existing = await docRef.get();

    if (existing.exists) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: 'Este lead já foi salvo anteriormente.',
        leadId: docId,
      });
    }

    const novoLead = {
      obra: resultado.titulo,
      construtora: resultado.empresa || resultado.orgao || 'A identificar',
      cidade: resultado.cidade || '',
      endereco_aproximado: `${resultado.cidade || ''}${resultado.uf ? ', ' + resultado.uf : ''}`,
      estagio: 'Lead Novo',
      fonteOriginal: `Busca Ativa (${resultado.fonte})`,
      urlOrigem: resultado.url_original || '',
      valorEstimado: resultado.valor_estimado || null,
      modalidade: resultado.modalidade || null,
      fase: resultado.fase || null,
      numeroControle: resultado.numero_controle || null,
      orgao: resultado.orgao || null,
      lat: null,
      lng: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      textoBruto: resultado.descricao || '',
    };

    await docRef.set(novoLead);

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      message: 'Lead salvo com sucesso!',
      leadId: docId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Save Lead] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
