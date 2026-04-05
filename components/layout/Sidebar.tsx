import React from 'react';
import Link from 'next/link';
import { Home, KanbanSquare, Table2, Settings } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-8 shadow-2xl z-20">
      <div className="text-2xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400 mb-12">
        Radar PRO
      </div>
      <nav className="w-full px-4 flex flex-col gap-2">
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors">
          <Home size={20} />
          <span className="font-medium">Dashboard</span>
        </Link>
        <Link href="/dashboard#kanban" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors">
          <KanbanSquare size={20} />
          <span className="font-medium">CRM Pipelines</span>
        </Link>
        <Link href="/historico" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors">
          <Table2 size={20} />
          <span className="font-medium">Histórico de Obras</span>
        </Link>
        <Link href="/perfil" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors mt-auto">
          <Settings size={20} />
          <span className="font-medium">Minha Conta</span>
        </Link>
      </nav>
    </aside>
  );
}
