import React from 'react';
import { Trophy, Shield, Zap, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import type { HostUser } from '../data';

interface LandingPageProps {
  host: HostUser | null;
  onRegisterHost: (
    email: string,
    username: string,
    password: string
  ) => Promise<{ error?: string }>;
  onLoginHost: (email: string, password: string) => Promise<{ error?: string }>;
  onGoDashboard: () => void;
  onRequestUpgrade: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export default function LandingPage({
  host,
  onRegisterHost,
  onLoginHost,
  onGoDashboard,
  onRequestUpgrade,
  onOpenAuth,
}: LandingPageProps) {
  const { t } = useI18n();

  return (
    <div className="relative text-gray-200" id="lootly_landing">
      {/* Decorative Grid Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-900/10 to-transparent pointer-events-none"></div>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 px-3 py-1.5 rounded-full text-xs text-amber-400 mb-6 uppercase tracking-wider font-display">
          <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
          {t('landing.tagline')}
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight font-display">
          {t('landing.heroTitle')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
            {t('landing.heroHighlight')}
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          {t('landing.heroDesc')}
        </p>

        {/* Action Callouts */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
          <button
            onClick={() => (host ? onGoDashboard() : onOpenAuth('register'))}
            className="px-8 py-4 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center gap-2 cursor-pointer text-base font-display"
            id="get_started_btn"
          >
            {host ? t('landing.goDashboard') : t('landing.launchFree')}{' '}
            <ChevronRight className="h-5 w-5" />
          </button>
          
          <button
            onClick={() => (host ? onGoDashboard() : onOpenAuth('login'))}
            className="px-8 py-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 font-semibold transition text-slate-300 cursor-pointer text-base"
            id="sign_in_host_btn"
          >
            {t('landing.accessDashboard')}
          </button>
        </div>

        {/* Core Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left" id="lootly_pillars">
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-transparent rounded-bl-full"></div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/10 text-amber-400 rounded-xl width-max max-w-max">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">{t('landing.pillar1Title')}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{t('landing.pillar1Body')}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-transparent rounded-bl-full"></div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/10 text-purple-400 rounded-xl width-max max-w-max">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">{t('landing.pillar2Title')}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{t('landing.pillar2Body')}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-full"></div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/10 text-blue-400 rounded-xl width-max max-w-max">
              <Trophy className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">{t('landing.pillar3Title')}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{t('landing.pillar3Body')}</p>
          </div>
        </div>
      </div>

      {/* Pricing and Freemium Tier Details */}
      <div className="border-t border-slate-800/80 bg-slate-950/40 py-16" id="lootly_pricing">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-3 font-display">{t('landing.pricingTitle')}</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">{t('landing.pricingDesc')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto items-stretch">
            {/* Free Tier */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/80 transition">
              <div>
                <span className="text-xs uppercase text-slate-400 block tracking-widest mb-1 font-display">{t('landing.freeLabel')}</span>
                <h3 className="text-xl font-bold text-white mb-2 font-display">{t('landing.freeName')}</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">{t('landing.freeDesc')}</p>
                
                <div className="text-3xl font-extrabold text-white mb-6 font-display">$0 <span className="text-xs font-normal text-slate-500">/ forever</span></div>
                
                <ul className="flex flex-col gap-3 text-xs text-slate-400 mb-8 border-t border-slate-800/80 pt-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" /> 1 concurrent active giveaway</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Max 500 entry size cap</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Bio signature verifications</li>
                  <li className="flex items-center gap-2 text-slate-600">✓ "Powered by Lootly" Watermark</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (host) {
                    if (host.plan === 'free') return;
                    onGoDashboard();
                  } else {
                    onOpenAuth('register');
                  }
                }}
                disabled={host?.plan === 'free'}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  host?.plan === 'free'
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default'
                    : 'border border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900'
                }`}
                id="select_free_tier"
              >
                {host?.plan === 'free' ? t('landing.currentPlanFree') : host ? t('landing.goDashboard') : t('landing.signUpFree')}
              </button>
            </div>

            {/* Pro Tier */}
            <div className="bg-[#090f1d] border-2 border-amber-500/40 rounded-2xl p-6 flex flex-col justify-between hover:border-amber-500/60 transition shadow-xl shadow-amber-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-bold tracking-widest px-3 py-1 uppercase rounded-bl-xl font-display">
                Popular Choice
              </div>
              <div>
                <span className="text-xs uppercase text-amber-400 block tracking-widest mb-1 font-display">{t('landing.proLabel')}</span>
                <h3 className="text-xl font-bold text-white mb-2 font-display">{t('landing.proName')}</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">{t('landing.proDesc')}</p>
                
                <div className="text-3xl font-extrabold text-white mb-6 font-display">$29 <span className="text-xs font-normal text-slate-400">/ monthly</span></div>
                
                <ul className="flex flex-col gap-3 text-xs text-slate-300 mb-8 border-t border-slate-800/80 pt-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Unlimited active giveaway pools</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Unlimited participant capabilities</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Multiple winner draws up to 10</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Custom branding (No watermark)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Premium tracking sources analytics</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!host) onOpenAuth('register');
                  else if (host.plan === 'pro') return;
                  else onRequestUpgrade();
                }}
                disabled={host?.plan === 'pro'}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition shadow-md ${
                  host?.plan === 'pro'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default shadow-none'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-amber-500/10'
                }`}
                id="select_pro_tier"
              >
                {host?.plan === 'pro'
                  ? t('landing.currentPlanPro')
                  : host
                    ? t('landing.upgradePro')
                    : t('landing.signUpPro')}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
