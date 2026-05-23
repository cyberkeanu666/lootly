import React, { useState } from 'react';
import {
  Trophy,
  UserPlus,
  Shield,
  Hash,
  Play,
  Archive,
  Share2,
  ChevronRight,
  User,
  ClipboardCheck,
  Link2,
} from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface HowItWorksPageProps {
  onSelectRoute: (route: string) => void;
}

type GuideTab = 'creator' | 'participant';

type StepDef = {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  bodyKey: string;
  detailKey: string;
};

export default function HowItWorksPage({ onSelectRoute }: HowItWorksPageProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<GuideTab>('creator');

  const creatorSteps: StepDef[] = [
    { icon: UserPlus, titleKey: 'guide.c1Title', bodyKey: 'guide.c1Body', detailKey: 'guide.c1Detail' },
    { icon: Trophy, titleKey: 'guide.c2Title', bodyKey: 'guide.c2Body', detailKey: 'guide.c2Detail' },
    { icon: Share2, titleKey: 'guide.c3Title', bodyKey: 'guide.c3Body', detailKey: 'guide.c3Detail' },
    { icon: Shield, titleKey: 'guide.c4Title', bodyKey: 'guide.c4Body', detailKey: 'guide.c4Detail' },
    { icon: Play, titleKey: 'guide.c5Title', bodyKey: 'guide.c5Body', detailKey: 'guide.c5Detail' },
    { icon: Archive, titleKey: 'guide.c6Title', bodyKey: 'guide.c6Body', detailKey: 'guide.c6Detail' },
  ];

  const participantSteps: StepDef[] = [
    { icon: Link2, titleKey: 'guide.p1Title', bodyKey: 'guide.p1Body', detailKey: 'guide.p1Detail' },
    { icon: User, titleKey: 'guide.p2Title', bodyKey: 'guide.p2Body', detailKey: 'guide.p2Detail' },
    { icon: ClipboardCheck, titleKey: 'guide.p3Title', bodyKey: 'guide.p3Body', detailKey: 'guide.p3Detail' },
    { icon: Shield, titleKey: 'guide.p4Title', bodyKey: 'guide.p4Body', detailKey: 'guide.p4Detail' },
    { icon: Share2, titleKey: 'guide.p5Title', bodyKey: 'guide.p5Body', detailKey: 'guide.p5Detail' },
    { icon: Hash, titleKey: 'guide.p6Title', bodyKey: 'guide.p6Body', detailKey: 'guide.p6Detail' },
  ];

  const steps = tab === 'creator' ? creatorSteps : participantSteps;
  const intro = tab === 'creator' ? t('guide.creatorIntro') : t('guide.participantIntro');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10" id="lootly_guide_page">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-xs text-amber-400 uppercase tracking-wider font-display mb-4">
          {t('guide.badge')}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-3">
          {t('guide.title')}
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto leading-relaxed">{t('guide.subtitle')}</p>
      </div>

      <div className="flex justify-center gap-2 mb-8 p-1 bg-[#0a0f1d] border border-slate-800 rounded-2xl max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setTab('creator')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            tab === 'creator'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('guide.tabCreator')}
        </button>
        <button
          type="button"
          onClick={() => setTab('participant')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            tab === 'participant'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('guide.tabParticipant')}
        </button>
      </div>

      <p className="text-sm text-slate-400 text-center max-w-2xl mx-auto mb-8 leading-relaxed">{intro}</p>

      <div className="flex flex-col gap-5 mb-10">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.titleKey}
              className="bg-[#090f1d] border border-slate-800 rounded-2xl p-5 text-left"
            >
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-amber-500 shrink-0" />
                    <h2 className="text-base font-bold text-white font-display">{t(step.titleKey)}</h2>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-2">{t(step.bodyKey)}</p>
                  <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-slate-800 pl-3">
                    {t(step.detailKey)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-[#0e172e] border border-slate-800 rounded-2xl p-6 text-center">
        <h3 className="text-lg font-bold text-white font-display mb-2">{t('guide.ctaTitle')}</h3>
        <p className="text-xs text-slate-400 mb-4 max-w-lg mx-auto">{t('guide.ctaBody')}</p>
        <button
          type="button"
          onClick={() => onSelectRoute('/')}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-400 transition cursor-pointer"
        >
          {t('guide.ctaButton')} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
