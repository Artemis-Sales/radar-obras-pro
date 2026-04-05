import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface Lead {
  id: string;
  obra: string;
  construtora: string;
  cidade: string;
  endereco_aproximado: string;
  estagio: string;
  lat: number;
  lng: number;
  createdAt?: string | null;
  textoBruto?: string;
}

export const updateLeadStage = async (leadId: string, novoEstagio: string) => {
  try {
    const leadRef = doc(db, 'leads', leadId);
    await updateDoc(leadRef, {
      estagio: novoEstagio,
      atualizadoEm: new Date()
    });
    return true;
  } catch (error) {
    console.error("Erro ao atualizar estágio do lead:", error);
    return false;
  }
};

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca na subcoleção "leads" ordenada pela criação
    const q = query(collection(db, 'leads'), orderBy('criadoEm', 'desc'));
    
    // onSnapshot dispara em tempo real sempre que a coleção sofrer upsert/add
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads: Lead[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
          let safelyParsedDate: string | null = null;
          
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              safelyParsedDate = data.createdAt.toDate().toISOString();
            } else if (data.createdAt instanceof Date) {
              safelyParsedDate = data.createdAt.toISOString();
            } else if (typeof data.createdAt === 'string') {
              safelyParsedDate = data.createdAt;
            } else if (typeof data.createdAt === 'number') {
              safelyParsedDate = new Date(data.createdAt).toISOString();
            }
          } else if (data.criadoEm) {
            if (typeof data.criadoEm.toDate === 'function') {
              safelyParsedDate = data.criadoEm.toDate().toISOString();
            } else if (typeof data.criadoEm === 'string') {
              safelyParsedDate = data.criadoEm;
            } else if (typeof data.criadoEm === 'number') {
              safelyParsedDate = new Date(data.criadoEm).toISOString();
            }
          }

          // Garantir que as coordenadas são sempre valores primitivos mapeados
          const safeLat = typeof data.lat === 'number' ? data.lat : -23.5505 + (Math.random() - 0.5) * 0.05;
          const safeLng = typeof data.lng === 'number' ? data.lng : -46.6333 + (Math.random() - 0.5) * 0.05;

          fetchedLeads.push({
            id: doc.id,
            obra: typeof data.obra === 'string' ? data.obra : 'Sem nome',
            construtora: typeof data.construtora === 'string' ? data.construtora : 'Não identificada',
            cidade: typeof data.cidade === 'string' ? data.cidade : '',
            endereco_aproximado: typeof data.endereco_aproximado === 'string' ? data.endereco_aproximado : '',
            estagio: typeof data.estagio === 'string' ? data.estagio : 'Lead Novo',
            createdAt: safelyParsedDate,
            textoBruto: typeof data.textoBruto === 'string' ? data.textoBruto : '',
            lat: safeLat,
            lng: safeLng,
          });
      });
      
      setLeads(fetchedLeads);
      setLoading(false);
    }, (error) => {
      console.error("Erro no onSnapshot do Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { leads, loading };
}
