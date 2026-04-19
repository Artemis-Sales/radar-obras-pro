// ============================================================
// API /api/search/analyze — Micro-briefing estratégico com IA
// Gera uma análise acionável para um resultado de busca
// ============================================================

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resultado, queryOriginal } = body;

    if (!resultado || !resultado.titulo) {
      return NextResponse.json({ success: false, error: 'Resultado inválido.' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Você é um consultor sênior de prospecção comercial no setor de construção civil brasileiro.
Um engenheiro civil está buscando novas oportunidades de obras e encontrou o seguinte resultado:

**Busca original:** "${queryOriginal || 'Não especificada'}"

**Dados do resultado:**
- Título/Objeto: ${resultado.titulo}
- Órgão: ${resultado.orgao || 'Não identificado'}
- Cidade/UF: ${resultado.cidade || ''}${resultado.uf ? ', ' + resultado.uf : ''}
- Valor Estimado: ${resultado.valor_estimado ? 'R$ ' + Number(resultado.valor_estimado).toLocaleString('pt-BR') : 'Não informado'}
- Modalidade: ${resultado.modalidade || 'Não especificada'}
- Fase: ${resultado.fase || 'Não informada'}
- Fonte: ${resultado.fonte || 'PNCP'}
- Data Publicação: ${resultado.data_publicacao || 'Não informada'}
${resultado.data_encerramento ? '- Encerramento Propostas: ' + resultado.data_encerramento : ''}

**Sua tarefa: gerar um MICRO-BRIEFING estratégico com EXATAMENTE os seguintes blocos:**

1. **📋 Resumo** (2-3 frases descrevendo a oportunidade de forma clara)
2. **💰 Porte** (classificar: Pequeno <100k, Médio 100k-1M, Grande 1M-10M, Mega >10M — com justificativa)
3. **⚡ Ação Recomendada** (o que o engenheiro deveria fazer AGORA: preparar documentação? buscar parceiros? montar consórcio?)
4. **⚠️ Atenção** (riscos ou pontos de atenção: prazo curto, exigência de atestado técnico, etc.)

REGRAS:
- Seja DIRETO, PROFISSIONAL e CURTO (máximo 200 palavras total)
- NÃO invente dados que não estão no texto
- Se o valor não estiver disponível, estime o porte pelo tipo de obra
- Use linguagem de mercado, como se fosse um briefing de reunião comercial

Retorne em texto puro (sem JSON, sem markdown com #). Use os emojis dos títulos acima.`;

    const result = await model.generateContent(prompt);
    const briefing = result.response.text().trim();

    return NextResponse.json({
      success: true,
      briefing,
      resultado_id: resultado.id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Analyze API] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
