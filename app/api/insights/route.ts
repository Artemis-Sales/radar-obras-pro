import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase/admin';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }
    // 0. Verificar cache (a cada 12h)
    const cacheRef = adminDb.collection('system_settings').doc('insights_cache');
    const cacheDoc = await cacheRef.get();
    
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      const now = new Date();
      const cacheTime = cacheData?.updatedAt?.toDate() || new Date(0);
      const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 12 && cacheData?.insight) {
        return NextResponse.json({
          success: true,
          insight: cacheData.insight,
          count: cacheData.count || 0,
          cached: true
        });
      }
    }

    // 1. Obter leads das últimas 48h
    const dataLimite = new Date();
    dataLimite.setHours(dataLimite.getHours() - 48);

    const leadsSnapshot = await adminDb.collection('leads')
      .where('criadoEm', '>=', dataLimite)
      .orderBy('criadoEm', 'desc')
      .limit(50)
      .get();

    if (leadsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        insight: "Nenhuma movimentação de obras registrada nas últimas 48 horas."
      });
    }

    const leadsData = leadsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        obra: data.obra || 'Desconhecida',
        construtora: data.construtora,
        cidade: data.cidade,
        estagio: data.estagio
      };
    });

    // 2. Chamar Gemini para sumarizar curto e útil (sem alucinar)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Convert to text to save tokens
    const textData = leadsData.map(l => `${l.obra} (${l.cidade}) - ${l.construtora} [${l.estagio}]`).join('\n');
    
    const prompt = `Você é um analista de dados do mercado de construção civil brasileiro.
Abaixo está a lista de leads reais (obras e licitações) que caíram no nosso sistema nas últimas 48 horas.
Seu objetivo é escrever UM parágrafo curto (máximo de 3 ou 4 frases) resumindo as tendências geográficas ou de tipologia (ex: muitos hospitais, concentração no interior, etc).
NÃO invente dados. Seja direto, profissional e útil.
Lista de Oportunidades:
${textData}`;

    const result = await model.generateContent(prompt);
    const insight = result.response.text().trim();

    // Salvar no cache
    await cacheRef.set({
      insight,
      count: leadsData.length,
      updatedAt: new Date()
    }, { merge: true });

    return NextResponse.json({
      success: true,
      insight,
      count: leadsData.length,
      cached: false
    });

  } catch (error: any) {
    console.error('Insights API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
