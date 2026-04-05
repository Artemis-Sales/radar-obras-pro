import React, { useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Lead } from '@/hooks/useLeads';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  column: string;
  leads: Lead[];
  onDetails?: (lead: Lead) => void;
}

export function KanbanColumn({ column, leads, onDetails }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column,
    data: {
      type: 'Column',
      column,
    },
  });

  const leadsIds = useMemo(() => leads.map((l) => l.id), [leads]);

  return (
    <div className="min-w-[320px] flex-1 bg-slate-100/60 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-slate-700">{column}</h3>
        <span className="bg-white text-slate-500 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
          {leads.length}
        </span>
      </div>
      
      <div 
        ref={setNodeRef}
        className="flex flex-col flex-1 overflow-y-auto pr-1 min-h-[150px]"
      >
        <SortableContext items={leadsIds} strategy={verticalListSortingStrategy}>
          {leads.map((obra) => (
            <KanbanCard key={obra.id} lead={obra} onDetails={onDetails} />
          ))}
        </SortableContext>
        
        {leads.length === 0 && (
          <div className="flex-1 flex min-h-[100px] items-center justify-center border-2 border-dashed border-slate-200/80 rounded-xl bg-slate-50/50 pointer-events-none">
            <p className="text-slate-400 text-sm font-medium">Arraste para cá</p>
          </div>
        )}
      </div>
    </div>
  );
}
