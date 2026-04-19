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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
    .map(r => ({
      ...r,
      relevancia: calculateHeuristicScore(r, intent),
    }))
    .sort((a, b) => b.relevancia - a.relevancia);
}

/** Pontuação heurística de relevância (0-100) */
function calculateHeuristicScore(result: SearchResult, intent: ParsedIntent): number {
  let score = 40;

  const tituloLower = result.titulo.toLowerCase();
  const descLower = (result.descricao || '').toLowerCase();
  const fullText = tituloLower + ' ' + descLower;

  // +20 para cada keyword encontrada no título (max +60)
  let keywordHits = 0;
  for (const kw of intent.keywords) {
    const kwLower = kw.toLowerCase();
    if (tituloLower.includes(kwLower)) {
      keywordHits++;
      score += 20;
    } else if (descLower.includes(kwLower)) {
      keywordHits++;
      score += 10;
    }
  }

  // Bonus se TODAS as keywords deram match
  if (intent.keywords.length > 1 && keywordHits === intent.keywords.length) {
    score += 15;
  }

  // +15 se a cidade bate exatamente com a região buscada
  if (intent.region) {
    const regionLower = intent.region.toLowerCase();
    const cidadeLower = result.cidade.toLowerCase();
    if (cidadeLower === regionLower) {
      score += 15;
    } else if (cidadeLower.includes(regionLower) || regionLower.includes(cidadeLower)) {
      score += 10;
    }
  }

  // +10 se UF bate
  if (intent.uf && result.uf === intent.uf) {
    score += 10;
  }

  // +5 se tem valor estimado (dado mais rico para decisão)
  if (result.valor_estimado && result.valor_estimado > 0) {
    score += 5;
  }

  // +5 se tem link direto do sistema de origem (não apenas PNCP)
  if (result.url_original && !result.url_original.includes('pncp.gov.br/app/editais')) {
    score += 5;
  }

  // +3 se é publicação recente (últimos 7 dias)
  try {
    const pubDate = new Date(result.data_publicacao);
    const diffDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) score += 3;
  } catch {}

  // +5 se tipo de obra bate com tipo buscado
  if (intent.tipo_obra) {
    const tipoLower = intent.tipo_obra.toLowerCase();
    if (fullText.includes(tipoLower)) {
      score += 5;
    }
  }

  return Math.min(100, Math.max(0, score));
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

    // 2. Montar filtros finais
    const filters: SearchFilters = {
      dias: clientFilters?.dias || 30,
      uf: clientFilters?.uf || intent.uf || undefined,
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

