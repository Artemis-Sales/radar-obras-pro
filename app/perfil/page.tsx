'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { updatePassword } from 'firebase/auth';
import { Shield, Mail, User, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/firebase/config';

export default function PerfilPage() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem. Tente novamente.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      await updatePassword(currentUser, newPassword);
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso! Seu acesso está seguro.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ 
          type: 'error', 
          text: 'Por motivo de segurança, você precisa ter feito login recentemente para alterar a senha. Por favor, acesse a opção "Sair do Sistema" no topo da página, faça login novamente e tente de novo.' 
        });
      } else {
        setMessage({ type: 'error', text: error.message || 'Ocorreu um erro ao tentar alterar sua senha.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 pb-20">
        <div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">Configurações da Conta</h1>
          <p className="text-slate-500 text-sm">Gerencie seu perfil e mantenha sua segurança em dia.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
              <div className="h-24 w-24 bg-slate-800 rounded-full flex items-center justify-center text-white font-black text-3xl mb-4 shadow-lg shadow-slate-200">
                {user?.email ? user.email.charAt(0).toUpperCase() : <User size={40} />}
              </div>
              <h2 className="font-bold text-slate-800 text-lg">{user?.displayName || 'Engenheira Radar PRO'}</h2>
              <p className="text-slate-500 text-sm truncate w-full text-center">{user?.email}</p>
              
              <div className="w-full mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <span className="truncate">{user?.email || 'Nenhum e-mail.'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Shield size={16} className="text-emerald-500 shrink-0" />
                  <span>Conta autenticada</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Segurança de Acesso</h3>
                  <p className="text-slate-500 text-sm">Defina uma nova senha para sua conta</p>
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 border ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  {message.type === 'error' ? <AlertCircle size={20} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={20} className="shrink-0 mt-0.5" />}
                  <span className="text-sm font-medium leading-relaxed">{message.text}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-700">Nova Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Mínimo de 6 caracteres"
                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-700">Confirme a Nova Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repita a senha"
                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all w-full"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm w-full md:w-auto shadow-md"
                  >
                    {loading ? 'Atualizando...' : 'Atualizar Minha Senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
