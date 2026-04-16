'use client';

import React, { useState } from 'react';
import { Search, Loader2, Trash2 } from 'lucide-react';

export function SearchWidget({ onSearchComplete }: { onSearchComplete?: () => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading || clearing) return;

    setLoading(true);
    setResultMessage(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const body = await res.json();
      
      if (body.success) {
        setResultMessage(`Encontrados ${body.newLeads.length} de ${body.placesFound} lugares novos na região de "${body.extracted?.region}".`);
        if (onSearchComplete) onSearchComplete();
        setQuery('');
      } else {
        setResultMessage(`Erro: ${body.error}`);
      }
    } catch (error: any) {
      setResultMessage('Erro ao processar a busca criativa.');
    } finally {
      setLoading(false);
      
      // Limpa mensagem de sucesso apos alguns segundos
      setTimeout(() => {
        setResultMessage(null);
      }, 5000);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Tem certeza que deseja excluir TODOS os leads obtidos através da busca ativa? Esta ação não pode ser desfeita.')) {
      return;
    }

    setClearing(true);
    setResultMessage(null);

    try {
      const res = await fetch('/api/leads/clear-search', {
        method: 'DELETE'
      });
      const body = await res.json();
      
      if (body.success) {
        setResultMessage(`${body.message}`);
        if (onSearchComplete) onSearchComplete();
      } else {
        setResultMessage(`Erro ao limpar leads: ${body.error}`);
      }
    } catch (error: any) {
      setResultMessage('Erro de conexão ao remover leads.');
    } finally {
      setClearing(false);
      setTimeout(() => {
        setResultMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="relative w-full max-w-lg flex gap-2">
      <form onSubmit={handleSearch} className="relative z-10 flex-1 flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca Inteligente Ex: Obras de saneamento em SP..."
          className="w-full pl-5 pr-14 py-3 bg-white border border-slate-200 rounded-full shadow-sm text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-400 disabled:opacity-50"
          disabled={loading || clearing}
        />
        <button
          type="submit"
          disabled={loading || clearing || !query.trim()}
          className="absolute right-2 p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-full transition-colors cursor-pointer"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </button>
      </form>

      <button
        type="button"
        onClick={handleClear}
        disabled={loading || clearing}
        title="Limpar todos os leads resultantes de busca"
        className="shrink-0 flex items-center justify-center w-12 h-12 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-all shadow-sm cursor-pointer"
      >
        {clearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
      </button>
      
      {resultMessage && (
        <div className={`absolute top-full left-0 mt-2 p-3 text-xs rounded-xl shadow-lg border z-20 w-auto min-w-[300px] animate-in fade-in slide-in-from-top-2 ${resultMessage.includes('Erro') ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
          {resultMessage}
        </div>
      )}
    </div>
  );
}
