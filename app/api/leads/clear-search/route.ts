import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { validateRequest, unauthorizedResponse } from '@/lib/auth/validateRequest';

export async function DELETE(req: Request) {
  try {
    // Auth guard
    const user = await validateRequest(req);
    if (!user) return unauthorizedResponse();

    const leadsRef = adminDb.collection('leads');
    const snapshot = await leadsRef.where('fonteOriginal', '==', 'Busca Ativa (Places)').get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, count: 0, message: 'Nenhum lead encontrado para limpar.' });
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ success: true, count: snapshot.size, message: `Foram excluídos ${snapshot.size} leads com sucesso.` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Erro ao limpar leads:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
