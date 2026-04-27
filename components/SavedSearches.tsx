'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import {
  BookmarkPlus,
  Bookmark,
  Trash2,
  RefreshCw,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

interface SavedSearch {
  id: string;
  query: string;
  filters: Record<string, unknown>;
  lastResultCount: number;
  newResultCount: number;
  createdAt: string | null;
  lastRunAt: string | null;
}

interface SavedSearchesProps {
  currentQuery?: string;
  currentFilters?: object;
  currentResultCount?: number;
  onRunSearch: (query: string, filters?: object) => void;
}

export function SavedSearches({
  currentQuery,
  currentFilters,
  currentResultCount,
  onRunSearch,
}: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Carregar buscas salvas
  const fetchSavedSearches = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/search/saved');
      const data = await res.json();
      if (data.success) {
        setSearches(data.searches);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedSearches();
  }, []);

  // Salvar busca atual
  const handleSaveSearch = async () => {
    if (!currentQuery || currentQuery.trim().length < 3 || saving) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await authFetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentQuery,
          filters: currentFilters,
          lastResultCount: currentResultCount || 0,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSaveMessage(data.alreadyExists ? 'Já estava salva!' : 'Busca salva!');
        fetchSavedSearches();
      } else {
        setSaveMessage('Erro ao salvar.');
      }
    } catch {
      setSaveMessage('Erro de conexão.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Remover busca salva
  const handleDelete = async (id: string) => {
    try {
      await authFetch(`/api/search/saved?id=${id}`, { method: 'DELETE' });
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silently fail
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative">
      {/* Botão Salvar Busca Atual */}
      {currentQuery && currentQuery.trim().length >= 3 && (
        <div className="relative inline-block">
          <button
            onClick={handleSaveSearch}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 
                       border border-amber-200 hover:bg-amber-100 rounded-xl transition-all cursor-pointer"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <BookmarkPlus size={14} />
            )}
            Salvar Busca
          </button>
          {saveMessage && (
            <span className="absolute -top-7 left-0 text-[10px] font-bold text-amber-600 bg-amber-50 
                             border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap animate-in fade-in">
              {saveMessage}
            </span>
          )}
        </div>
      )}

      {/* Toggle das buscas salvas */}
      {searches.length > 0 && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 
                     bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer ml-2"
        >
          <Bookmark size={14} />
          Minhas Buscas
          <span className="bg-slate-200 text-slate-700 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {searches.length}
          </span>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}

      {/* Lista de buscas salvas */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Bookmark size={14} className="text-amber-500" />
              Buscas Salvas
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : (
              searches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => {
                        onRunSearch(search.query);
                        setIsOpen(false);
                      }}
                      className="text-sm font-semibold text-slate-800 hover:text-emerald-600 truncate block w-full text-left cursor-pointer transition-colors"
                    >
                      {search.query}
                    </button>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      {search.lastResultCount > 0 && (
                        <span>{search.lastResultCount} resultados</span>
                      )}
                      {search.createdAt && (
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          {formatDate(search.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        onRunSearch(search.query);
                        setIsOpen(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Re-executar busca"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(search.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
