// ============================================================
// Radar de Obras PRO — Motor de Busca Multi-Fonte
// Tipos compartilhados entre provedores de dados
// ============================================================

/** Fontes de dados suportadas */
export type SearchSource = 'PNCP' | 'DOE-SP' | 'CETESB' | 'Places';

/** Resultado normalizado retornado por qualquer provedor */
export interface SearchResult {
  id: string;
  fonte: SearchSource;
  titulo: string;
  descricao: string;
  orgao: string;
  empresa?: string;
  cidade: string;
  uf: string;
  valor_estimado?: number;
  valor_homologado?: number;
  fase: string;
  data_publicacao: string;
  url_original: string;
  relevancia: number; // 0-100, calculado pelo ranker

  // Novos campos Inteligência B2B
  motivo_recomendacao?: string; // Ex: Alvará Liberado + Contato Mapeado
  tem_contato?: boolean;
  tem_alvara?: boolean;

  modalidade?: string;
  numero_controle?: string;
  data_abertura?: string;
  data_encerramento?: string;
}

/** Filtros aplicáveis à busca */
export interface SearchFilters {
  uf?: string;
  cidade?: string;
  tipo_obra?: string[];
  valor_min?: number;
  valor_max?: number;
  dias?: number; // lookback em dias (padrão 30)
  fontes?: SearchSource[];
  modalidade?: string;
}

/** Intenção extraída da query em linguagem natural */
export interface ParsedIntent {
  keywords: string[];
  region?: string;
  uf?: string;
  tipo_obra?: string;
  fase?: string;
  valor_min?: number;
  valor_max?: number;
}

/** Resposta padronizada do motor de busca */
export interface SearchResponse {
  success: boolean;
  query: string;
  intent: ParsedIntent;
  results: SearchResult[];
  total_by_source: Record<SearchSource, number>;
  total: number;
  tempo_ms: number;
  error?: string;
}

// ============================================================
// Tipos crus da API do PNCP (reverse-engineered from OpenAPI)
// ============================================================

export interface PNCPOrgaoEntidade {
  cnpj: string;
  razaoSocial: string;
  poderId: string;
  esferaId: string;
}

export interface PNCPUnidadeOrgao {
  ufNome: string;
  codigoIbge: string;
  codigoUnidade: string;
  ufSigla: string;
  municipioNome: string;
  nomeUnidade: string;
}

export interface PNCPAmparoLegal {
  codigo: number;
  nome: string;
  descricao: string;
}

export interface PNCPContratacao {
  dataAtualizacao: string;
  orgaoEntidade: PNCPOrgaoEntidade;
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra: string;
  processo: string;
  objetoCompra: string;
  orgaoSubRogado: PNCPOrgaoEntidade | null;
  unidadeOrgao: PNCPUnidadeOrgao;
  unidadeSubRogada: PNCPUnidadeOrgao | null;
  valorTotalHomologado: number | null;
  srp: boolean;
  dataInclusao: string;
  amparoLegal: PNCPAmparoLegal;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  informacaoComplementar: string | null;
  linkSistemaOrigem: string | null;
  dataPublicacaoPncp: string;
  modalidadeId: number;
  linkProcessoEletronico: string | null;
  numeroControlePNCP: string;
  tipoInstrumentoConvocatorioCodigo: number;
  valorTotalEstimado: number | null;
  modalidadeNome: string;
  modoDisputaNome: string;
  situacaoCompraId: string;
  situacaoCompraNome: string;
  tipoInstrumentoConvocatorioNome: string;
}

export interface PNCPPaginatedResponse {
  data: PNCPContratacao[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

// Mapeamento de modalidades do PNCP
export const PNCP_MODALIDADES: Record<number, string> = {
  1: 'Pregão - Eletrônico',
  2: 'Pregão - Presencial',
  3: 'Concorrência - Presencial',
  4: 'Concorrência - Eletrônica',
  5: 'Diálogo Competitivo',
  6: 'Concurso',
  7: 'Leilão - Eletrônico',
  8: 'Dispensa',
  9: 'Inexigibilidade',
  10: 'Leilão - Presencial',
  11: 'Manifestação de Interesse',
  12: 'Pré-qualificação',
  13: 'Credenciamento',
};

// Modalidades mais relevantes para obras de engenharia civil
export const MODALIDADES_OBRAS = [1, 2, 3, 4, 5, 8, 9];
