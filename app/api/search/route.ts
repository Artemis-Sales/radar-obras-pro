// ============================================================
// Motor de Busca Multi-Fonte — /api/search
// Orquestra PNCP + Firestore local com NLU via Gemini
//
// ⚡ Otimizações de quota:
// - Cache de NLU em memória (mesma query = 0 chamadas Gemini)
// - Ranking 100% heurístico (sem chamada extra ao Gemini)
// - Resultado: ~1 chamada Gemini por query nova, 0 para repetidas
// ============================================================

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchPNCP } from '@/lib/providers/pncp';
import { searchLocal } from '@/lib/providers/local';
import {
  SearchResult,
  SearchFilters,
  ParsedIntent,
  SearchResponse,
  SearchSource,
} from '@/lib/providers/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================
// Cache de NLU — Evita chamadas repetidas ao Gemini
// TTL de 1 hora, max 200 entries
// ============================================================

interface CacheEntry {
  intent: ParsedIntent;
  timestamp: number;
}

const NLU_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const CACHE_MAX_SIZE = 200;

/** Normaliza a query para usar como chave do cache */
function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Limpa entries expiradas do cache */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of NLU_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      NLU_CACHE.delete(key);
    }
  }
  // Se ainda excede o limite, remover as mais antigas
  if (NLU_CACHE.size > CACHE_MAX_SIZE) {
    const entries = [...NLU_CACHE.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - CACHE_MAX_SIZE);
    for (const [key] of toRemove) {
      NLU_CACHE.delete(key);
    }
  }
}

// ============================================================
// 1. NLU — Extração de intenção com Gemini (com cache)
// ============================================================

async function parseIntent(query: string): Promise<ParsedIntent> {
  // Verificar cache primeiro
  const cacheKey = normalizeQueryKey(query);
  const cached = NLU_CACHE.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[NLU] Cache hit para: "${cacheKey}"`);
    return cached.intent;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const prompt = `Você é um parser de intenções de busca de obras de construção civil no Brasil.
Analise a seguinte frase e extraia a intenção estruturada.

REGRAS:
- "keywords" deve conter palavras-chave relevantes para busca de obras/licitações (ex: ["saneamento", "pavimentação"])
- "region" deve conter a localidade mencionada (ex: "Campinas", "interior de SP", "Recife")
- "uf" deve ser a sigla do estado se identificável (ex: "SP", "RJ", "MG")
- "tipo_obra" classifique o tipo de obra se possível (ex: "infraestrutura", "edificação", "saneamento")
- "fase" classifique a fase se mencionada (ex: "licitação", "execução", "projeto")
- Se a busca não mencionar algo, retorne null para o campo

Retorne SOMENTE um JSON válido, sem crases nem formatação markdown:
{
  "keywords": ["palavra1", "palavra2"],
  "region": "cidade ou região ou null",
  "uf": "XX ou null",  
  "tipo_obra": "tipo ou null",
  "fase": "fase ou null",
  "valor_min": null,
  "valor_max": null
}

Busca do usuário: "${query}"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);

    const intent: ParsedIntent = {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      region: parsed.region || undefined,
      uf: parsed.uf || undefined,
      tipo_obra: parsed.tipo_obra || undefined,
      fase: parsed.fase || undefined,
      valor_min: parsed.valor_min || undefined,
      valor_max: parsed.valor_max || undefined,
    };

    // Salvar no cache
    NLU_CACHE.set(cacheKey, { intent, timestamp: Date.now() });
    cleanCache();
    console.log(`[NLU] Cache miss — salvo: "${cacheKey}" → ${JSON.stringify(intent.keywords)}`);

    return intent;
  } catch (error: unknown) {
    console.error('[NLU] Gemini parse failed, using fallback:', error);
    // Fallback: usar a query como keyword direta (sem Gemini)
    const fallbackIntent: ParsedIntent = {
      keywords: query
        .toLowerCase()
        .replace(/[^\w\sáéíóúãõâêôç]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2),
    };

    // Cachear o fallback também para não tentar Gemini de novo
    NLU_CACHE.set(cacheKey, { intent: fallbackIntent, timestamp: Date.now() });

    return fallbackIntent;
  }
}

// ============================================================
// 2. Ranking Heurístico (sem chamada IA — rápido e gratuito)
// ============================================================

function rankResults(results: SearchResult[], intent: ParsedIntent): SearchResult[] {
  if (results.length === 0) return [];

  return results
    .map(r => {
      const { score, motivo } = calculateHeuristicScore(r, intent);
      return {
        ...r,
        relevancia: score,
        motivo_recomendacao: motivo
      };
    })
    .sort((a, b) => b.relevancia - a.relevancia);
}

