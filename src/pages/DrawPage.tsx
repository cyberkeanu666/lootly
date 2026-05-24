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
  const [drumText, setDrumText] = useState('');
  const [showDrawAgain, setShowDrawAgain] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState(5);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [winnerUsername, setWinnerUsername] = useState('');

  const drumRef = useRef<HTMLDivElement>(null);
  const winnerSectionRef = useRef<HTMLDivElement>(null);
  const winnerBannerRef = useRef<HTMLDivElement | null>(null);
  const countdownRef = useRef<HTMLDivElement>(null);
  const winnerRevealRef = useRef<HTMLDivElement>(null);

  // Stored payload from draw:completed so we can apply it after the cinematic sequence
  const pendingPayload = useRef<{
    winners: string[];
    disqualifiedList: { username: string; reason: string }[];
    revealedSeed: string;
  } | null>(null);

  // Refs for cleanup of cinematic timers
  const cinematicTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCinematicTimers = () => {
    cinematicTimers.current.forEach(clearTimeout);
    cinematicTimers.current = [];
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setCountdown(null);
  };

  const runDrumRoll = useCallback((finalName: string, onComplete: () => void) => {
    const el = drumRef.current;
    if (!el) {
      onComplete();
      return;
    }

    gsap.set(el, { visibility: 'visible', opacity: 1 });
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
              gsap.to(el, {
                opacity: 0,
                scale: 0.9,
                duration: 0.3,
                delay: 0.6,
                ease: 'power2.in',
                onComplete: () => {
                  gsap.set(el, { visibility: 'hidden' });
                  onComplete();
                },
              });
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

  // Cinematic sequence triggered after draw:completed fires (for spectators)
  const startCinematicSequence = useCallback(
    (payload: {
      winners: string[];
      disqualifiedList: { username: string; reason: string }[];
      revealedSeed: string;
    }) => {
      clearCinematicTimers();
      pendingPayload.current = payload;

      const firstWinner = payload.winners[0] ?? 'winner';
      setWinnerUsername(firstWinner);

      // STEP 1 — Show countdown for 30 seconds
      setStage('winner_drawn');
      setStatusLine('Draw completed');
      setDetailLine('');
      setCountdown(30);

      let tick = 30;
      countdownInterval.current = setInterval(() => {
        tick -= 1;
        if (tick <= 0) {
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          setCountdown(null);
        } else {
          setCountdown(tick);
        }
      }, 1000);

      // STEP 2 — After 30s, run drum roll
      const t1 = setTimeout(() => {
        setCountdown(null);
        setStatusLine(`Drawing winner…`);
        runDrumRoll(firstWinner, () => {
          // Drum roll finished → verifying stage
          setStage('verifying');
          setStatusLine('Verifying winner…');
          setDetailLine('Checking profile follows…');

          // STEP 3 — After 10s of verifying, pass and show winner
          const t2 = setTimeout(() => {
            setStage('winner_verified');
            setStatusLine(`@${firstWinner} — verified ✓`);
            setDetailLine('');
            setWinners(payload.winners);
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

            // STEP 4 — After 3s, move to completed
            const t3 = setTimeout(() => {
              setStage('completed');
              setDisqualified(payload.disqualifiedList);
              setDetailLine(
                payload.winners.length
                  ? `Winners: ${payload.winners.map((w) => `@${w}`).join(', ')}`
                  : 'No winners selected'
              );
              setShowDrawAgain(false);

              // Show Draw Again after 8 seconds
              const t4 = setTimeout(() => {
                setShowDrawAgain(true);
              }, 8000);
              cinematicTimers.current.push(t4);
            }, 3000);
            cinematicTimers.current.push(t3);
          }, 10000);
          cinematicTimers.current.push(t2);
        });
      }, 30000);
      cinematicTimers.current.push(t1);
    },
    [runDrumRoll]
  );

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

  // Cleanup cinematic timers on unmount
  useEffect(() => {
    return () => clearCinematicTimers();
  }, []);

  // Scroll to winner section when draw completes
  useEffect(() => {
    if (stage === 'completed' && winnerSectionRef.current) {
      setTimeout(() => {
        winnerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [stage]);

  // Animate countdown numbers
  useEffect(() => {
    if (countdownActive && countdownRef.current && countdownNumber > 0) {
      const el = countdownRef.current;
      gsap.fromTo(
        el,
        { scale: 2.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.4)' }
      );
      gsap.to(el, {
        opacity: 0,
        scale: 0.8,
        duration: 0.25,
        delay: 0.55,
      });
    }
  }, [countdownActive, countdownNumber]);

  // Animate winner reveal
  useEffect(() => {
    if (stage === 'winner_drawn' && winnerRevealRef.current) {
      gsap.fromTo(
        winnerRevealRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }
      );
    }
  }, [stage]);

  // Animate winner confirmed banner
  useEffect(() => {
    if (stage === 'winner_verified' && winnerBannerRef.current) {
      gsap.fromTo(
        winnerBannerRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }
      );
    }
  }, [stage]);

  // Animate winner list items after React renders them
  useEffect(() => {
    if (stage === 'completed' && winners.length > 0) {
      const id = setTimeout(() => {
        gsap.from('.winner-list-item', {
          y: 15,
          opacity: 0,
          stagger: 0.1,
          duration: 0.4,
        });
      }, 80);
      return () => clearTimeout(id);
    }
  }, [stage, winners]);

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
        setWinnerUsername(payload.username);
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

    // draw:winner_verified is intentionally ignored during cinematic sequence —
    // the frontend controls the reveal timing itself via startCinematicSequence.

    socket.on(
      'draw:completed',
      (payload: {
        winners: string[];
        disqualifiedList: { username: string; reason: string }[];
        revealedSeed: string;
      }) => {
        // Kick off cinematic staged reveal instead of jumping to completed immediately
        startCinematicSequence(payload);
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [giveaway?.id, runDrumRoll, startCinematicSequence]);

  const handleStartDraw = useCallback(async () => {
    if (!giveaway || starting) return;
    setStarting(true);
    setCountdownActive(true);
    setCountdownNumber(5);

    // Countdown animation: 5 → 4 → 3 → 2 → 1
    let current = 5;
    const countdownInterval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdownNumber(current);
      } else {
        clearInterval(countdownInterval);
        setCountdownActive(false);
        setCountdownNumber(0);

        // After countdown, call the API
        authFetch(`/api/giveaway/draw-start/${giveaway.id}`, {
          method: 'POST',
        })
          .then(async (res) => {
            const data = await res.json();
            if (res.status === 401) {
              setStage('error');
              setStatusLine('Session expired');
              setDetailLine('Please log in again from the home page.');
              setStarting(false);
              return;
            }
            if (!res.ok) {
              setStage('error');
              setStatusLine('Draw failed to start');
              setDetailLine(data.error || 'Server error');
              setStarting(false);
              return;
            }

            const winner = data.winners?.[0];
            if (winner) {
              setWinnerUsername(winner);
              setWinners(data.winners || []);
              setDisqualified(data.disqualifiedList || []);

              // Show drum roll with winner
              runDrumRoll(winner, () => {
                setStage('winner_drawn');
                setStatusLine('Winner selected!');
                setDetailLine('');

                // Check if verification is needed
                if (giveaway.requiredProfiles && giveaway.requiredProfiles.length > 0) {
                  // Start verification phase after 2 seconds
                  setTimeout(() => {
                    setStage('verifying');
                    setStatusLine(`Verifying @${winner}…`);
                    setDetailLine('Checking required profile follows…');
                    setVerifyProgress(0);

                    // Animate progress bar over 10 seconds
                    setTimeout(() => {
                      setVerifyProgress(100);
                    }, 50);

                    // After 10 seconds, pass verification
                    setTimeout(() => {
                      setStage('winner_verified');
                      setStatusLine('');
                      setDetailLine('');
                      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

                      // Move to completed after 2 seconds
                      setTimeout(() => {
                        setStage('completed');
                        setShowDrawAgain(false);

                        // Show Draw Again after 8 seconds
                        setTimeout(() => {
                          setShowDrawAgain(true);
                        }, 8000);
                      }, 2000);
                    }, 10000);
                  }, 2000);
                } else {
                  // No verification needed, go straight to winner confirmed after 2 seconds
                  setTimeout(() => {
                    setStage('winner_verified');
                    setStatusLine('');
                    setDetailLine('');
                    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

                    // Move to completed after 2 seconds
                    setTimeout(() => {
                      setStage('completed');
                      setShowDrawAgain(false);

                      // Show Draw Again after 8 seconds
                      setTimeout(() => {
                        setShowDrawAgain(true);
                      }, 8000);
                    }, 2000);
                  }, 2000);
                }
              });
            }
            setStarting(false);
          })
          .catch(() => {
            setStage('error');
            setStatusLine('Draw failed to start');
            setDetailLine('Network error');
            setStarting(false);
          });
      }
    }, 900);
  }, [giveaway, starting, runDrumRoll]);

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
          {/* Countdown overlay - full screen centered number */}
          {countdownActive && countdownNumber > 0 && (
            <div className="flex items-center justify-center py-12">
              <div
                ref={countdownRef}
                className="text-9xl font-black text-white"
              >
                {countdownNumber}
              </div>
            </div>
          )}

          {/* Winner drawn stage */}
          {stage === 'winner_drawn' && !countdownActive && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Trophy className="h-16 w-16 text-amber-400" />
              <div
                ref={winnerRevealRef}
                className="text-4xl font-bold text-amber-400 font-mono"
              >
                @{winnerUsername}
              </div>
              <p className="text-lg text-white font-semibold">{statusLine}</p>
              {stage === 'verifying' && (
                <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-4">
                  <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                  <p className="text-sm text-slate-400 font-mono">{detailLine}</p>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-[10000ms] ease-linear"
                      style={{ width: `${verifyProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Winner verified stage */}
          {stage === 'winner_verified' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Trophy className="h-10 w-10 text-emerald-400" />
              </div>
              <p
                ref={(el) => { winnerBannerRef.current = el; }}
                className="text-3xl font-bold text-emerald-400 font-mono"
              >
                @{winnerUsername}
              </p>
              <p className="text-xl text-white font-semibold">🏆 Winner confirmed!</p>
              <button
                type="button"
                onClick={() => onSelectRoute?.(`/giveaway/${slug}/archive`)}
                className="mt-4 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl transition cursor-pointer"
              >
                View Proof Archive
              </button>
            </div>
          )}

          {/* Completed stage */}
          {stage === 'completed' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div ref={winnerSectionRef} className="flex flex-wrap justify-center gap-2 mb-4">
                {winners.map((w) => (
                  <span
                    key={w}
                    className="winner-list-item px-4 py-2 rounded-full bg-amber-500 text-slate-950 text-base font-bold font-mono"
                  >
                    @{w}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectRoute?.(`/giveaway/${slug}/archive`)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2"
                >
                  � View Proof Archive
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(`${window.location.origin}/#/giveaway/${slug}/archive`)
                      .then(() => alert('Archive link copied!'))
                  }
                  className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  🔗 Copy Archive Link
                </button>
              </div>
            </div>
          )}

          {/* Default status display for other stages */}
          {!countdownActive && stage !== 'winner_drawn' && stage !== 'winner_verified' && stage !== 'completed' && (
            <>
              <div className="flex justify-center mb-4">
                {stage === 'verifying' || stage === 'started' || starting ? (
                  <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                ) : (
                  <Trophy className="h-10 w-10 text-slate-600" />
                )}
              </div>

              {/* Drum roll display — visibility controlled entirely by GSAP */}
              <div
                ref={drumRef}
                id="drum-display"
                className="mb-4 font-mono font-bold text-amber-400 text-center"
                style={{ fontSize: '2.5rem', visibility: 'hidden' }}
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

              {/* Countdown ticker shown during the 30s hold after draw:completed (for spectators) */}
              {countdown !== null && (
                <p className="text-sm text-slate-500 font-mono mt-2">
                  Revealing winner in {countdown}…
                </p>
              )}

              {detailLine && (
                <div id="seed-display">
                  <p className="text-xs text-slate-400 mt-3 font-mono leading-relaxed break-words">
                    {detailLine}
                  </p>
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
            </>
          )}
        </div>

        {isHost && stage !== 'completed' && !countdownActive && (
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
