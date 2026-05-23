import React, { useState, useEffect } from 'react';
import { Trophy, User, Mail, Keyboard } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

export interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onRegisterHost: (
    email: string,
    username: string,
    password: string
  ) => Promise<{ error?: string; success?: boolean }>;
  onLoginHost: (email: string, password: string) => Promise<{ error?: string; success?: boolean }>;
}

export default function AuthModal({
  open,
  initialMode = 'register',
  onClose,
  onRegisterHost,
  onLoginHost,
}: AuthModalProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAuthMode(initialMode);
      setAuthError('');
      setEmail('');
      setPassword('');
      setUsername('');
    }
  }, [open, initialMode]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (password.length < 6) {
      setAuthError(t('authForm.passwordShort'));
      return;
    }
    setAuthLoading(true);
    const result =
      authMode === 'register'
        ? await onRegisterHost(email.trim(), username.trim() || email.split('@')[0], password)
        : await onLoginHost(email.trim(), password);
    setAuthLoading(false);
    if (result?.error) {
      setAuthError(result.error);
      return;
    }
    if (result?.success) {
      setPassword('');
      setEmail('');
      setUsername('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm"
      id="login_modal_backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#090f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        id="login_modal"
      >
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-amber-500/10 rounded-full text-amber-400 mb-3 border border-amber-500/15">
            <Trophy className="h-6 w-6" />
          </div>
          <h4 className="text-lg font-extrabold text-white font-display">{t('authForm.title')}</h4>
          <p className="text-xs text-slate-400 mt-1">{t('authForm.subtitle')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setAuthError(''); }}
            className={`py-2 rounded-lg border cursor-pointer ${
              authMode === 'login'
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'border-slate-800 text-slate-400'
            }`}
          >
            {t('authForm.tabLogin')}
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('register'); setAuthError(''); }}
            className={`py-2 rounded-lg border cursor-pointer ${
              authMode === 'register'
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'border-slate-800 text-slate-400'
            }`}
          >
            {t('authForm.tabRegister')}
          </button>
        </div>

        {authError && (
          <div className="mb-3 p-2.5 bg-red-950/30 border border-red-900/40 text-red-400 text-xs rounded-lg">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {authMode === 'register' && (
            <div>
              <label className="text-xs text-slate-300 block mb-1">{t('authForm.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={t('authForm.namePh')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 bg-[#050811] border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  required={authMode === 'register'}
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-300 block mb-1">{t('authForm.email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                placeholder={t('authForm.emailPh')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 bg-[#050811] border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">{t('authForm.password')}</label>
            <div className="relative">
              <Keyboard className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                placeholder={t('authForm.passwordPh')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 bg-[#050811] border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full mt-2 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm hover:bg-amber-400 transition cursor-pointer disabled:opacity-60"
          >
            {authLoading
              ? '...'
              : authMode === 'register'
                ? t('authForm.submitRegister')
                : t('authForm.submitLogin')}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs text-slate-400 font-medium transition cursor-pointer"
          >
            {t('authForm.close')}
          </button>
        </form>
      </div>
    </div>
  );
}
