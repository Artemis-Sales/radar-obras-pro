// ============================================================
// Provedor Querido Diário — Diários Oficiais Municipais
// API pública, gratuita, sem autenticação
// Cobre 5000+ municípios do Brasil
// Docs: https://queridodiario.ok.org.br/api/docs
// ============================================================

import { SearchResult, ParsedIntent, SearchFilters } from './types';
import { resolveTerritoryId, getTopSPTerritories } from './ibge-territories';

const QD_BASE_URL = 'https://queridodiario.ok.org.br/api/gazettes';

/** Palavras-chave de construção civil para montar a querystring */
const CONSTRUCTION_KEYWORDS = [
  'alvará', 'licença de construção', 'habite-se', 'aprovação de projeto',
  'edificação', 'demolição', 'terraplenagem', 'loteamento',
  'GRAPROHAB', 'obra', 'construtora', 'empreiteira',
];

/** Resultado bruto da API do Querido Diário */
interface QDGazette {
  territory_id: string;
  territory_name: string;
  state_code: string;
  date: string; // YYYY-MM-DD
  edition?: string;
  is_extra_edition?: boolean;
  url?: string;
  txt_url?: string;
  excerpts?: string[]; // Trechos relevantes com os termos buscados
}

interface QDResponse {
  total_gazettes: number;
  gazettes: QDGazette[];
}

/**
 * Formata data como YYYY-MM-DD
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Monta a querystring a partir das keywords do intent + keywords fixas de construção.
 * Usa OR implícito do Querido Diário.
 */
function buildQueryString(intent: ParsedIntent): string {
  const parts: string[] = [];

  // Adicionar keywords do usuário
  if (intent.keywords.length > 0) {
    const filtered = intent.keywords.filter(k =>
      k.toLowerCase() !== 'obra' &&
      k.toLowerCase() !== 'sp' &&
      k.toLowerCase() !== 'são paulo' &&
      k.length > 2
    );
    parts.push(...filtered);
  }

  // Sempre adicionar pelo menos um termo de construção civil
  if (parts.length === 0) {
    parts.push('alvará', 'construção', 'edificação');
  }

  return parts.join(' ');
}

/**
 * Busca diários oficiais no Querido Diário.
 * Faz buscas em múltiplos territórios de SP em paralelo para maximizar resultados.
 */
async function fetchGazettes(
  querystring: string,
  territoryId: string | undefined,
  publishedSince: string,
  publishedUntil: string,
  size = 20,
): Promise<QDGazette[]> {
  const params = new URLSearchParams({
    querystring,
    published_since: publishedSince,
    published_until: publishedUntil,
    size: String(size),
    excerpt_size: '500', // Tamanho do trecho retornado
    number_of_excerpts: '3', // Até 3 trechos por gazette
    pre_tags: '', // Sem tags de highlight
    post_tags: '',
  });

  if (territoryId) {
    params.set('territory_id', territoryId);
  }

  const url = `${QD_BASE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RadarObras/2.0 (ferramenta de pesquisa de obras)',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!res.ok) {
      console.error(`[QD] HTTP ${res.status} para territory=${territoryId || 'all'}`);
      return [];
    }

    const data: QDResponse = await res.json();
    return data.gazettes || [];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[QD] Fetch error: ${msg}`);
    return [];
  }
}

/**
 * Normaliza um resultado do Querido Diário para SearchResult.
 * Extrai informações estruturadas dos trechos de texto.
 */
