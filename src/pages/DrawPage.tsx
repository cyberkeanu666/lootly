import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { gsap } from 'gsap';
import { Giveaway } from '../data';
import { authFetch, hasAuthSession, loadStoredHost } from '../utils/authHeaders';
import { Play, Trophy, Loader2 } from 'lucide-react';

interface DrawPageProps {
  slug: string;
  onSelectRoute?: (route: string) => void;
}

type DrawStage =
  | 'loading'
  | 'waiting'
  | 'started'
  | 'seed_revealed'
  | 'winner_drawn'
  | 'verifying'
  | 'winner_verified'
  | 'completed'
  | 'error';

const FAKE_DRUM_NAMES = [
  'user_8821',
  'the.real.alex',
  'gamer99',
  'photo.lena',
  'crypto_kid',
  'daily.vibes',
  'traveler_mike',
  'style.by.jo',
  'nightowl_42',
  'fitness.queen',
  'musicfan_x',
  'chef.marco',
  'urban.skater',
  'bookworm_ella',
  'sunset.chaser',
  'pixel.art.dev',
  'coffee.and.code',
  'wildlife.lens',
];

function pickFakeNames(count: number): string[] {
  const shuffled = [...FAKE_DRUM_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function DrawPage({ slug, onSelectRoute }: DrawPageProps) {
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<DrawStage>('loading');
  const [statusLine, setStatusLine] = useState('Connecting to live draw…');
  const [detailLine, setDetailLine] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [starting, setStarting] = useState(false);
  const [winners, setWinners] = useState<string[]>([]);
  const [disqualified, setDisqualified] = useState<{ username: string; reason: string }[]>([]);
  const [drumVisible, setDrumVisible] = useState(false);
  const [drumText, setDrumText] = useState('');
  const [showDrawAgain, setShowDrawAgain] = useState(false);
  const drumRef = useRef<HTMLDivElement>(null);
  const winnerSectionRef = useRef<HTMLDivElement>(null);

  const runDrumRoll = useCallback((finalName: string, onComplete: () => void) => {
    const el = drumRef.current;
    if (!el) {
      onComplete();
      return;
    }

    setDrumVisible(true);
    const fakeCount = 8 + Math.floor(Math.random() * 5);
    const pool = pickFakeNames(fakeCount);
    const fastSteps = Math.floor(1000 / 80);
    const slowSteps = Math.floor(500 / 200);
    const sequence: string[] = [];

    for (let i = 0; i < fastSteps; i++) {
      sequence.push(pool[i % pool.length]!);
    }
    for (let i = 0; i < slowSteps; i++) {
      sequence.push(pool[(fastSteps + i) % pool.length]!);
    }

    const displayName = (name: string) => `@${name.replace(/^@/, '')}`;

    const tl = gsap.timeline({
      onComplete: () => {
        setDrumText(displayName(finalName));
        gsap.fromTo(
          el,
          { scale: 1.4, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
              setDrumVisible(false);
              onComplete();
            },
          }
        );
      },
    });

    sequence.forEach((name, i) => {
      const delay = i < fastSteps ? i * 0.08 : fastSteps * 0.08 + (i - fastSteps) * 0.2;
      tl.call(
        () => {
          setDrumText(displayName(name));
          gsap.set(el, { scale: 1, opacity: 1 });
        },
        [],
        delay
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/giveaway/by-slug/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            setLoadError(data.error || 'Giveaway not found');
            setStage('error');
          }
          return;
        }
        if (cancelled) return;

        const gw = data as Giveaway;
        setGiveaway(gw);

        const host = loadStoredHost();
        setIsHost(hasAuthSession() && host?.id === gw.hostId);

        if (gw.status === 'completed') {
          setStage('completed');
          setWinners(gw.winners || []);
          setDisqualified(gw.disqualifiedList || []);
          setStatusLine('Draw already completed');
        } else {
          setStage('waiting');
          setStatusLine('Waiting for draw to start…');
        }
      } catch {
        if (!cancelled) {
          setLoadError('Failed to load giveaway');
          setStage('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Scroll to winner section when draw completes
  useEffect(() => {
    if (stage === 'completed' && winnerSectionRef.current) {
      setTimeout(() => {
        winnerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [stage]);


  useEffect(() => {
    if (!giveaway?.id) return;

    const socket: Socket = io();
    socket.emit('join:giveaway', { giveawayId: giveaway.id });

    socket.on('draw:started', (payload: { totalParticipants: number; giveawayTitle: string }) => {
      setStage('started');
      setStatusLine('Draw started');
      setDetailLine(
        `${payload.giveawayTitle} — ${payload.totalParticipants} verified participant(s)`
      );
    });

    socket.on(
      'draw:seed_revealed',
      (payload: { seed: string; seedHash: string; sortedPool: string[] }) => {
        setStage('seed_revealed');
        setStatusLine('Campaign seed revealed');
        setDetailLine(
          `Pool size: ${payload.sortedPool.length} ticket(s) · Hash: ${payload.seedHash.slice(0, 16)}…`
        );
        requestAnimationFrame(() => {
          gsap.from('#seed-display', { duration: 0.6, y: 20, opacity: 0, ease: 'power2.out' });
        });
      }
    );

    socket.on(
      'draw:winner_drawn',
      (payload: { username: string; drawHash: string; winnerIndex: number; roundNumber: number }) => {
        setStatusLine(`Drawing winner…`);
        setShowDrawAgain(false);

        // Run drum roll animation, THEN reveal winner
        runDrumRoll(payload.username, () => {
          setStage('winner_drawn');
          setStatusLine(`Winner drawn: @${payload.username} — awaiting verification`);
          setDetailLine(`Draw hash: ${payload.drawHash}`);
        });
      }
    );

    socket.on('draw:verifying', (payload: { username: string }) => {
      setStage('verifying');
      setStatusLine(`Verifying @${payload.username}…`);
      setDetailLine('Checking required profile follows');
    });

    socket.on(
      'draw:winner_verified',
      (payload: { username: string; passed: boolean; missingProfiles: string[] }) => {
        setStage('winner_verified');
        if (payload.passed) {
          setStatusLine(`@${payload.username} verified — winner confirmed`);
          setDetailLine('');
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.55 } });
          requestAnimationFrame(() => {
            gsap.fromTo(
              '#winner-banner',
              { scale: 0.8, opacity: 0 },
              { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }
            );
          });
        } else {
          setStatusLine(`@${payload.username} disqualified`);
          setDetailLine(
            payload.missingProfiles.length
              ? `Missing: ${payload.missingProfiles.map((p) => `@${p}`).join(', ')}`
              : 'Follow audit failed'
          );
        }
      }
    );

    socket.on(
      'draw:completed',
      (payload: {
        winners: string[];
        disqualifiedList: { username: string; reason: string }[];
        revealedSeed: string;
      }) => {
        setStage('completed');
        setWinners(payload.winners);
        setDisqualified(payload.disqualifiedList);
        setStatusLine('Draw completed');
        setDetailLine(
          payload.winners.length
            ? `Winners: ${payload.winners.map((w) => `@${w}`).join(', ')}`
            : 'No winners selected'
        );
        requestAnimationFrame(() => {
          gsap.from('.winner-list-item', {
            duration: 0.4,
            y: 15,
            opacity: 0,
            stagger: 0.1,
            ease: 'power2.out',
          });
        });
        // Keep winner revealed for 6 seconds before allowing Draw Again
        setShowDrawAgain(false);
        setTimeout(() => {
          setShowDrawAgain(true);
        }, 6000);
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [giveaway?.id, runDrumRoll]);

  const handleStartDraw = useCallback(async () => {
    if (!giveaway || starting) return;
    setStarting(true);
    setStatusLine('Starting draw on server…');
    try {
      const res = await authFetch(`/api/giveaway/draw-start/${giveaway.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.status === 401) {
        setStage('error');
        setStatusLine('Session expired');
        setDetailLine('Please log in again from the home page.');
        return;
      }
      if (!res.ok) {
        setStage('error');
        setStatusLine('Draw failed to start');
        setDetailLine(data.error || 'Server error');
        return;
      }
      setWinners(data.winners || []);
      setDisqualified(data.disqualifiedList || []);
    } catch {
      setStage('error');
      setStatusLine('Draw failed to start');
      setDetailLine('Network error');
    } finally {
      setStarting(false);
    }
  }, [giveaway, starting]);

  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-[#040813] flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-mono">Loading draw room…</p>
      </div>
    );
  }

  if (loadError || !giveaway) {
    return (
      <div className="min-h-screen bg-[#040813] flex flex-col items-center justify-center text-center px-6 gap-4">
        <p className="text-red-400 text-sm font-semibold">{loadError || 'Giveaway not found'}</p>
        {onSelectRoute && (
          <button
            type="button"
            onClick={() => onSelectRoute('/')}
            className="text-xs text-amber-500 hover:text-amber-400 cursor-pointer"
          >
            Go home
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040813] text-[#f1f5f9] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center max-w-2xl mx-auto w-full">
        <span className="text-[10px] uppercase tracking-widest text-amber-500/80 font-mono mb-2">
          Live draw
        </span>
        <h1 className="text-2xl md:text-3xl font-bold font-display text-white mb-1">
          {giveaway.title}
        </h1>
        <p className="text-xs text-slate-500 font-mono mb-10">#{giveaway.slug}</p>

        <div
          className={`w-full rounded-3xl border p-8 transition-all duration-300 ${
            stage === 'completed'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : stage === 'error'
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-slate-800 bg-[#090f1d]'
          }`}
        >
          <div className="flex justify-center mb-4">
            {stage === 'completed' ? (
              <Trophy className="h-10 w-10 text-amber-400" />
            ) : stage === 'verifying' || stage === 'started' || starting ? (
              <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
            ) : (
              <Trophy className="h-10 w-10 text-slate-600" />
            )}
          </div>

          <div
            ref={drumRef}
            id="drum-display"
            className={`mb-4 font-mono font-bold text-amber-400 text-center ${
              drumVisible ? 'block' : 'hidden'
            }`}
            style={{ fontSize: '2rem' }}
          >
            {drumText}
          </div>

          <p
            className={`text-lg font-semibold text-white ${
              ['started', 'seed_revealed', 'winner_drawn', 'verifying'].includes(stage)
                ? 'animate-pulse'
                : ''
            }`}
          >
            {statusLine}
          </p>
          {stage === 'winner_verified' && winners.length > 0 && (
            <p
              id="winner-banner"
              className="text-xl font-bold text-emerald-400 mt-2"
            >
              🏆 Winner confirmed!
            </p>
          )}
          {detailLine && (
            <div id="seed-display">
              <p className="text-xs text-slate-400 mt-3 font-mono leading-relaxed break-words">
                {detailLine}
              </p>
            </div>
          )}

          {stage === 'completed' && winners.length > 0 && (
            <div ref={winnerSectionRef} className="mt-6 flex flex-col items-center gap-4">
              <div className="flex flex-wrap justify-center gap-2">
                {winners.map((w) => (
                  <span
                    key={w}
                    className="winner-list-item px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-sm font-bold font-mono"
                  >
                    @{w}
                  </span>
                ))}
              </div>
              {/* Proof Archive link — always visible after completed */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => onSelectRoute?.(`/giveaway/${slug}/archive`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  🔒 View Proof Archive
                </button>
              </div>
            </div>
          )}

          {disqualified.length > 0 && (
            <div className="mt-4 text-left text-[11px] text-red-300/90 font-mono space-y-1">
              <p className="text-red-400 uppercase text-[10px] font-bold">Disqualified</p>
              {disqualified.map((d) => (
                <p key={d.username}>
                  @{d.username} — {d.reason}
                </p>
              ))}
            </div>
          )}

          {stage === 'completed' && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => onSelectRoute?.(`/giveaway/${slug}/archive`)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2"
              >
                📋 View Public Proof Archive
              </button>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${window.location.origin}/giveaway/${slug}/archive`)
                    .then(() => alert('Archive link copied!'))
                }
                className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                🔗 Copy Archive Link
              </button>
            </div>
          )}
        </div>

        {isHost && stage !== 'completed' && (
          <button
            type="button"
            onClick={handleStartDraw}
            disabled={starting || giveaway.status === 'drawing'}
            className="mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-extrabold text-sm disabled:opacity-50 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            {starting ? 'Drawing…' : 'Start Draw'}
          </button>
        )}

        {isHost && stage === 'completed' && showDrawAgain && (
          <button
            type="button"
            onClick={handleStartDraw}
            disabled={starting}
            className="mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-extrabold text-sm disabled:opacity-50 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            {starting ? 'Drawing…' : 'Draw Again'}
          </button>
        )}

        {!isHost && stage === 'waiting' && (
          <p className="mt-8 text-xs text-slate-500 font-mono">
            Spectating — waiting for host to start the draw
          </p>
        )}

      </div>
    </div>
  );
}
