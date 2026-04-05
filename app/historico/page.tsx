'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadDetailsModal } from '@/components/LeadDetailsModal';
import { Search, Building, MapPin, Calendar, Activity, Eye, FileSpreadsheet } from 'lucide-react';

export default function HistoricoPage() {
  const { leads, loading } = useLeads();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);

  const filteredAndSortedLeads = [...leads]
    .filter(lead => 
      lead.obra.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.construtora.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.cidade.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 h-full max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 mb-2 flex items-center gap-3">
              <span className="w-12 h-12 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FileSpreadsheet className="text-white w-6 h-6" />
              </span>
              Histórico de Obras
            </h1>
            <p className="text-slate-500 text-sm mt-2">Base de dados completa e centralizada de todas as captações mineradas pelo sistema.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar por obra, construtora, cidade..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-sm transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition-colors shadow-sm cursor-pointer w-full sm:w-auto"
            >
              <Calendar className="w-4 h-4 text-emerald-500" />
              {sortOrder === 'desc' ? 'Data: Mais Recentes' : 'Data: Mais Antigas'}
            </button>
          </div>

          <div className="overflow-x-auto flex-1 h-[0]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 p-8">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Carregando base de dados...</span>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 sticky top-0 border-b border-slate-200 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 font-bold">Data</th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:text-slate-700 transition">Obra</th>
                    <th className="px-6 py-4 font-bold">Construtora</th>
                    <th className="px-6 py-4 font-bold">Local</th>
                    <th className="px-6 py-4 font-bold">Estágio</th>
                    <th className="px-6 py-4 font-bold text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedLeads.length > 0 ? (
                    filteredAndSortedLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-emerald-50/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 line-clamp-2 max-w-xs" title={lead.obra}>{lead.obra}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 w-max">
                            <Building size={14} className="text-slate-400 shrink-0" />
                            <span className="line-clamp-1 max-w-[200px]" title={lead.construtora}>{lead.construtora}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 w-max">
                            <MapPin size={14} className="text-emerald-500 shrink-0" />
                            <span className="line-clamp-2 max-w-[200px]" title={`${lead.endereco_aproximado} - ${lead.cidade}`}>
                               {lead.cidade}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-200">
                            <Activity size={12} className="text-slate-400" />
                            {lead.estagio}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button 
                            onClick={() => setDetailsLead(lead)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer inline-flex"
                            title="Ver Detalhes"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Search className="w-8 h-8 text-slate-300" />
                          <p>Nenhuma captação atende a estes critérios de busca.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      
      <LeadDetailsModal lead={detailsLead} onClose={() => setDetailsLead(null)} />
    </DashboardLayout>
  );
}
