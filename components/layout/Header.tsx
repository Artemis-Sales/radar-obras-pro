'use client';

import React, { useState, useEffect } from 'react';
import { Search, Bell, User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { auth, db } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLeads } from '@/hooks/useLeads';

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { leads } = useLeads();
  const [lastAccess, setLastAccess] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchLastAccess() {
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.lastAccess && data.lastAccess.toDate) {
            setLastAccess(data.lastAccess.toDate());
          }
        }
      }
    }
    fetchLastAccess();
  }, [user]);

  const newLeads = leads.filter(lead => {
    if (!lastAccess || !lead.createdAt) return false;
    const leadDate = new Date(lead.createdAt);
    return leadDate > lastAccess;
  });

  const handleClearNotifications = async () => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastAccess: serverTimestamp()
        });
        setLastAccess(new Date()); // Optimistic update
      } catch (err) {
        // Ignorar caso o doc não exista ainda
      }
    }
    setNotificationsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <header className="h-20 bg-white/70 backdrop-blur-lg border-b border-slate-200 flex items-center justify-between px-8 z-50 sticky top-0">
      <div className="flex bg-slate-100/80 rounded-full px-4 py-2 w-96 items-center gap-2 focus-within:ring-2 focus-within:ring-emerald-400 transition-all">
        <Search className="text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar construtora ou obra..." 
          className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-700"
        />
      </div>
      <div className="flex items-center gap-5">
        <div className="relative">
          <button 
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setMenuOpen(false);
            }}
            className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 cursor-pointer"
          >
            <Bell size={20} />
            {newLeads.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <span className="font-bold text-slate-800 text-sm">Notificações</span>
                {newLeads.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {newLeads.length} novas
                  </span>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2">
                {newLeads.length > 0 ? (
                  newLeads.map(lead => (
                    <div key={lead.id} className="p-2 hover:bg-slate-50 rounded-lg mb-1 border-b border-slate-50 last:border-0 cursor-pointer transition-colors">
                      <p className="text-sm font-bold text-slate-800 truncate">{lead.obra}</p>
                      <p className="text-xs text-slate-500 truncate">{lead.construtora}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Nenhuma nova captação desde seu último acesso.
                  </div>
                )}
              </div>
              {newLeads.length > 0 && (
                <div className="p-2 border-t border-slate-100 flex justify-center">
                  <button 
                    onClick={handleClearNotifications}
                    className="w-full py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Marcar como visualizadas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="relative">
          <button 
            onClick={() => {
              setMenuOpen(!menuOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-full transition-colors"
          >
            <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:shadow-lg transition-shadow">
              {user?.email ? user.email.charAt(0).toUpperCase() : <User size={18} />}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.displayName || 'Engenheira Produtiva'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email || 'email@não.encontrado'}</p>
              </div>
              
              <div className="p-2">
                <Link 
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Settings size={16} />
                  Minha Conta
                </Link>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <LogOut size={16} />
                  Sair do Sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
