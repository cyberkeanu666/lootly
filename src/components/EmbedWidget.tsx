import React, { useState, useEffect } from 'react';
import { Giveaway, Participant } from '../data';
import { Trophy, Clock, Users, ExternalLink } from 'lucide-react';

interface EmbedWidgetProps {
  giveaway: Giveaway;
  participants: Participant[];
  onSelectRoute: (route: string) => void;
}

export default function EmbedWidget({
  giveaway,
  participants,
  onSelectRoute
}: EmbedWidgetProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(giveaway.drawDate).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [giveaway.drawDate]);

  const verifiedCount = participants.filter(p => p.verifiedAt !== null).length;

  return (
    <div className="w-full max-w-[340px] bg-slate-950 border-2 border-slate-800 p-4 rounded-2xl flex flex-col justify-between min-h-[250px] relative text-left shadow-2xl font-sans text-gray-200">
      
      {/* Small Banner */}
      <div className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded-lg border border-slate-850">
        <span className="text-[9px] font-mono uppercase text-amber-500 font-bold tracking-widest flex items-center gap-1">
          <Trophy className="h-3 w-3 animate-pulse" /> Live Giveaway Widget
        </span>
        <span className="text-[8px] font-mono text-slate-500">Slug: {giveaway.slug}</span>
      </div>

      <div className="mt-2.5">
        <h4 className="text-sm font-extrabold text-white leading-tight truncate">{giveaway.title}</h4>
        <p className="text-[10px] text-slate-450 mt-0.5 truncate">Win: {giveaway.prize}</p>
      </div>

      {/* Sleek countdown timer */}
      <div className="grid grid-cols-4 gap-1.5 mt-3 text-center font-mono text-xs">
        <div className="bg-slate-900 border border-slate-850 p-1.5 rounded-lg flex flex-col">
          <span className="text-white font-bold">{timeLeft.days}</span>
          <span className="text-[7px] text-slate-500 uppercase">d</span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-1.5 rounded-lg flex flex-col">
          <span className="text-white font-bold">{timeLeft.hours}</span>
          <span className="text-[7px] text-slate-500 uppercase">h</span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-1.5 rounded-lg flex flex-col">
          <span className="text-white font-bold">{timeLeft.minutes}</span>
          <span className="text-[7px] text-slate-500 uppercase">m</span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-1.5 rounded-lg flex flex-col">
          <span className="text-white font-bold">{timeLeft.seconds}</span>
          <span className="text-[7px] text-slate-500 uppercase">s</span>
        </div>
      </div>

      {/* Participants & direct link join */}
      <div className="mt-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span className="flex items-center gap-1"><Users className="h-3 w-3 text-amber-500" /> {verifiedCount} Verified Entries</span>
          <span>Odds-boost Enabled</span>
        </div>

        <button
          onClick={() => onSelectRoute(`/giveaway/${giveaway.slug}`)}
          className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold tracking-wide hover:bg-amber-400 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/15"
        >
          <span>Claim Sweepstake Entry</span> <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Freemium branding watermark */}
      {giveaway.watermark && (
        <div className="text-center text-[8px] text-slate-600 font-mono tracking-widest uppercase mt-3.5 border-t border-slate-900 pt-2">
          Powered by <span className="font-extrabold text-amber-500/80">Lootly.gg</span> Watermark
        </div>
      )}

    </div>
  );
}
