import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import { useLootlyUI } from './LootlyUI';

export default function LiveChatFab() {
  const { t } = useI18n();
  const { showToast } = useLootlyUI();

  return (
    <button
      type="button"
      onClick={() => showToast(t('liveChat.comingSoon'), 'info')}
      className="fixed bottom-4 right-4 z-50 p-3.5 bg-[#090f1d] border border-slate-800 hover:border-amber-500/40 rounded-2xl shadow-2xl text-slate-400 hover:text-amber-400 transition cursor-pointer group"
      title={t('liveChat.label')}
      aria-label={t('liveChat.label')}
      id="live_chat_fab"
    >
      <MessageCircle className="h-6 w-6 group-hover:scale-105 transition-transform" />
    </button>
  );
}