/** Pontuação heurística de relevância focada em B2B Oportunidades */
function calculateHeuristicScore(result: SearchResult, intent: ParsedIntent): { score: number, motivo: string } {
  let score = 0;
  const motivos: string[] = [];

  const tituloLower = result.titulo.toLowerCase();
  const descLower = (result.descricao || '').toLowerCase();
  const fullText = tituloLower + ' ' + descLower;
  const empresaLower = (result.empresa || result.orgao || '').toLowerCase();

  // 1. Já possui Alvará / Licença (🔴 +50 Muito Alto)
  // Assumes that `tem_alvara` is set by local.ts or inferred here
  const ehPrivada = result.fonte === 'DOE-SP' || result.fonte === 'CETESB';
  const temAlvaraText = fullText.includes('alvará') || fullText.includes('aprovado') || fullText.includes('prévia');
  
  if (result.tem_alvara || (ehPrivada && temAlvaraText)) {
    score += 50;
    motivos.push('Alvará/Liberação confirmada');
  }

  // 2. Construtora Alvo (🔴 +50 Muito Alto)
  // Target Constructor match
  if (intent.keywords.length > 0) {
    let constructorMatch = false;
    for (const kw of intent.keywords) {
      if (kw !== 'sp' && kw !== 'obra' && empresaLower.includes(kw.toLowerCase())) {
        constructorMatch = true;
        break;
      }
    }
    if (constructorMatch) {
      score += 50;
      motivos.push('Construtora procurada mapeada');
    }
  }

  // 3. Tem Contato (🟠 +30 Alto)
  if (result.tem_contato) {
    score += 30;
    motivos.push('Possui contato mapeado');
  }

  // 4. Obra de Grande Porte (🟡 +15 Médio)
  // Includes keywords for large private developments
  const largeScaleKeywords = ['loteamento', 'condomínio', 'hospital', 'shopping', 'galpão', 'logístico', 'térreo', 'torre', 'pavimentos'];
  const isLargeScale = largeScaleKeywords.some(k => fullText.includes(k));
  if (isLargeScale || (result.valor_estimado && result.valor_estimado > 1000000)) {
    score += 15;
    motivos.push('Obra de grande porte');
  }

  // 5. Match de Cidade/Região (+10 Bonus)
  if (intent.region) {
    const regionLower = intent.region.toLowerCase();
    const cidadeLower = result.cidade.toLowerCase();
    if (cidadeLower === regionLower || cidadeLower.includes(regionLower)) {
      score += 10;
    }
  }

  // Penalização drástica: PNCP (Público Genérico) de fora de SP
  if (result.fonte === 'PNCP') {
    if (result.uf !== 'SP') {
      score -= 30; // Despriorizar lixo estatal de fora
    } else {
      score += 10; // Bônus base PNCP_SP
    }
  }

  // Fallback reason if it's PNCP SP but no strong b2b tags
  if (motivos.length === 0) {
    if (result.fonte === 'PNCP') motivos.push('Licitação Governamental (SP)');
    else motivos.push('Encontrado por similaridade');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    motivo: motivos.join(' + ')
  };
}

// ============================================================
// 3. Deduplicação
// ============================================================

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.titulo
      .toLowerCase()
      .replace(/[^\w]/g, '')
      .substring(0, 60);

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================
// 4. Endpoint POST /api/search
// ============================================================

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { query, filters: clientFilters } = body as {
      query: string;
      filters?: Partial<SearchFilters>;
    };

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Busca deve ter pelo menos 3 caracteres.' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY não configurada.' },
        { status: 500 }
      );
    }

    // 1. Parse da intenção (com cache — 0 chamadas Gemini se repetida)
    const intent = await parseIntent(query);

    // 2. Montar filtros finais e forçar SP
    const filters: SearchFilters = {
      dias: clientFilters?.dias || 30,
      uf: 'SP', // FORÇANDO B2B ESTADO SP
      valor_min: clientFilters?.valor_min || intent.valor_min || undefined,
      valor_max: clientFilters?.valor_max || intent.valor_max || undefined,
      fontes: clientFilters?.fontes || undefined,
    };

    // 3. Buscar em paralelo em todas as fontes ativas
    const activeSources = filters.fontes || ['PNCP', 'DOE-SP', 'CETESB'];

    const promises: Promise<SearchResult[]>[] = [];

    if (activeSources.includes('PNCP')) {
      promises.push(searchPNCP(intent, filters));
    }

    if (activeSources.includes('DOE-SP') || activeSources.includes('CETESB')) {
      promises.push(searchLocal(intent, filters));
    }

    const settled = await Promise.allSettled(promises);

    let allResults: SearchResult[] = [];
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        allResults.push(...res.value);
      }
    }

    // 4. Deduplicar
    allResults = deduplicateResults(allResults);

    // 5. Rankear com heurística (sem chamada IA — rápido e gratuito)
    allResults = rankResults(allResults, intent);

    // 6. Contagem por fonte
    const totalBySource: Record<SearchSource, number> = {
      'PNCP': 0,
      'DOE-SP': 0,
      'CETESB': 0,
      'Places': 0,
    };
    for (const r of allResults) {
      totalBySource[r.fonte]++;
    }

    const response: SearchResponse = {
      success: true,
      query,
      intent,
      results: allResults.slice(0, 100),
      total_by_source: totalBySource,
      total: allResults.length,
      tempo_ms: Date.now() - startTime,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Search Engine] Error:', msg);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        tempo_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

