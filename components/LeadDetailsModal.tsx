import React, { useState } from 'react';
import { Lead, deleteLead } from '@/hooks/useLeads';
import { X, Calendar, MapPin, Building, Activity, FileText, Globe, Phone, Sparkles, Loader2, Trash2 } from 'lucide-react';

interface LeadDetailsModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadDetailsModal({ lead, onClose }: LeadDetailsModalProps) {
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!lead) return null;

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichError(null);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          construtora: lead.construtora,
          cidade: lead.cidade
        })
      });
      const data = await res.json();
      if (!data.success) {
        setEnrichError(data.error || 'Falha ao enriquecer.');
      }
    } catch (err: any) {
      setEnrichError('Erro de conexão ao enriquecer dados.');
    } finally {
      setEnriching(false);
    }
  };

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
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">{lead.obra}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800">
                  <Activity size={16} />
                  {lead.estagio}
                </span>
                {lead.urlOrigem && (
                  <a href={lead.urlOrigem} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
                    <Globe size={16} />
                    Ver Fonte Original
                  </a>
                )}
              </div>
            </div>
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
              Lat: {lead.lat != null ? lead.lat.toFixed(4) : 'N/A'} | Lng: {lead.lng != null ? lead.lng.toFixed(4) : 'N/A'}
            </div>
          </div>

          <div className="bg-linear-to-br from-violet-50 to-emerald-50 p-4 rounded-xl border border-violet-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-violet-700 uppercase flex items-center gap-1">
                <Sparkles size={14} /> Dados da Empresa (via IA & Places)
              </span>

              {!lead.enrichedData && (
                <button
                  onClick={handleEnrich}
                  disabled={enriching || lead.construtora === 'Não identificada' || lead.construtora === 'A identificar'}
                  className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {enriching ? <><Loader2 size={12} className="animate-spin" /> Buscando...</> : 'Enriquecer Agora'}
                </button>
              )}
            </div>

            {enrichError && <div className="text-xs text-red-600 mb-2">{enrichError}</div>}

            {lead.enrichedData ? (
              <div className="flex flex-col gap-2 text-sm">
                {lead.enrichedData.website && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Globe size={16} className="text-violet-500" />
                    <a href={lead.enrichedData.website} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline font-medium">{lead.enrichedData.website}</a>
                  </div>
                )}
                {lead.enrichedData.phone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={16} className="text-emerald-500" />
                    <span className="font-medium">{lead.enrichedData.phone}</span>
                  </div>
                )}
                {lead.enrichedData.summary && (
                  <p className="text-xs text-slate-500 mt-2 bg-white/60 p-2 rounded-lg border border-white">
                    {lead.enrichedData.summary}
                  </p>
                )}
                {!lead.enrichedData.website && !lead.enrichedData.phone && (
                  <p className="text-slate-500 text-xs">A busca oficial não retornou dados públicos seguros para esta empresa.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Ainda não foram buscados dados avançados como site e telefone estruturado para esta construtora.
                {lead.construtora === 'Não identificada' ? ' (Nome da construtora é obrigatório).' : ''}
              </p>
            )}
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

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button
            onClick={async () => {
              if (confirm('Tem certeza que deseja excluir permanentemente esta captação?')) {
                setIsDeleting(true);
                const success = await deleteLead(lead.id);
                if (success) onClose();
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Excluir Obra
          </button>
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
