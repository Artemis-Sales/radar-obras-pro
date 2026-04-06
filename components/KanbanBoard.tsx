'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useLeads, Lead, updateLeadStage } from '@/hooks/useLeads';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { LeadDetailsModal } from './LeadDetailsModal';

import { Skeleton } from './ui/skeleton';

const COLUMNS = [
  'Lead Novo',
  'Alvará Aprovado',
  'Tentativa de Contato',
  'Em Negociação',
  'Descartado',
  'Fechado'
];

export function KanbanBoard() {
  const { leads, loading } = useLeads();
  const [activeLeads, setActiveLeads] = useState<Lead[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);

  // Sync original leads with local state for optimistic UI updates
  useEffect(() => {
    setActiveLeads(leads);
  }, [leads]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // minimum drag distance before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (loading && activeLeads.length === 0) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)] items-start">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="min-w-[320px] flex-1 bg-slate-100/60 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 h-full">
            <div className="flex justify-between items-center mb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-[120px] w-full rounded-xl" />
            <Skeleton className="h-[120px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = activeLeads.find(l => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveLead = active.data.current?.type === 'Lead';
    const isOverLead = over.data.current?.type === 'Lead';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveLead) return;

    setActiveLeads(prev => {
      const activeIndex = prev.findIndex(l => l.id === activeId);
      let overIndex = -1;
      let newEstagio = prev[activeIndex].estagio;

      if (isOverLead) {
        overIndex = prev.findIndex(l => l.id === overId);
        newEstagio = prev[overIndex].estagio;
      } else if (isOverColumn) {
        newEstagio = overId as string;
      }

      if (prev[activeIndex].estagio !== newEstagio) {
        const newLeads = [...prev];
        newLeads[activeIndex] = { ...newLeads[activeIndex], estagio: newEstagio };
        return newLeads;
      }

      return prev;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const isActiveLead = active.data.current?.type === 'Lead';
    const isOverLead = over.data.current?.type === 'Lead';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveLead) return;

    let targetEstagio = '';
    
    if (isOverLead) {
      const overLead = activeLeads.find(l => l.id === overId);
      if (overLead) targetEstagio = overLead.estagio;
    } else if (isOverColumn) {
      targetEstagio = overId as string;
    }

    const originalLead = leads.find(l => l.id === activeId);
    
    if (targetEstagio && originalLead && originalLead.estagio !== targetEstagio) {
      // O estagio mudou de fato, reflete no banco. A UI ja atualizou no onDragOver.
      const success = await updateLeadStage(activeId as string, targetEstagio);
      if (!success) {
        // Rollback on failure
        setActiveLeads(leads);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)] items-start">
        {leads.length === 0 && !loading ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhuma obra encontrada</h3>
            <p className="text-slate-500 max-w-sm">
              O robô rastreador está monitorando as fontes oficiais. Novas oportunidades aparecerão aqui automaticamente em breve.
            </p>
          </div>
        ) : (
          COLUMNS.map(column => (
            <KanbanColumn
              key={column}
              column={column}
              leads={activeLeads.filter(l => l.estagio === column)}
              onDetails={setDetailsLead}
            />
          ))
        )}
      </div>

      <DragOverlay>
        {activeLead ? <KanbanCard lead={activeLead} /> : null}
      </DragOverlay>

      <LeadDetailsModal lead={detailsLead} onClose={() => setDetailsLead(null)} />
    </DndContext>
  );
}
