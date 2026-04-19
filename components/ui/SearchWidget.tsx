'use client';

import React, { useState } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SearchWidget() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    // Redirecionar para a página de busca com a query
    router.push(`/busca?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-xl flex items-center group">
      <div
        className="relative flex items-center w-full bg-white rounded-2xl border border-slate-200 
                    shadow-sm group-focus-within:border-emerald-400 group-focus-within:shadow-lg 
                    group-focus-within:shadow-emerald-500/10 transition-all duration-300"
      >
        <div className="pl-4 pr-2 text-slate-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar obras, licitações, saneamento em SP..."
          className="flex-1 py-3 px-1 text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
          disabled={loading}
        />
        <div className="pr-2">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 
                       text-white font-bold text-xs rounded-xl transition-all cursor-pointer
                       shadow-sm hover:shadow-md disabled:shadow-none flex items-center gap-1"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                Buscar <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
