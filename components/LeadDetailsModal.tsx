import React from 'react';
import { Lead } from '@/hooks/useLeads';
import { X, Calendar, MapPin, Building, Activity, FileText } from 'lucide-react';

interface LeadDetailsModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadDetailsModal({ lead, onClose }: LeadDetailsModalProps) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm shadow-2xl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-linear-to-r from-emerald-50/50 to-white">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building className="text-emerald-500" />
            Detalhes da Captação
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{lead.obra}</h3>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800">
              <Activity size={16} />
              {lead.estagio}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 hover:bg-slate-100 p-4 rounded-xl border border-slate-100 transition-colors">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                <Building size={14} /> Construtora
              </span>
              <p className="font-medium text-slate-800">{lead.construtora}</p>
            </div>
            
            <div className="bg-slate-50 hover:bg-slate-100 p-4 rounded-xl border border-slate-100 transition-colors">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                <Calendar size={14} /> Descoberta em
              </span>
              <p className="font-medium text-slate-800">
                {lead.createdAt ? new Date(lead.createdAt).toLocaleString('pt-BR') : 'Data Indisponível'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 hover:bg-slate-100 p-4 rounded-xl border border-slate-100 transition-colors">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
              <MapPin size={14} /> Localização
            </span>
            <p className="font-medium text-slate-800">
              {lead.endereco_aproximado} - {lead.cidade}
            </p>
            <div className="mt-2 text-xs font-mono text-slate-400">
              Lat: {lead.lat.toFixed(4)} | Lng: {lead.lng.toFixed(4)}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
              <FileText size={14} /> Texto Bruto da Publicação
            </span>
            {lead.textoBruto ? (
              <blockquote className="bg-slate-800 text-slate-200 p-4 rounded-xl border-l-4 border-emerald-500 text-sm whitespace-pre-wrap font-mono shadow-inner overflow-x-auto">
                {lead.textoBruto}
              </blockquote>
            ) : (
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm text-slate-500 italic flex items-center justify-center">
                O texto bruto originário desta captação não está disponível.
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
