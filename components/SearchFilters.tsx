'use client';

import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface FilterState {
  uf: string;
  dias: number;
  valor_min: string;
  valor_max: string;
  fontes: string[];
}

interface SearchFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalBySource?: Record<string, number>;
  isOpen: boolean;
  onToggle: () => void;
}

const UF_OPTIONS = [
  '', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ',
  'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const FONTE_OPTIONS = [
  { value: 'PNCP', label: 'PNCP (Licitações)', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'DOE-SP', label: 'DOE-SP (Diário Oficial)', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'CETESB', label: 'CETESB (Licenças)', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'QD', label: 'Querido Diário (Municípios)', color: 'bg-violet-100 text-violet-800 border-violet-200' },
];

const PERIODO_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias' },
];

export function SearchFilters({
  filters,
  onChange,
  totalBySource,
  isOpen,
  onToggle,
}: SearchFiltersProps) {
  const updateFilter = (key: keyof FilterState, value: unknown) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleFonte = (fonte: string) => {
    const current = [...filters.fontes];
    const idx = current.indexOf(fonte);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(fonte);
    }
    updateFilter('fontes', current.length > 0 ? current : ['PNCP', 'DOE-SP', 'CETESB', 'QD']);
  };

  const activeFiltersCount = [
    filters.uf,
    filters.valor_min,
    filters.valor_max,
    filters.dias !== 30 ? 'dias' : '',
    filters.fontes.length < 4 ? 'fontes' : '',
  ].filter(Boolean).length;

  return (
    <div className="relative">
      {/* Botão Toggle */}
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all cursor-pointer
          ${
            isOpen
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          }`}
      >
        <SlidersHorizontal size={16} />
        Filtros
        {activeFiltersCount > 0 && (
          <span className="bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Painel de Filtros */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800">Filtros de Busca</h3>
            <button
              onClick={onToggle}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-5">
            {/* Período */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Período
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PERIODO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter('dias', opt.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer
                      ${
                        filters.dias === opt.value
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Estado (UF)
              </label>
              <select
                value={filters.uf}
                onChange={(e) => updateFilter('uf', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              >
                <option value="">Todos os estados</option>
                {UF_OPTIONS.filter(Boolean).map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            {/* Faixa de Valor */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Faixa de Valor (R$)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={filters.valor_min}
                  onChange={(e) => updateFilter('valor_min', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-400"
                />
                <span className="text-slate-400 text-sm">—</span>
                <input
                  type="number"
                  placeholder="Máximo"
                  value={filters.valor_max}
                  onChange={(e) => updateFilter('valor_max', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Fontes */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Fontes de Dados
              </label>
              <div className="flex flex-col gap-2">
                {FONTE_OPTIONS.map((fonte) => {
                  const isActive = filters.fontes.includes(fonte.value);
                  const count = totalBySource?.[fonte.value] || 0;
                  return (
                    <button
                      key={fonte.value}
                      onClick={() => toggleFonte(fonte.value)}
                      className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer
                        ${
                          isActive
                            ? fonte.color
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                    >
                      <span>{fonte.label}</span>
                      {count > 0 && (
                        <span className="text-[10px] opacity-70">
                          {count} resultado{count > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
