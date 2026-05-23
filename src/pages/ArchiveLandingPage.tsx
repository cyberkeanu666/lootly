import React, { useState } from 'react';
import { Giveaway } from '../data';
import { Search, Calendar, ChevronRight, Trophy, FileCheck } from 'lucide-react';

interface ArchiveLandingPageProps {
  completedGiveaways: Giveaway[];
  onSelectRoute: (route: string) => void;
}

export default function ArchiveLandingPage({
  completedGiveaways,
  onSelectRoute,
}: ArchiveLandingPageProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = inputValue.trim();
    if (slug) {
      onSelectRoute(`/giveaway/${slug}/archive`);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-slate-200">
      <div className="text-center mb-10">
        <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl mb-4 relative">
          <FileCheck className="h-8 w-8" />
          <div className="absolute inset-0 bg-amber-500/10 rounded-2xl blur-md scale-110"></div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
          Proof Archive
        </h1>
        <p className="text-sm text-slate-450 mt-2 max-w-md mx-auto">
          Verify any giveaway draw — provably fair, permanently recorded.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-6 shadow-xl mb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.04),_transparent_60%)] pointer-events-none" />
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Enter giveaway slug (e.g. nike-giveaway-2026)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-[#040813] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition placeholder-slate-600"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition duration-200 cursor-pointer shadow-lg shadow-amber-500/10 uppercase tracking-wider shrink-0 flex items-center justify-center gap-1.5"
          >
            View Archive
          </button>
        </form>
      </div>

      {/* Completed Campaigns List */}
      <div>
        <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-amber-500" />
          Completed Sweepstakes ({completedGiveaways.length})
        </h2>

        {completedGiveaways.length === 0 ? (
          <div className="py-12 border border-dashed border-slate-800 rounded-3xl text-center text-slate-500 flex flex-col items-center gap-2 bg-[#090f1d]/20">
            <Trophy className="h-10 w-10 text-slate-700 stroke-1" />
            <p className="font-sans text-sm">No completed giveaways yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {completedGiveaways.map((g) => (
              <div
                key={g.id}
                onClick={() => onSelectRoute(`/giveaway/${g.slug}/archive`)}
                className="flex items-center justify-between gap-4 bg-[#090f1d] border border-slate-800/80 rounded-2xl px-5 py-4 hover:border-slate-750 hover:bg-[#0c1427]/80 transition duration-200 cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition truncate">
                    {g.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-500">lootly.gg/g/{g.slug}</span>
                    <span className="text-slate-600 font-sans">•</span>
                    <span className="flex items-center gap-1 font-sans">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      {formatDate(g.drawDate)}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 rounded-lg group-hover:border-amber-500/40 group-hover:text-amber-400 transition duration-250 flex items-center gap-1 shrink-0"
                >
                  View
                  <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
