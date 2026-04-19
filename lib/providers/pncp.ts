// ============================================================
// Provedor PNCP — Portal Nacional de Contratações Públicas
// API pública, gratuita, sem autenticação
// Docs: https://pncp.gov.br/api/consulta/swagger-ui/index.html
// ============================================================

import {
  PNCPPaginatedResponse,
  PNCPContratacao,
  SearchResult,
  SearchFilters,
  ParsedIntent,
  MODALIDADES_OBRAS,
} from './types';

const PNCP_BASE_URL = 'https://pncp.gov.br/api/consulta/v1';

/** Formata Date para AAAAMMDD (formato exigido pelo PNCP) */
function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Busca contrataçoes no PNCP por modalidade, com filtros opcionais */
async function fetchContratacoes(
  modalidade: number,
  dataInicial: string,
  dataFinal: string,
  filters: SearchFilters,
  pagina = 1,
  tamanhoPagina = 50
): Promise<PNCPPaginatedResponse | null> {
  const params = new URLSearchParams({
    dataInicial,
    dataFinal,
    codigoModalidadeContratacao: String(modalidade),
    pagina: String(pagina),
    tamanhoPagina: String(tamanhoPagina),
  });

  if (filters.uf) {
    params.set('uf', filters.uf);
  }

  const url = `${PNCP_BASE_URL}/contratacoes/publicacao?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!res.ok) {
      console.error(`[PNCP] HTTP ${res.status} para modalidade ${modalidade}`);
      return null;
    }

    return (await res.json()) as PNCPPaginatedResponse;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[PNCP] Fetch error: ${msg}`);
    return null;
  }
}

/**
 * Palavras-chave de construção civil usadas para filtrar resultados
 * irrelevantes (ex: "material de consumo", "medicamentos")
 */
const KEYWORDS_OBRAS = [
  'obra', 'construç', 'reform', 'paviment', 'asfalto', 'recapeamento',
  'saneamento', 'drenagem', 'terraplen', 'edific', 'prédio',
  'escola', 'hospital', 'ubs', 'ponte', 'viaduto', 'rodovia',
  'estrada', 'galeria', 'esgoto', 'água', 'hidráulic', 'elétric',
  'iluminação', 'urbaniz', 'infraestrutura', 'loteamento',
  'condomínio', 'residencial', 'habitacional', 'creche',
  'ginásio', 'quadra', 'praça', 'calçad', 'muro', 'cerca',
  'cobertura', 'telhado', 'pintura', 'fundação', 'estacas',
  'contenção', 'engenharia', 'execução', 'implantação',
  'ampliação', 'restauração', 'recuperação', 'demolição',
  'terraplanagem', 'concretagem', 'alvenaria', 'galpão',
  'reservatório', 'poço', 'barragem', 'canal', 'emissário',
];

/** Verifica se o objeto da contratação é relevante para construção civil */
function isObraRelevante(objeto: string): boolean {
  const lower = objeto.toLowerCase();
  return KEYWORDS_OBRAS.some(kw => lower.includes(kw));
}

/** Verifica se o resultado casa com as keywords extraídas da query */
function matchesKeywords(objeto: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const lower = objeto.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/** Verifica se o município bate com a região buscada */
function matchesRegion(contratacao: PNCPContratacao, intent: ParsedIntent): boolean {
  if (!intent.region) return true;

  const regionLower = intent.region.toLowerCase();
  const municipio = (contratacao.unidadeOrgao?.municipioNome || '').toLowerCase();
  const ufNome = (contratacao.unidadeOrgao?.ufNome || '').toLowerCase();
  const orgao = (contratacao.orgaoEntidade?.razaoSocial || '').toLowerCase();

  return (
    municipio.includes(regionLower) ||
    regionLower.includes(municipio) ||
    ufNome.includes(regionLower) ||
    orgao.includes(regionLower)
  );
}

/** Converte uma contratação crua do PNCP para nosso SearchResult */
function normalizePNCP(item: PNCPContratacao): SearchResult {
  const cnpj = item.orgaoEntidade?.cnpj || '';
  const seq = item.sequencialCompra || 0;
  const ano = item.anoCompra || 0;

  // Build a direct link to the PNCP page
  const urlPncp = `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;

  return {
    id: `pncp_${item.numeroControlePNCP || `${cnpj}_${ano}_${seq}`}`,
    fonte: 'PNCP',
    titulo: item.objetoCompra || 'Contratação sem objeto definido',
    descricao: [
      item.modalidadeNome,
      item.amparoLegal?.nome,
      item.informacaoComplementar,
    ].filter(Boolean).join(' · '),
    orgao: item.orgaoEntidade?.razaoSocial || 'Órgão não identificado',
    cidade: item.unidadeOrgao?.municipioNome || '',
    uf: item.unidadeOrgao?.ufSigla || '',
    valor_estimado: item.valorTotalEstimado || undefined,
    valor_homologado: item.valorTotalHomologado || undefined,
    fase: item.situacaoCompraNome || 'Divulgada',
    data_publicacao: item.dataPublicacaoPncp || item.dataInclusao || '',
    url_original: item.linkSistemaOrigem || urlPncp,
    relevancia: 0, // será calculado pelo ranker
    modalidade: item.modalidadeNome,
    numero_controle: item.numeroControlePNCP,
    data_abertura: item.dataAberturaProposta || undefined,
    data_encerramento: item.dataEncerramentoProposta || undefined,
  };
}

// ============================================================
// Função principal do provedor
// ============================================================

export async function searchPNCP(
  intent: ParsedIntent,
  filters: SearchFilters
): Promise<SearchResult[]> {
  const dias = filters.dias || 30;
  const agora = new Date();
  const inicio = new Date();
  inicio.setDate(agora.getDate() - dias);

  const dataInicial = formatDatePNCP(inicio);
  const dataFinal = formatDatePNCP(agora);

  // Decidir quais modalidades consultar (em paralelo para performance)
  const modalidades = MODALIDADES_OBRAS;

  // Buscar todas as modalidades em paralelo (página 1 de cada)
  const promises = modalidades.map(mod =>
    fetchContratacoes(mod, dataInicial, dataFinal, filters, 1, 50)
  );

  const responses = await Promise.allSettled(promises);

  const allItems: PNCPContratacao[] = [];

  for (const res of responses) {
    if (res.status === 'fulfilled' && res.value && !res.value.empty) {
      allItems.push(...res.value.data);
    }
  }

  // Filtrar por relevância: apenas itens de construção civil
  let filtered = allItems.filter(item => {
    const objeto = item.objetoCompra || '';

    // Deve ser relevante para construção civil
    if (!isObraRelevante(objeto)) return false;

    // Deve casar com as keywords da query
    if (!matchesKeywords(objeto, intent.keywords)) return false;

    // Deve casar com a região buscada
    if (!matchesRegion(item, intent)) return false;

    // Filtro de valor
    if (filters.valor_min && (item.valorTotalEstimado || 0) < filters.valor_min) return false;
    if (filters.valor_max && (item.valorTotalEstimado || 0) > filters.valor_max) return false;

    return true;
  });

  // Limitar a 100 resultados para performance
  filtered = filtered.slice(0, 100);

  // Normalizar para nosso schema
  return filtered.map(normalizePNCP);
}
