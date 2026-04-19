import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MapWidget } from '@/components/MapWidget';
import { KanbanBoard } from '@/components/KanbanBoard';
import { MarketInsightsWidget } from '@/components/MarketInsightsWidget';
import { SearchWidget } from '@/components/ui/SearchWidget';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 h-full max-w-7xl mx-auto">
        {/* Hero Search Section */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-900 rounded-3xl p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white mb-2">
                🔍 Prospecção de Obras
              </h1>
              <p className="text-slate-400 text-sm mb-4 max-w-md">
                Busque licitações reais no PNCP, Diário Oficial e CETESB. 
                Encontre oportunidades de obras em todo o Brasil com IA.
              </p>
              <SearchWidget />
            </div>
            <div className="hidden md:flex flex-col items-end gap-2 text-right">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 bg-blue-400 rounded-full" />
                PNCP — Licitações Públicas
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                DOE-SP — Diário Oficial
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                CETESB — Licenças Ambientais
              </div>
            </div>
          </div>
        </div>
        
        {/* Insights Section */}
        <section className="shrink-0 flex flex-col gap-3">
          <MarketInsightsWidget />
        </section>

        {/* Map Section */}
        <section className="shrink-0 flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-emerald-400 rounded-full"></span>
              Mapa de Oportunidades
            </h2>
          </div>
          <MapWidget />
        </section>

        {/* Kanban Section */}
        <section id="kanban" className="flex-1 flex flex-col gap-3 min-h-[500px]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-blue-400 rounded-full"></span>
              Funil de Negociação
            </h2>
          </div>
          <KanbanBoard />
        </section>
      </div>
    </DashboardLayout>
  );
}
