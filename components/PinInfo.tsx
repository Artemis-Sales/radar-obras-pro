import React from 'react';
import { Lead } from '@/hooks/useLeads';
import { Building2, MapPin, Clock, ArrowRight } from 'lucide-react';

interface PinInfoProps {
  lead: Lead;
  onClose?: () => void;
  onDetails?: () => void;
}

export function PinInfo({ lead, onClose, onDetails }: PinInfoProps) {
  return (
    <div className="w-72 bg-white rounded-xl overflow-hidden font-sans">
      <div className="bg-linear-to-r from-emerald-500 to-emerald-600 p-4 text-white">
        <h3 className="font-bold text-lg leading-tight line-clamp-2" title={lead.obra}>
          {lead.obra}
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2 text-slate-600">
          <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
          <span className="text-sm font-medium line-clamp-1" title={lead.construtora}>
            {lead.construtora}
          </span>
        </div>
        
        <div className="flex items-start gap-2 text-slate-600">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{lead.cidade}</span>
            <span className="text-xs text-slate-500 line-clamp-2" title={lead.endereco_aproximado}>
              {lead.endereco_aproximado}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-100">
          <Clock className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            {lead.estagio}
          </span>
        </div>
        
        <button 
          className="w-full mt-3 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          onClick={() => {
            if (onDetails) onDetails();
          }}
        >
          Ver Detalhes
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
