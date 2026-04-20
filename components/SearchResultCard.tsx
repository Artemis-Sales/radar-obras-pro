'use client';

import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Star,
  TrendingUp,
  Clock,
  Landmark,
  FileText,
  Zap,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';

interface SearchResultData {
  id: string;
  fonte: string;
  titulo: string;
  descricao: string;
  orgao: string;
  empresa?: string;
  cidade: string;
  uf: string;
  valor_estimado?: number;
  valor_homologado?: number;
  fase: string;
  data_publicacao: string;
  url_original: string;
  relevancia: number;

  motivo_recomendacao?: string;
  tem_contato?: boolean;
  tem_alvara?: boolean;

  modalidade?: string;
  numero_controle?: string;
  data_abertura?: string;
  data_encerramento?: string;
}

interface SearchResultCardProps {
  result: SearchResultData;
  queryOriginal?: string;
  onSaveLead?: (result: SearchResultData) => void;
  isSaved?: boolean;
}

/** Badge de fonte com cor distinta */
function SourceBadge({ fonte }: { fonte: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    PNCP: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      icon: <Landmark size={12} />,
    },
    'DOE-SP': {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      icon: <FileText size={12} />,
    },
    CETESB: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: <Zap size={12} />,
    },
    Places: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      icon: <MapPin size={12} />,
    },
  };
  const c = config[fonte] || config.PNCP;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
      {c.icon}
      {fonte}
    </span>
  );
}

