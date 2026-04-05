import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MapWidget } from '@/components/MapWidget';
import { KanbanBoard } from '@/components/KanbanBoard';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 h-full max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">Monitoramento de Obras</h1>
            <p className="text-slate-500 text-sm">Acompanhe as captações e gerencie seu funil de prospecção do estado de São Paulo.</p>
          </div>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all text-sm">
            + Novo Lead Manual
          </button>
        </div>
        
        {/* Map Section */}
        <section className="shrink-0 flex flex-col gap-3">
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
