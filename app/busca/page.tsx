'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SearchResultCard } from '@/components/SearchResultCard';
import { SearchFilters } from '@/components/SearchFilters';
import { SavedSearches } from '@/components/SavedSearches';
import {
  Search,
  Loader2,
  Landmark,
  FileText,
  Zap,
  ArrowRight,
  Timer,
  Database,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface SearchResultData {
  id: string;
  fonte: string;
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
  relevancia: number;
  modalidade?: string;
  numero_controle?: string;
  data_abertura?: string;
  data_encerramento?: string;
}

interface SearchResponseData {
  success: boolean;
  query: string;
  intent: {
    keywords: string[];
    region?: string;
    uf?: string;
    tipo_obra?: string;
    fase?: string;
  };
  results: SearchResultData[];
  total_by_source: Record<string, number>;
  total: number;
  tempo_ms: number;
  error?: string;
}

interface FilterState {
  uf: string;
  dias: number;
  valor_min: string;
  valor_max: string;
  fontes: string[];
}

const SEARCH_SUGGESTIONS = [
  'Obras de saneamento em São Paulo',
  'Pavimentação rodoviária no interior de SP',
  'Construção de escolas em Campinas',
  'Licitações de hospitais no Nordeste',
  'Reforma de prédios públicos em MG',
  'Obras de drenagem e infraestrutura',
];

export default function BuscaPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    uf: '',
    dias: 30,
    valor_min: '',
    valor_max: '',
    fontes: ['PNCP', 'DOE-SP', 'CETESB'],
  });
  const hasAutoSearched = useRef(false);

  // Auto-busca quando vem do dashboard com ?q=
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      setQuery(q);
      // Small delay to ensure state is set
      setTimeout(() => performSearch(q), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const performSearch = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery || query;
      if (!q.trim() || loading) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: q,
            filters: {
              dias: filters.dias,
              uf: filters.uf || undefined,
              valor_min: filters.valor_min ? Number(filters.valor_min) : undefined,
              valor_max: filters.valor_max ? Number(filters.valor_max) : undefined,
              fontes: filters.fontes,
            },
          }),
        });

        const data: SearchResponseData = await res.json();

        if (data.success) {
          setResponse(data);
          // Salvar no histórico local
          setSearchHistory((prev) => {
            const updated = [q, ...prev.filter((h) => h !== q)].slice(0, 10);
            try { localStorage.setItem('search_history', JSON.stringify(updated)); } catch {}
            return updated;
          });
        } else {
          setError(data.error || 'Erro ao processar a busca.');
        }
      } catch (err: unknown) {
        setError('Erro de conexão. Tente novamente.');
      } finally {
        setLoading(false);
      }
    },
    [query, filters, loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  const handleSaveLead = async (result: SearchResultData) => {
    setSavedIds((prev) => new Set(prev).add(result.id));
  };

  // Re-executar busca quando filtros mudam
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    if (response && query.trim()) {
      // Debounce re-search
      setTimeout(() => performSearch(), 300);
    }
  };

  // Executar busca a partir de buscas salvas ou histórico
  const handleRunSavedSearch = (savedQuery: string) => {
    setQuery(savedQuery);
    performSearch(savedQuery);
  };

  // Carregar histórico do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('search_history');
      if (stored) setSearchHistory(JSON.parse(stored));
    } catch {}
  }, []);

  const hasResults = response && response.results.length > 0;
  const showHero = !loading && !response;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
        {/* Hero Section (antes da primeira busca) */}
        {showHero && (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full blur-3xl opacity-10 scale-150" />
              <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Search size={36} className="text-white" />
              </div>
            </div>

            <h1 className="text-4xl font-black text-slate-800 text-center mb-3">
              Encontre Obras em Todo o Brasil
            </h1>
            <p className="text-slate-500 text-center max-w-lg mb-10 text-[15px] leading-relaxed">
              Busca inteligente em licitações do PNCP, Diário Oficial e CETESB.
              Resultados reais com valores, prazos e links diretos para os editais.
            </p>

            {/* Fontes de dados */}
            <div className="flex items-center gap-6 mb-10 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <Landmark size={14} className="text-blue-400" />
                PNCP
              </span>
              <span className="flex items-center gap-1.5">
                <FileText size={14} className="text-amber-400" />
                Diário Oficial
              </span>
              <span className="flex items-center gap-1.5">
                <Zap size={14} className="text-green-400" />
                CETESB
              </span>
            </div>
          </div>
        )}

        {/* Barra de Busca */}
        <div
          className={`w-full ${showHero ? '' : 'sticky top-0 z-30 pt-2 pb-4 bg-slate-50/80 backdrop-blur-lg'}`}
        >
          <form onSubmit={handleSubmit} className="relative">
            <div
              className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm 
                          focus-within:border-emerald-400 focus-within:shadow-lg focus-within:shadow-emerald-500/10 
                          transition-all duration-300"
            >
              <div className="pl-5 pr-2 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: obras de saneamento em Campinas, hospitais no RJ..."
                className="flex-1 py-4 px-2 text-[15px] text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
                disabled={loading}
              />
              <div className="pr-2">
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 
                             text-white font-bold text-sm rounded-xl transition-all cursor-pointer
                             shadow-sm hover:shadow-md disabled:shadow-none"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      Buscar <ArrowRight size={15} />
                    </span>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Sugestões (apenas no hero) */}
          {showHero && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {SEARCH_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 
                             rounded-full hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 
                             transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Filtros + Stats (após busca) */}
          {response && (
            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <SearchFilters
                  filters={filters}
                  onChange={handleFilterChange}
                  totalBySource={response.total_by_source}
                  isOpen={filtersOpen}
                  onToggle={() => setFiltersOpen(!filtersOpen)}
                />

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Database size={13} />
                    <strong className="text-slate-700">{response.total}</strong> resultados
                  </span>
                  <span className="flex items-center gap-1">
                    <Timer size={13} />
                    {(response.tempo_ms / 1000).toFixed(1)}s
                  </span>
                </div>

                {/* Buscas Salvas */}
                <SavedSearches
                  currentQuery={response.query}
                  currentFilters={filters}
                  currentResultCount={response.total}
                  onRunSearch={handleRunSavedSearch}
                />
              </div>
            </div>
          )}

          {/* Legenda de Prioridades B2B */}
          {response && hasResults && (
            <div className="mt-6 mb-2 flex flex-col md:flex-row items-start md:items-center justify-between bg-blue-50/50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[13px] text-blue-800 font-medium">
                <Info size={16} className="text-blue-500" />
                <span>Critérios de Prioridade B2B do Radar:</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 md:mt-0 text-[11px] font-bold uppercase tracking-wide">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md">
                  <span className="text-red-500 text-xs">🔴</span> Score Máximo (Alvará ou Prioridade)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md">
                  <span className="text-orange-500 text-xs">🟠</span> Alto (Com Contato)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md">
                  <span className="text-yellow-500 text-xs">🟡</span> Médio (Grande Porte)
                </span>
              </div>
            </div>
          )}

          {/* Intenção interpretada */}
          {response && response.intent && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
              <Sparkles size={13} className="text-violet-400" />
              <span>
                IA buscou:{' '}
                <strong className="text-slate-600">
                  {response.intent.keywords?.join(', ')}
                </strong>
                {response.intent.region && (
                  <span>
                    {' '}em <strong className="text-slate-600">{response.intent.region}</strong>
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20 animate-pulse" />
              <Loader2 size={40} className="text-emerald-500 animate-spin relative" />
            </div>
            <p className="mt-6 text-sm font-semibold text-slate-500">
              Consultando fontes oficiais...
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Landmark size={12} className="text-blue-400" /> PNCP
              </span>
              <span className="flex items-center gap-1">
                <FileText size={12} className="text-amber-400" /> DOE-SP
              </span>
              <span className="flex items-center gap-1">
                <Zap size={12} className="text-green-400" /> CETESB
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mx-auto max-w-md mt-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center animate-in fade-in">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {response && response.results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Search size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-1">
              Nenhum resultado encontrado
            </p>
            <p className="text-xs text-slate-400 max-w-md text-center">
              Tente termos mais genéricos como &quot;obras em SP&quot; ou aumente o período nos filtros.
            </p>
          </div>
        )}

        {/* Resultados */}
        {hasResults && !loading && (
          <div className="flex flex-col gap-3 mt-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Bar */}
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                {Object.entries(response!.total_by_source)
                  .filter(([, count]) => count > 0)
                  .map(([source, count]) => (
                    <span
                      key={source}
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        source === 'PNCP'
                          ? 'bg-blue-50 text-blue-600'
                          : source === 'DOE-SP'
                            ? 'bg-amber-50 text-amber-600'
                            : source === 'CETESB'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-purple-50 text-purple-600'
                      }`}
                    >
                      {source}: {count}
                    </span>
                  ))}
              </div>
            </div>

            {/* Result Cards */}
            {response!.results.map((result) => (
              <SearchResultCard
                key={result.id}
                result={result}
                queryOriginal={response!.query}
                onSaveLead={handleSaveLead}
                isSaved={savedIds.has(result.id)}
              />
            ))}

            {/* Load More hint */}
            {response!.total > response!.results.length && (
              <div className="text-center py-4 text-xs text-slate-400">
                Mostrando {response!.results.length} de {response!.total} resultados.
                Refine os filtros para ver resultados mais relevantes.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