/** Badge de relevância */
function RelevanceBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : score >= 60
        ? 'text-blue-600 bg-blue-50 border-blue-200'
        : score >= 40
          ? 'text-amber-600 bg-amber-50 border-amber-200'
          : 'text-slate-500 bg-slate-50 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
      <TrendingUp size={11} />
      {score}%
    </span>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function SearchResultCard({ result, queryOriginal, onSaveLead, isSaved = false }: SearchResultCardProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasDeadline = result.data_encerramento && new Date(result.data_encerramento) > new Date();
  const daysUntilDeadline = hasDeadline
    ? Math.ceil((new Date(result.data_encerramento!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Análise com IA
  const handleAnalyze = async () => {
    if (briefing) {
      setBriefingOpen(!briefingOpen);
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch('/api/search/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado: result, queryOriginal }),
      });
      const data = await res.json();

      if (data.success) {
        setBriefing(data.briefing);
        setBriefingOpen(true);
      } else {
        setAnalyzeError(data.error || 'Falha na análise.');
      }
    } catch {
      setAnalyzeError('Erro de conexão.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Salvar lead real no Firestore
  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/leads/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado: result }),
      });
      const data = await res.json();

      if (data.success) {
        setSaved(true);
        setSaveMessage(data.alreadyExists ? 'Já estava salvo' : 'Salvo!');
        onSaveLead?.(result);
      } else {
        setSaveMessage('Erro ao salvar');
      }
    } catch {
      setSaveMessage('Erro de conexão');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return (
    <div
      className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 
                 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 overflow-hidden"
    >
      {/* Barra lateral de relevância */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors"
        style={{
          backgroundColor:
            result.relevancia >= 80 ? '#10b981'
              : result.relevancia >= 60 ? '#3b82f6'
                : result.relevancia >= 40 ? '#f59e0b'
                  : '#94a3b8',
        }}
      />

      <div className="p-5 pl-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceBadge fonte={result.fonte} />
            {result.tem_alvara && (
              <span className="inline-flex items-center gap-1 px-2 py-[2px] bg-red-100 text-red-700 text-[11px] font-bold uppercase rounded-full tracking-wide">
                <CheckCircle2 size={11} /> Alvará
              </span>
            )}
            {result.tem_contato && (
              <span className="inline-flex items-center gap-1 px-2 py-[2px] bg-orange-100 text-orange-700 text-[11px] font-bold uppercase rounded-full tracking-wide">
                <FileText size={11} /> C/ Contato
              </span>
            )}
            {result.modalidade && (
              <span className="text-[11px] text-slate-500 font-medium">{result.modalidade}</span>
            )}
          </div>
          <RelevanceBadge score={result.relevancia} />
        </div>

        {/* Título */}
        <h3 className="text-[15px] font-bold text-slate-800 leading-snug mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {result.titulo}
        </h3>

        {/* B2B Motivo Badge */}
        {result.motivo_recomendacao && result.relevancia > 60 && (
          <div className="mb-3 inline-flex flex-wrap items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[12px] px-2.5 py-1 rounded-md max-w-full">
            <Sparkles size={13} className="text-emerald-600 flex-shrink-0" />
            <span className="font-semibold truncate">{result.motivo_recomendacao}</span>
          </div>
        )}

        {/* Metadados */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-500 mb-3">
          <span className="inline-flex items-center gap-1">
            <Building2 size={13} className="text-slate-400" />
            {result.orgao.length > 45 ? result.orgao.substring(0, 45) + '...' : result.orgao}
          </span>
          {result.cidade && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="text-slate-400" />
              {result.cidade}{result.uf ? `, ${result.uf}` : ''}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar size={13} className="text-slate-400" />
            {formatRelativeDate(result.data_publicacao)}
          </span>
        </div>

        {/* Valor + Prazo + Ações */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {result.valor_estimado != null && result.valor_estimado > 0 && (
              <span className="text-lg font-black text-slate-800">
                {formatCurrency(result.valor_estimado)}
              </span>
            )}
            {hasDeadline && daysUntilDeadline != null && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
                ${daysUntilDeadline <= 3 ? 'bg-red-100 text-red-700'
                  : daysUntilDeadline <= 7 ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'}`}
              >
                <Clock size={11} />
                {daysUntilDeadline === 0 ? 'Encerra hoje!'
                  : daysUntilDeadline === 1 ? 'Encerra amanhã'
                    : `${daysUntilDeadline} dias restantes`}
              </span>
            )}
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
              {result.fase}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Analisar com IA */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer
                ${briefing
                  ? 'text-violet-700 bg-violet-50 hover:bg-violet-100'
                  : 'text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200'
                }`}
            >
              {analyzing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {briefing ? (briefingOpen ? 'Fechar' : 'Ver Análise') : 'Analisar'}
              {briefing && (briefingOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
            </button>

            {/* Link Edital */}
            {result.url_original && (
              <a
                href={result.url_original}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 
                           hover:bg-blue-100 rounded-lg transition-colors"
              >
                <ExternalLink size={13} />
                Ver Edital
              </a>
            )}

            {/* Salvar Lead */}
            <div className="relative">
              <button
                onClick={handleSave}
                disabled={saved || saving}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer
                  ${saved
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  }`}
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : saved ? (
                  <CheckCircle2 size={13} className="text-emerald-500" />
                ) : (
                  <Star size={13} />
                )}
                {saved ? 'Salvo' : 'Salvar'}
              </button>
              {saveMessage && (
                <span className="absolute -top-8 right-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 
                                 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap animate-in fade-in">
                  {saveMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Erro de análise */}
        {analyzeError && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <Clock size={13} className="text-amber-500 shrink-0" />
            {analyzeError.includes('429') || analyzeError.includes('quota') || analyzeError.includes('rate')
              ? 'Limite de uso da IA atingido. Tente novamente em alguns minutos.'
              : analyzeError.length > 100
                ? analyzeError.substring(0, 100) + '...'
                : analyzeError
            }
          </div>
        )}

        {/* Micro-Briefing Expandível */}
        {briefing && briefingOpen && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-gradient-to-br from-violet-50 via-white to-indigo-50 border border-violet-200 rounded-xl p-5 relative overflow-hidden">
              {/* Decoração */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-violet-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
              
              <div className="flex items-center gap-2 mb-3 relative">
                <Sparkles size={15} className="text-violet-500" />
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
                  Análise Estratégica · Gemini AI
                </span>
              </div>

              <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line relative">
                {briefing}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
