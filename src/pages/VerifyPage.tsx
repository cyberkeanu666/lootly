import React, { useState } from 'react';
import { Calculator, Loader2, Trophy } from 'lucide-react';

type SandboxResult = {
  orderedList: string[];
  formulaInput: string;
  sha256Result: string;
  decimalBigInt: string;
  resolvedIndex: number;
  winnerUsername: string;
};

export default function VerifyPage() {
  const [seed, setSeed] = useState('');
  const [participantsInput, setParticipantsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SandboxResult | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const seedTrimmed = seed.trim();
    const listTrimmed = participantsInput.trim();

    if (!seedTrimmed) {
      setError('Revealed seed is required.');
      return;
    }
    if (!listTrimmed) {
      setError('Participant usernames are required (comma separated).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/giveaway/cryptography-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seedTrimmed,
          sortedParticipantCommaList: listTrimmed,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification request failed.');
        return;
      }

      if (!data.winnerUsername || !data.orderedList?.length) {
        setError('Could not resolve a winner from the participant list.');
        return;
      }

      setResult(data as SandboxResult);
    } catch {
      setError('Network error — could not reach the verification API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <header className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
          <Calculator className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
          Independent Draw Verification
        </h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed max-w-lg mx-auto">
          Paste the seed and participant list from any completed Lootly draw to independently
          verify the winner.
        </p>
      </header>

      <form
        onSubmit={handleVerify}
        className="bg-[#090f1d] border border-slate-800 rounded-2xl p-6 space-y-5"
      >
        <div>
          <label
            htmlFor="verify-seed"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
          >
            Revealed Seed
          </label>
          <input
            id="verify-seed"
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Paste the seed revealed at draw time"
            className="w-full bg-[#040813] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div>
          <label
            htmlFor="verify-participants"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
          >
            Participant Usernames (comma separated)
          </label>
          <textarea
            id="verify-participants"
            value={participantsInput}
            onChange={(e) => setParticipantsInput(e.target.value)}
            placeholder="alice,bob,charlie"
            rows={4}
            className="w-full bg-[#040813] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500/50 resize-y"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-extrabold text-sm disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify'
          )}
        </button>
      </form>

      {result && (
        <div className="mt-8 space-y-5">
          <section className="bg-[#090f1d] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              Step 1 — Sorted participant list
            </h2>
            <ol className="space-y-1.5 text-sm font-mono text-slate-300">
              {result.orderedList.map((name, idx) => (
                <li key={`${name}-${idx}`} className="flex gap-2">
                  <span className="text-slate-500 w-6 shrink-0">{idx + 1}.</span>
                  <span>@{name}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="bg-[#090f1d] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              Step 2 — Formula input
            </h2>
            <pre className="bg-[#040813] border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {result.formulaInput}
            </pre>
          </section>

          <section className="bg-[#090f1d] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              Step 3 — SHA-256 hash
            </h2>
            <pre className="bg-[#040813] border border-slate-800 rounded-lg p-3 text-[11px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {result.sha256Result}
            </pre>
          </section>

          <section className="bg-[#090f1d] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              Step 4 — Winner index
            </h2>
            <p className="text-lg font-mono text-white">
              <span className="text-amber-400 font-bold">{result.resolvedIndex}</span>
              <span className="text-slate-500"> / {result.orderedList.length}</span>
            </p>
          </section>

          <section className="bg-gradient-to-br from-amber-500/10 to-emerald-500/5 border-2 border-amber-500/30 rounded-2xl p-6 text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              Step 5 — Winner
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white font-display flex items-center justify-center gap-2 flex-wrap">
              <Trophy className="h-8 w-8 text-amber-400 shrink-0" aria-hidden />
              <span>@{result.winnerUsername}</span>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
