import React from 'react';
import { Play, Trophy } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import type { Giveaway } from '../data';

interface LiveDrawSelectPageProps {
  campaigns: Giveaway[];
  onSelectRoute: (route: string) => void;
}

export default function LiveDrawSelectPage({ campaigns, onSelectRoute }: LiveDrawSelectPageProps) {
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white font-display">{t('liveDraw.selectTitle')}</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">{t('liveDraw.selectDesc')}</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">{t('nav.noCampaignForDraw')}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectRoute(`/giveaway/${g.slug}/draw`)}
              className="bg-[#090f1d] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{g.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    /giveaway/{g.slug} · {g.status}
                  </p>
                </div>
              </div>
              <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold group-hover:bg-amber-400">
                <Play className="h-3.5 w-3.5 fill-current" /> {t('liveDraw.openPanel')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
