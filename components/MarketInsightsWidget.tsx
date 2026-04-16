'use client';

import React, { useEffect, useState } from 'react';
import { Lightbulb, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';

export function MarketInsightsWidget() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/insights');
        const data = await res.json();
        
        if (data.success) {
          setInsight(data.insight);
        } else {
          setError(data.error || 'Erro ao carregar insights.');
        }
      } catch (err) {
        setError('Falha de conexão com a API de insights.');
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
    
    // Refresh desativado temporariamente (projeto em pausa)
    // const interval = setInterval(fetchInsights, 3600000);
    // return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-violet-50 to-emerald-50 border border-violet-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
      {/* Decoração bg */}
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <TrendingUp size={100} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-white p-2 rounded-xl shadow-sm">
            <Sparkles className="text-violet-500" size={18} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Resumo do Mercado (48H)</h2>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full lowercase tracking-wider">
            Powered by IA
          </span>
        </div>
        
        <div className="text-slate-700 text-sm leading-relaxed font-medium">
          {loading ? (
            <div className="animate-pulse flex flex-col gap-2">
              <div className="h-4 bg-violet-200/50 rounded w-full"></div>
              <div className="h-4 bg-violet-200/50 rounded w-5/6"></div>
            </div>
          ) : (
            <p>{insight}</p>
          )}
        </div>
      </div>
    </div>
  );
}
