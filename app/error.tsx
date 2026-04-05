'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Crash Application Error:', error);
  }, [error]);

  // Safely extract error message as a string primitive
  const errorMessage = typeof error?.message === 'string' 
    ? error.message 
    : 'Erro desconhecido';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-red-100 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Ops, algo deu errado!</h2>
        <p className="text-slate-500 mb-6 text-sm">
          A aplicação encontrou um erro inesperado. Por favor, tente novamente ou contate o suporte.
        </p>
        <p className="text-xs text-slate-400 mb-4 font-mono bg-slate-50 p-2 rounded-lg break-all">
          {errorMessage}
        </p>
        <button
          onClick={reset}
          className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold hover:bg-slate-800 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
