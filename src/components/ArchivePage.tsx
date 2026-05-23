import React, { useEffect, useState } from 'react';
import { Giveaway, Participant } from '../data';
import { Trophy, Shield, Key, CheckCircle2, Calculator, ArrowRight, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import { useLootlyUI } from './LootlyUI';

interface ArchivePageProps {
  giveaway: Giveaway;
  participants: Participant[];
  onSelectRoute: (route: string) => void;
}

type SandboxResult = {
  orderedList: string[];
  formulaInput: string;
  sha256Result: string;
  resolvedIndex: number;
  winnerUsername: string;
};

export default function ArchivePage({
  giveaway,
  participants,
  onSelectRoute,
}: ArchivePageProps) {
  const { t } = useI18n();
  const { showToast } = useLootlyUI();

  const [playSeed, setPlaySeed] = useState(giveaway.seed || '');
  const [playRoster, setPlayRoster] = useState('');
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [sandboxError, setSandboxError] = useState('');
  const [loadingPlayground, setLoadingPlayground] = useState(false);

  const isCompleted = giveaway.status === 'completed';
  const hasRevealedSeed = Boolean(giveaway.seed && giveaway.seed.length > 0);

  const verifiedUsernames = participants
    .filter((p) => p.verifiedAt !== null)
    .map((p) => p.instagramUsername)
    .sort();

  const ticketRoster: string[] = [];
  verifiedUsernames.forEach((username) => {
    const p = participants.find((part) => part.instagramUsername === username);
    const count = p ? p.ticketCount : 1;
    for (let i = 0; i < count; i++) {
      ticketRoster.push(username);
    }
  });

  useEffect(() => {
    if (giveaway.seed) setPlaySeed(giveaway.seed);
  }, [giveaway.seed]);

  useEffect(() => {
    if (ticketRoster.length > 0 && !playRoster) {
      setPlayRoster(ticketRoster.join(', '));
    }
  }, [ticketRoster.join(',')]);

  const loadCurrentRosterToPlayground = () => {
    if (ticketRoster.length === 0) {
      showToast(t('archive.errRoster'), 'warning');
      return;
    }
    setPlayRoster(ticketRoster.join(', '));
  };

  const handleRunVerificationSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setSandboxError('');
    setSandboxResult(null);

    const seedTrimmed = playSeed.trim();
    if (!seedTrimmed) {
      setSandboxError(t('archive.errSeed'));
      showToast(t('archive.errSeed'), 'warning');
      return;
    }

    const formattedList = playRoster
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (formattedList.length === 0) {
      setSandboxError(t('archive.errRoster'));
      showToast(t('archive.errRoster'), 'warning');
      return;
    }

    setLoadingPlayground(true);
    try {
      const res = await fetch('/api/giveaway/cryptography-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seedTrimmed,
          sortedParticipantCommaList: formattedList.join(','),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || t('archive.errApi');
        setSandboxError(msg);
        showToast(msg, 'error');
        return;
      }
      if (!data.winnerUsername || data.orderedList?.length === 0) {
        setSandboxError(t('archive.errNoUser'));
        showToast(t('archive.errNoUser'), 'error');
        return;
      }
      setSandboxResult(data);
    } catch {
      setSandboxError(t('archive.errApi'));
      showToast(t('archive.errApi'), 'error');
    } finally {
      setLoadingPlayground(false);
    }
  };

  if (!isCompleted) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h3 className="text-lg font-bold text-white font-display">{t('archive.notCompletedTitle')}</h3>
        <p className="text-xs text-slate-400 max-w-md">{t('archive.notCompletedBody')}</p>
        <button
          type="button"
          onClick={() => onSelectRoute(`/giveaway/${giveaway.slug}/draw`)}
          className="mt-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
        >
          {t('archive.goDraw')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8" id="archive_proof_page">
      <div className="bg-[#0b1328] border-2 border-emerald-500/30 p-5 rounded-3xl text-left flex flex-wrap justify-between items-center gap-4 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full font-bold font-display">
              {t('archive.badge')}
            </span>
            <h2 className="text-xl font-bold text-white mt-1.5 font-display">{t('archive.title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{giveaway.title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectRoute('/')}
          className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 transition relative z-10 cursor-pointer"
        >
          {t('archive.home')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-left">
        <div className="md:col-span-7 flex flex-col gap-6">
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> {t('archive.winnersTitle')}
            </h3>
            <div className="flex flex-col gap-3">
              {giveaway.winners && giveaway.winners.length > 0 ? (
                giveaway.winners.map((winner, index) => (
                  <div
                    key={index}
                    className="bg-slate-950 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block">
                        {t('archive.winnerN', { n: index + 1 })}
                      </span>
                      <p className="text-lg font-extrabold text-white mt-1">@{winner}</p>
                    </div>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('archive.verifiedFollows')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl text-center text-slate-500 text-sm">
                  {t('archive.noWinnersYet')}
                </div>
              )}
            </div>

            {giveaway.disqualifiedList && giveaway.disqualifiedList.length > 0 && (
              <div className="border-t border-slate-800 pt-4 mt-2">
                <span className="text-xs font-bold text-red-400 block uppercase mb-2">
                  {t('archive.disqualified')}
                </span>
                <div className="flex flex-col gap-2">
                  {giveaway.disqualifiedList.map((d, dIdx) => (
                    <div
                      key={dIdx}
                      className="bg-slate-950/60 p-2.5 rounded-xl border border-red-900/10 text-xs flex items-center justify-between text-red-300"
                    >
                      <span>@{d.username}</span>
                      <span className="text-[10px] italic">{d.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-6 flex flex-col gap-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase border-b border-slate-800 pb-2 flex items-center gap-2 font-display">
              <Key className="h-4 w-4 text-amber-500" /> {t('archive.cryptoTitle')}
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-amber-500 font-bold block mb-1">1. {t('archive.preHash')}</span>
                <p className="bg-slate-950 p-2.5 rounded text-[10px] select-all break-all text-slate-200 font-code">
                  {giveaway.seedHash}
                </p>
                <span className="text-[9px] text-slate-500 block mt-1">{t('archive.preHashHint')}</span>
              </div>
              <div>
                <span className="text-amber-500 font-bold block mb-1">2. {t('archive.revealedSeed')}</span>
                <p
                  className={`bg-slate-950 p-2.5 rounded text-[10px] select-all break-all font-code ${
                    hasRevealedSeed ? 'text-emerald-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  {hasRevealedSeed ? giveaway.seed : t('archive.missingSeed')}
                </p>
                <span className="text-[9px] text-slate-500 block mt-1">{t('archive.revealedHint')}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-dashed border-emerald-900/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">{t('archive.proofCheck')}</span>
                  <span className="text-xs text-emerald-400 font-bold">{t('archive.proofFormula')}</span>
                </div>
                <div className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded text-xs font-bold">
                  {hasRevealedSeed ? t('archive.proven') : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-semibold text-white font-display">{t('archive.sandboxTitle')}</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{t('archive.sandboxDesc')}</p>

            {sandboxError && (
              <div className="p-2.5 bg-red-950/30 border border-red-900/40 text-red-400 text-xs rounded-lg">
                {sandboxError}
              </div>
            )}

            <form onSubmit={handleRunVerificationSandbox} className="flex flex-col gap-3 text-left text-xs">
              <div>
                <label className="text-[10px] text-slate-300 block mb-1 uppercase">
                  {t('archive.seedInput')}
                </label>
                <input
                  type="text"
                  value={playSeed}
                  onChange={(e) => setPlaySeed(e.target.value)}
                  placeholder={t('archive.seedPh')}
                  className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-300 uppercase">{t('archive.rosterInput')}</label>
                  <button
                    type="button"
                    onClick={loadCurrentRosterToPlayground}
                    className="text-[9px] text-amber-500 hover:underline cursor-pointer"
                  >
                    {t('archive.importRoster', { count: ticketRoster.length })}
                  </button>
                </div>
                <textarea
                  value={playRoster}
                  onChange={(e) => setPlayRoster(e.target.value)}
                  placeholder={t('archive.rosterPh')}
                  rows={4}
                  className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2 text-[10px] text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-1 bg-amber-500 text-slate-950 font-bold py-2 rounded-xl text-xs hover:bg-amber-400 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                disabled={loadingPlayground || !hasRevealedSeed}
                title={!hasRevealedSeed ? t('archive.missingSeed') : undefined}
              >
                {loadingPlayground ? t('archive.computing') : t('archive.verifyMath')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {sandboxResult && (
              <div className="bg-slate-950 border border-slate-900 p-3.5 rounded-2xl text-left text-[10px] flex flex-col gap-2">
                <div className="border-b border-slate-900 pb-1.5 font-bold text-amber-500 uppercase tracking-widest text-center font-display">
                  {t('archive.traceTitle')}
                </div>
                <div>
                  <span className="text-slate-400 block">{t('archive.orderedList')}</span>
                  <div className="bg-slate-900 p-1.5 rounded max-h-16 overflow-y-auto mt-1 text-[9px] text-slate-300">
                    {sandboxResult.orderedList.join(', ')}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block mt-1">{t('archive.formula')}</span>
                  <p className="bg-slate-900 p-1 mt-1 font-bold break-all font-code">{sandboxResult.formulaInput}</p>
                </div>
                <div>
                  <span className="text-slate-400 block mt-1">{t('archive.sha256')}</span>
                  <p className="bg-slate-900 p-1 mt-1 text-emerald-400 break-all font-code">{sandboxResult.sha256Result}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-900">
                  <div className="bg-slate-900/40 p-1.5 rounded">
                    <span className="text-slate-500 text-[8px] block uppercase">{t('archive.moduloIndex')}</span>
                    <span className="text-xs text-white font-bold">{sandboxResult.resolvedIndex}</span>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 rounded">
                    <span className="text-slate-500 text-[8px] block uppercase">{t('archive.winnerHandle')}</span>
                    <span className="text-xs text-amber-400 font-bold">@{sandboxResult.winnerUsername}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
