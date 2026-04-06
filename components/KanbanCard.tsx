import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building, MapPin } from 'lucide-react';
import { Lead } from '@/hooks/useLeads';

interface KanbanCardProps {
  lead: Lead;
  onDetails?: (lead: Lead) => void;
}

export function KanbanCard({ lead, onDetails }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: 'Lead', lead } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="bg-emerald-50/50 border-2 border-emerald-400 border-dashed rounded-xl h-[120px] mb-3 opacity-50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-grab hover:shadow-md hover:border-emerald-200 transition-all group mb-3 touch-none"
    >
      <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-emerald-600 transition-colors">
        {lead.obra}
      </h4>
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-3">
        <Building size={12} />
        <span className="truncate">{lead.construtora}</span>
      </div>
      <div className="text-slate-400 text-xs flex items-center gap-1.5 bg-slate-50 rounded-md p-1.5">
        <MapPin size={12} className="text-emerald-500 shrink-0" />
        <span className="truncate">{lead.endereco_aproximado}</span>
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">
          {lead.fonteOriginal}
        </span>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDetails?.(lead);
          }}
          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer uppercase"
        >
          Ver Detalhes
        </button>
      </div>
    </div>
  );
}
