import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Shield,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { useLootlyUI } from '../components/LootlyUI';

interface ArchiveParticipant {
  username: string;
  ticketNumber: number;
  verifiedAt: string | null;
}

interface ArchiveLog {
  id: string;
  instagramUsername: string;
  checkedAt: string;
  result: string;
  message: string;
  failedProfiles?: string[];
}

interface ArchiveData {
  title: string;
  prize: string;
  slug: string;
  drawDate: string;
  seedHash: string;
  revealedSeed: string | null;
  seedVerified: boolean;
  winners: string[];
  disqualifiedList: { username: string; reason: string }[];
  rounds: { winner: string; drawHash: string; winnerIndex: number }[];
  sortedParticipants: ArchiveParticipant[];
  verificationLog: ArchiveLog[];
  totalParticipants: number;
}

interface ArchivePageProps {
  slug: string;
  onSelectRoute?: (route: string) => void;
}

export default function ArchivePage({ slug, onSelectRoute }: ArchivePageProps) {
  const { showToast } = useLootlyUI();
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotReady(false);
      setNotFound(false);
      try {
        const res = await fetch(`/api/giveaway/${encodeURIComponent(slug)}/archive`);
        const json = await res.json();
        if (cancelled) return;

        if (res.status === 404) {
          if (json.error === 'Draw has not taken place yet.') {
            setNotReady(true);
          } else {
            setNotFound(true);
          }
          setData(null);
          return;
        }

        if (!res.ok) {
          setNotFound(true);
          return;
        }

        setData(json as ArchiveData);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const copyArchiveLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/giveaway/${slug}/archive`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Archive link copied', 'success');
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'long',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-mono">Loading permanent draw record…</p>
      </div>
    );
  }

  if (notReady) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white font-display">Draw has not taken place yet</h2>
        <p className="text-sm text-slate-400 mt-2">
          This archive is published only after the giveaway draw is completed.
        </p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white font-display">Archive not found</h2>
        <p className="text-sm text-slate-400 mt-2">No completed draw exists for this campaign slug.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => {
            if (onSelectRoute) {
              onSelectRoute('/archive');
            } else {
              window.location.hash = '#/archive';
            }
          }}
          className="text-xs text-slate-500 hover:text-slate-300 font-mono transition flex items-center gap-1 cursor-pointer"
        >
          ← Search other giveaway
        </button>
        <span className="text-slate-700 font-mono text-xs">|</span>
        <span className="text-xs text-slate-500 font-mono">{slug}</span>
      </div>
      <article className="relative bg-[#090f1d] border-2 border-amber-500/25 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.06),_transparent_55%)] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

        <header className="relative border-b border-slate-800/80 px-6 sm:px-8 py-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/90 font-bold font-mono">
                Official draw certificate
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mt-1">{data.title}</h1>
              <p className="text-sm text-slate-300 mt-1">{data.prize}</p>
              <p className="text-xs text-slate-500 font-mono mt-2">
                Draw date: {formatDate(data.drawDate)} · {data.totalParticipants} verified entrant
                {data.totalParticipants === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={copyArchiveLink}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:border-amber-500/40 hover:text-amber-300 transition cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Archive Link
          </button>
        </header>

        <div className="relative px-6 sm:px-8 py-6 space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500 font-display flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4" />
              Provably Fair Proof
            </h2>
            <div className="space-y-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block mb-1 uppercase text-[10px]">
                  Pre-published seed hash (before draw)
                </span>
                <p className="bg-[#040813] border border-slate-800 rounded-lg p-3 text-slate-200 break-all select-all">
                  {data.seedHash}
                </p>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 uppercase text-[10px]">
                  Revealed seed (at draw)
                </span>
                <p className="bg-[#040813] border border-slate-800 rounded-lg p-3 text-emerald-400 break-all select-all">
                  {data.revealedSeed || '—'}
                </p>
              </div>
              <div
                className={`flex items-center justify-between gap-3 p-4 rounded-xl border ${
                  data.seedVerified
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <span className="text-slate-300 text-sm font-sans">
                  SHA256(revealedSeed) === seedHash
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 font-bold text-sm ${
                    data.seedVerified ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {data.seedVerified ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> Verified
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5" /> Failed
                    </>
                  )}
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-display flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4" />
              Winners
            </h2>
            {data.winners.length === 0 ? (
              <p className="text-sm text-slate-500">No winners recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data.winners.map((winner, i) => (
                  <li
                    key={winner}
                    className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3"
                  >
                    <Trophy className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="font-mono font-bold text-white">
                      {i + 1}. @{winner}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.disqualifiedList.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400 font-display mb-4">
                Disqualified
              </h2>
              <ul className="space-y-2">
                {data.disqualifiedList.map((d) => (
                  <li
                    key={d.username}
                    className="flex flex-wrap justify-between gap-2 bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3 text-sm"
                  >
                    <span className="font-mono text-red-200">@{d.username}</span>
                    <span className="text-red-400/90 text-xs italic">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-display mb-4">
              All Participants
            </h2>
            <ol className="space-y-1.5 text-sm font-mono max-h-64 overflow-y-auto pr-1">
              {data.sortedParticipants.map((p, idx) => (
                <li
                  key={p.username}
                  className="flex justify-between gap-2 bg-[#040813] border border-slate-800/80 rounded-lg px-3 py-2 text-slate-300"
                >
                  <span>
                    {idx + 1}. @{p.username}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {p.ticketNumber} ticket{p.ticketNumber === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-display mb-4">
              Verification Log
            </h2>
            {data.verificationLog.length === 0 ? (
              <p className="text-sm text-slate-500">No verification events logged.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#040813] text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Time</th>
                      <th className="px-3 py-2 font-semibold">User</th>
                      <th className="px-3 py-2 font-semibold">Result</th>
                      <th className="px-3 py-2 font-semibold">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {data.verificationLog.map((log) => (
                      <tr key={log.id} className="text-slate-300">
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px]">
                          {formatDate(log.checkedAt)}
                        </td>
                        <td className="px-3 py-2 font-mono">@{log.instagramUsername}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              log.result === 'passed'
                                ? 'text-emerald-400'
                                : log.result === 'disqualified'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                            }
                          >
                            {log.result}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <footer className="relative border-t border-slate-800/80 px-6 py-4 text-center">
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">
            Lootly permanent archive · #{data.slug}
          </p>
        </footer>
      </article>
    </div>
  );
}
