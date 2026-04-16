import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function DELETE() {
  try {
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
  } catch (error: any) {
    console.error('Erro ao limpar leads:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao deletar leads' }, { status: 500 });
  }
}
