// ============================================================
// API /api/search/saved — CRUD de buscas favoritas
// ============================================================

import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase/admin';

const COLLECTION = 'saved_searches';

// GET — Listar buscas salvas
export async function GET() {
  try {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const searches = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      lastRunAt: doc.data().lastRunAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ success: true, searches });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Saved Searches GET] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST — Salvar uma nova busca
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, filters, lastResultCount } = body;

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Query inválida.' },
        { status: 400 }
      );
    }

    // Verificar se já existe uma busca salva com a mesma query
    const existing = await adminDb
      .collection(COLLECTION)
      .where('query', '==', query.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        id: existing.docs[0].id,
        message: 'Esta busca já está salva.',
      });
    }

    const docRef = await adminDb.collection(COLLECTION).add({
      query: query.trim(),
      filters: filters || {},
      lastResultCount: lastResultCount || 0,
      newResultCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      id: docRef.id,
      message: 'Busca salva com sucesso!',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Saved Searches POST] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE — Remover busca salva
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID não informado.' },
        { status: 400 }
      );
    }

    await adminDb.collection(COLLECTION).doc(id).delete();

    return NextResponse.json({ success: true, message: 'Busca removida.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Saved Searches DELETE] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
