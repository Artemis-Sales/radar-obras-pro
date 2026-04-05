'use client';

import React, { useState, useEffect } from 'react';

export function ConfigGuard({ children }: { children: React.ReactNode }) {
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    // Check if the critical keys are available in the public environment
    const checkKeys = () => {
      const hasFirebaseKey = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const hasMapKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (hasFirebaseKey && hasMapKey) {
        setIsConfigLoaded(true);
      } else {
        // Retry after a short delay if not yet available (unlikely with hardcoding, but safe)
        const timer = setTimeout(checkKeys, 100);
        return () => clearTimeout(timer);
      }
    };

    checkKeys();
  }, []);

  if (!isConfigLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
