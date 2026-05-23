import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ConfirmState = {
  message: string;
  resolve: (value: boolean) => void;
} | null;

type LootlyUIContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
  confirm: (message: string) => Promise<boolean>;
};

const LootlyUIContext = createContext<LootlyUIContextValue | null>(null);

const variantStyles: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  success: {
    border: 'border-emerald-500/30',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />,
  },
  error: {
    border: 'border-red-500/30',
    icon: <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />,
  },
  warning: {
    border: 'border-amber-500/30',
    icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />,
  },
  info: {
    border: 'border-slate-600',
    icon: <Info className="h-5 w-5 text-slate-300 shrink-0" />,
  },
};

export function LootlyUIProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5200);
  }, []);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <LootlyUIContext.Provider value={{ showToast, confirm }}>
      {children}

      <div
        className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 bg-[#090f1d] border ${variantStyles[toast.variant].border} rounded-2xl px-4 py-3 shadow-2xl text-sm text-slate-200 animate-in slide-in-from-right fade-in duration-200`}
          >
            {variantStyles[toast.variant].icon}
            <p className="flex-1 leading-relaxed pt-0.5">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-500 hover:text-slate-300 cursor-pointer shrink-0"
              aria-label={t('ui.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#090f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-relaxed">{confirmState.message}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => handleConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-900 transition cursor-pointer"
              >
                {t('ui.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition cursor-pointer"
              >
                {t('ui.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </LootlyUIContext.Provider>
  );
}

export function useLootlyUI(): LootlyUIContextValue {
  const ctx = useContext(LootlyUIContext);
  if (!ctx) throw new Error('useLootlyUI must be used within LootlyUIProvider');
  return ctx;
}
