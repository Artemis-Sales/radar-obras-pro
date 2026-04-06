'use client';

import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { useLeads, Lead } from '@/hooks/useLeads';
import { PinInfo } from './PinInfo';
import { Skeleton } from './ui/skeleton';
import { LeadDetailsModal } from './LeadDetailsModal';

export function MapWidget() {
  const rawApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const apiKey = typeof rawApiKey === 'string' ? rawApiKey : '';
  const { leads, loading } = useLeads();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !apiKey) {
    return (
      <div className="w-full h-[400px] rounded-2xl flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-500">
        Carregando Mapa...
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultZoom={9}
          defaultCenter={{ lat: -23.5505, lng: -46.6333 }}
          mapId="DEMO_MAP_ID"
          className="w-full h-full"
          onClick={() => setSelectedLead(null)}
        >
          {leads
            .filter(obra => obra.lat != null && obra.lng != null)
            .map(obra => (
              <AdvancedMarker 
                key={obra.id} 
                position={{ lat: obra.lat as number, lng: obra.lng as number }} 
                title={obra.obra}
                onClick={() => setSelectedLead(obra)}
              >
                <Pin background={'#10b981'} borderColor={'#047857'} glyphColor={'#fff'} />
              </AdvancedMarker>
            ))}

          {selectedLead && selectedLead.lat != null && selectedLead.lng != null && (
            <InfoWindow
              position={{ lat: selectedLead.lat, lng: selectedLead.lng }}
              onCloseClick={() => setSelectedLead(null)}
              headerDisabled={true}
              style={{ padding: 0 }}
            >
              <PinInfo lead={selectedLead} onDetails={() => setDetailsLead(selectedLead)} onClose={() => setSelectedLead(null)} />
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {loading && leads.length === 0 && (
        <div className="absolute inset-0 z-10 bg-slate-100">
          <Skeleton className="w-full h-full rounded-2xl" />
        </div>
      )}

      <LeadDetailsModal lead={detailsLead} onClose={() => setDetailsLead(null)} />
    </div>
  );
}