function normalizeQDResult(gazette: QDGazette, excerptIndex: number): SearchResult {
  const excerpt = gazette.excerpts?.[excerptIndex] || '';

  // Tentar extrair nome de empresa/construtora do trecho
  const empresaMatch = excerpt.match(
    /(?:construtora|empreiteira|empresa|requerente|interessado[a]?)[:\s]+([A-ZÀ-Ú][A-Za-zÀ-ú\s&.,-]+(?:LTDA|S[./]?A|ME|EPP|EIRELI)?)/i
  );
  const empresa = empresaMatch ? empresaMatch[1].trim() : undefined;

  // Detectar tipo de publicação
  const hasAlvara = /alvará|habite-se|licença.*construção/i.test(excerpt);
  const hasLicenca = /licença.*ambiental|CETESB|licenciamento/i.test(excerpt);

  // Montar título inteligente
  let titulo = '';
  if (hasAlvara) {
    titulo = `Alvará de Construção — ${gazette.territory_name}`;
  } else if (hasLicenca) {
    titulo = `Licença Ambiental — ${gazette.territory_name}`;
  } else {
    titulo = `Publicação de Obras — ${gazette.territory_name}`;
  }
  if (empresa) {
    titulo += ` (${empresa.substring(0, 50)})`;
  }

  // Detectar contato no texto
  const temContato = /\(\d{2}\)\s?\d{4,5}-?\d{4}|[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/i.test(excerpt);

  return {
    id: `qd_${gazette.territory_id}_${gazette.date}_${excerptIndex}`,
    fonte: 'QD',
    titulo,
    descricao: excerpt.substring(0, 400) + (excerpt.length > 400 ? '...' : ''),
    orgao: `Prefeitura de ${gazette.territory_name}`,
    empresa,
    cidade: gazette.territory_name,
    uf: gazette.state_code || 'SP',
    fase: hasAlvara ? 'Alvará Emitido' : hasLicenca ? 'Em Licenciamento' : 'Publicado',
    data_publicacao: gazette.date,
    url_original: gazette.txt_url || gazette.url || `https://queridodiario.ok.org.br/search?territory=${gazette.territory_id}`,
    relevancia: 0, // Será calculado pelo ranker
    tem_contato: temContato,
    tem_alvara: hasAlvara,
  };
}

// ============================================================
// Função principal do provedor
// ============================================================

export async function searchQueridoDiario(
  intent: ParsedIntent,
  filters: SearchFilters
): Promise<SearchResult[]> {
  const dias = filters.dias || 30;
  const agora = new Date();
  const inicio = new Date();
  inicio.setDate(agora.getDate() - dias);

  const publishedSince = formatDateISO(inicio);
  const publishedUntil = formatDateISO(agora);
  const querystring = buildQueryString(intent);

  console.log(`[QD] Buscando: "${querystring}" (${publishedSince} → ${publishedUntil})`);

  // Estratégia: Se o intent tem cidade, buscar naquela cidade.
  // Se não, buscar nas top 5 cidades de SP em paralelo.
  let territoryId: string | undefined;

  if (intent.region) {
    territoryId = resolveTerritoryId(intent.region);
    if (territoryId) {
      console.log(`[QD] Cidade resolvida: ${intent.region} → ${territoryId}`);
    }
  }

  let allGazettes: QDGazette[] = [];

  if (territoryId) {
    // Busca focada em uma cidade
    allGazettes = await fetchGazettes(querystring, territoryId, publishedSince, publishedUntil, 30);
  } else {
    // Busca nas top 5 cidades de SP para maximizar cobertura
    const topTerritories = getTopSPTerritories(5);
    const promises = topTerritories.map(tid =>
      fetchGazettes(querystring, tid, publishedSince, publishedUntil, 10)
    );

    // Também fazer uma busca SEM filtro de território (pega qualquer município de SP)
    promises.push(fetchGazettes(querystring, undefined, publishedSince, publishedUntil, 20));

    const results = await Promise.allSettled(promises);
    for (const res of results) {
      if (res.status === 'fulfilled') {
        allGazettes.push(...res.value);
      }
    }
  }

  console.log(`[QD] Total de gazettes encontradas: ${allGazettes.length}`);

  // Filtrar apenas SP (o provedor pode retornar de outros estados na busca sem território)
  allGazettes = allGazettes.filter(g =>
    g.state_code === 'SP' || !g.state_code // Se não tem state_code, aceitar
  );

  // Normalizar: cada excerpt vira um SearchResult separado
  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();

  for (const gazette of allGazettes) {
    const excerpts = gazette.excerpts || [];
    if (excerpts.length === 0) continue;

    for (let i = 0; i < Math.min(excerpts.length, 2); i++) {
      // Deduplicar por conteúdo
      const excerptKey = excerpts[i].substring(0, 100).toLowerCase().replace(/\s+/g, '');
      if (seenKeys.has(excerptKey)) continue;
      seenKeys.add(excerptKey);

      const result = normalizeQDResult(gazette, i);

      // Filtrar ruído: ignorar trechos muito curtos ou irrelevantes
      if (result.descricao.length < 50) continue;

      results.push(result);
    }
  }

  console.log(`[QD] Resultados normalizados: ${results.length}`);
  return results.slice(0, 50); // Limitar a 50 resultados
}
