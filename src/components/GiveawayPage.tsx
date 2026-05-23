import React, { useState, useEffect } from 'react';
import { Giveaway, Participant } from '../data';
import { Trophy, Shield, Clock, Users, ArrowRight, CheckCircle2, AlertTriangle, Share2, Clipboard, QrCode, Code, Eye } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import { useLootlyUI } from './LootlyUI';

interface GiveawayPageProps {
  giveaway: Giveaway;
  participants: Participant[];
  onJoinRequest: (username: string, referredBy?: string, email?: string) => Promise<any>;
  onVerifyRequest: (participantId: string) => Promise<any>;
  onSelectRoute: (route: string) => void;
  referralCode?: string; // parsed from url query ?ref=XYZ
  currentHostId?: string;
}

export default function GiveawayPage({
  giveaway,
  participants = [],
  onJoinRequest,
  onVerifyRequest,
  onSelectRoute,
  referralCode,
  currentHostId,
}: GiveawayPageProps) {
  const { t } = useI18n();
  const { showToast } = useLootlyUI();
  const isOwner = Boolean(currentHostId && currentHostId === giveaway.hostId);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [referrer, setReferrer] = useState(referralCode || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [successJoin, setSuccessJoin] = useState(false);
  const [createdParticipant, setCreatedParticipant] = useState<Participant | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  // Countdown timer calculations
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const verifiedParticipants = participants.filter((p) => p.verifiedAt !== null);

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

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsJoining(true);

    const res = await onJoinRequest(username, referrer, email);
    setIsJoining(false);

    if (res && res.error) {
      setErrorMessage(res.error);
    } else if (res && res.verificationCodeNum) {
      setVerificationCode(res.verificationCodeNum);
      setParticipantId(res.participantId);
    }
  };

  const startScrapeVerification = async () => {
    setIsVerifying(true);
    setVerifyStep(1);
    setVerifyMessage('Checking your Instagram profile…');

    setVerifyStep(2);
    setVerifyMessage('Looking for your verification code in bio…');

    const res = await onVerifyRequest(participantId);

    if (res?.stage) {
      setVerifyMessage('Finalizing verification…');
      setVerifyStep(5);
    }
    setIsVerifying(false);

    if (res && res.success) {
      setSuccessJoin(true);
      setCreatedParticipant(res.participant);
    } else {
      setErrorMessage(
        res?.message ||
          'Verification code not found in your Instagram bio. Make sure: (1) Your profile is public, (2) The code is copied exactly as shown, (3) Wait 1-2 minutes after saving your bio, then try again.'
      );
    }
  };

  const refreshCode = async () => {
    if (!participantId) return;
    setErrorMessage('');
    const res = await fetch('/api/participants/refresh-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId }),
    });
    const data = await res.json();
    if (data.verificationCodeNum) {
      setVerificationCode(data.verificationCodeNum);
      setErrorMessage('');
    } else {
      setErrorMessage(data.error || 'Failed to refresh code.');
    }
  };

  const referralShareUrl = (handle: string) =>
    `${window.location.origin}${window.location.pathname}?ref=${handle.toLowerCase().replace('@', '')}`;

  const handleCopyRef = (url?: string) => {
    const refUrl =
      url ||
      referralShareUrl(createdParticipant?.instagramUsername || username);
    navigator.clipboard.writeText(refUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8" id="lootly_public_giveaway">
      
      {/* Header Integrity Bar */}
      <div className="bg-[#0b1328] border border-amber-500/20 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <span className="text-xs text-slate-300">{t('giveaway.integrity')}:</span>
          <span className="text-xs text-amber-500 font-mono font-bold truncate max-w-xs" title={giveaway.seedHash}>
            SHA256: {giveaway.seedHash}
          </span>
        </div>
        <div className="text-[10px] text-slate-400">{t('giveaway.integrityHint')}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-left">
        
        {/* Left Side: Prize Graphics & Details (7-cols) */}
        <div className="md:col-span-7 flex flex-col gap-6">
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="h-56 relative bg-slate-900 border-b border-slate-850">
              <img src={giveaway.prizeImageURL} alt={giveaway.prize} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
              
              <div className="absolute bottom-4 left-4">
                <span className="text-[10px] font-mono tracking-widest bg-amber-500 text-slate-950 px-2 py-1 rounded-full uppercase font-bold">
                  {giveaway.mode === 'verified' ? t('giveaway.bioRequired') : t('giveaway.simpleMode')}
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-white mt-1.5">{giveaway.prize}</h2>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">{t('giveaway.prizeSpecs')}</h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">{giveaway.prizeDescription}</p>
              </div>

              {/* Requirement details */}
              <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex flex-col gap-2.5">
                <span className="text-xs text-slate-400 uppercase tracking-wider block">{t('giveaway.milestone')}</span>
                
                {giveaway.requiredProfiles.length > 0 ? (
                  giveaway.requiredProfiles.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 font-bold" />
                      <span>{t('giveaway.followProfile', { handle: p })}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="h-4 w-4 text-slate-600" />
                    <span>{t('giveaway.honorSystem')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Giveaway Embed Overlay code snippet generator */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
            <button
              onClick={() => setShowEmbedCode(!showEmbedCode)}
              className="w-full flex justify-between items-center text-xs text-slate-400 hover:text-white transition cursor-pointer font-mono"
            >
              <span className="flex items-center gap-2">
                <Code className="h-4 w-4 text-slate-500" /> OBS Stream Overlay Widget Embed code
              </span>
              <Eye className="h-4 w-4 text-slate-500" />
            </button>
            
            {showEmbedCode && (
              <div className="mt-4 p-3 bg-slate-950 border border-slate-850 rounded-xl flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 font-mono">Streamers: paste this iframe snippet to embed live countdown metrics inside overlays:</span>
                <code className="text-[10px] font-mono text-emerald-400 bg-slate-900 p-2 rounded block overflow-x-auto select-all">
                  {`<iframe src="https://lootly.gg/embed/${giveaway.slug}" width="340" height="260" frameborder="0"></iframe>`}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Join Interactive Forms & Live Counter Stats (5-cols) */}
        <div className="md:col-span-5 flex flex-col gap-6">

          {referralCode && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs text-amber-200 leading-relaxed">
              🎁 You were referred by @{referralCode.replace(/^@/, '')} — joining will give them a bonus ticket!
            </div>
          )}
          
          {/* Realtime Stats Block */}
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-5 text-center flex flex-col gap-4">
            <span className="text-xs uppercase text-slate-400 tracking-wider">{t('giveaway.countdown')}</span>
            
            {/* Live Countdowns */}
            <div className="grid grid-cols-4 gap-2 font-mono" id="live_draw_countdown">
              <div className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl">
                <span className="text-2xl font-extrabold text-white block">{timeLeft.days}</span>
                <span className="text-[9px] text-slate-500 uppercase block">{t('giveaway.days')}</span>
              </div>
              <div className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl">
                <span className="text-2xl font-extrabold text-white block">{timeLeft.hours}</span>
                <span className="text-[9px] text-slate-500 uppercase block">{t('giveaway.hours')}</span>
              </div>
              <div className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl">
                <span className="text-2xl font-extrabold text-white block">{timeLeft.minutes}</span>
                <span className="text-[9px] text-slate-500 uppercase block">{t('giveaway.mins')}</span>
              </div>
              <div className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl">
                <span className="text-2xl font-extrabold text-white block">{timeLeft.seconds}</span>
                <span className="text-[9px] text-slate-500 uppercase block">{t('giveaway.secs')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-1.5 border-t border-slate-850 pt-3">
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60">
                <span className="text-[9px] text-slate-400 block uppercase tracking-wider">{t('giveaway.verifiedCount')}</span>
                <span className="text-lg font-bold text-white font-mono">{participants.filter(p => p.verifiedAt !== null).length}</span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60 flex items-center justify-center gap-1.5 text-center">
                <Users className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-xs text-slate-300 font-medium">
                  {t('giveaway.registeredCount')}: {verifiedParticipants.length} {t('giveaway.registeredLabel')}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Entry Steps card */}
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-5 flex flex-col gap-4">
            
            {/* Error diagnostics banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/20 border border-red-900/40 text-[#ff8080] text-xs font-mono rounded-xl leading-relaxed flex flex-col gap-2">
                <div>
                  <AlertTriangle className="h-4 w-4 inline mr-1.5 align-text-bottom shrink-0" />
                  {errorMessage}
                </div>
                {(errorMessage.toLowerCase().includes('expired') ||
                  errorMessage.toLowerCase().includes('attempt')) &&
                  participantId && (
                    <button
                      type="button"
                      onClick={refreshCode}
                      className="text-left text-amber-400 hover:text-amber-300 text-xs font-semibold cursor-pointer"
                    >
                      🔄 Get a new verification code
                    </button>
                  )}
              </div>
            )}

            {/* Stage 1: Success Confirmed entry */}
            {successJoin ? (
              <div className="text-center py-4 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-full text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-emerald-400">🎉 Entry Recorded!</h4>
                  <p className="text-xs text-slate-450 mt-1">You are fully validated. You can now safely remove the signature string code from your bio text details.</p>
                </div>

                <div className="bg-slate-950 border border-slate-900 w-full p-4 rounded-2xl flex flex-col gap-3">
                  <p className="text-xs text-slate-300 text-left">
                    You joined! Share your link to boost your chances:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-900 border border-slate-800 p-1.5 rounded text-xs font-mono text-slate-300 focus:outline"
                      value={referralShareUrl(
                        createdParticipant?.instagramUsername || username
                      )}
                      disabled
                    />
                    <button
                      onClick={handleCopyRef}
                      className="bg-amber-500 text-slate-950 hover:bg-amber-400 px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Clipboard className="h-3 w-3" /> {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <span className="text-[10px] text-amber-500 text-left font-mono">
                    You earn <span className="underline">+{giveaway.referralBonusTickets} bonus entries</span> for every validated participant who uses your share link to register!
                  </span>
                </div>
              </div>
            ) : verificationCode ? (
              /* Stage 2: Code generated. Tell them to paste it inside Bio and verify */
              <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-slate-950 border border-slate-900 w-full p-3 rounded-xl flex flex-col gap-2">
                  <p className="text-xs text-slate-300 text-left">
                    You joined! Share your link to boost your chances:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      className="flex-1 bg-slate-900 border border-slate-800 p-1.5 rounded text-xs font-mono text-slate-300 focus:outline"
                      value={referralShareUrl(username)}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyRef(referralShareUrl(username))}
                      className="bg-amber-500 text-slate-950 hover:bg-amber-400 px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Clipboard className="h-3 w-3" /> {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold font-mono text-xs">2</span>
                  <h4 className="text-sm font-semibold text-white">Paste Verification Signature Code</h4>
                </div>

                <p className="text-xs text-slate-450 leading-relaxed">
                  To prevent bot entries, insert this code directly into your public Instagram bio:
                </p>

                <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl flex items-center justify-between font-mono font-bold text-lg text-emerald-400">
                  <span>{verificationCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(verificationCode);
                      showToast(t('ui.copied'), 'success');
                    }}
                    className="p-1 text-slate-500 hover:text-white transition cursor-pointer"
                    title="Copy Code"
                  >
                    <Clipboard className="h-4 w-4" />
                  </button>
                </div>

                <ol className="text-[11px] text-slate-400 leading-relaxed flex flex-col gap-1.5 border-t border-dashed border-slate-800/80 pt-3">
                  <li className="flex gap-1">⏱ Code signature expires automatically in 30 minutes.</li>
                  <li className="flex gap-1">🔒 Instagram username is only locked after successful verification.</li>
                  <li className="flex gap-1">👀 Ensure public profile access is active (private account bio crawler blocks).</li>
                </ol>

                <div className="border-t border-slate-800/80 pt-3 mt-1 flex flex-col gap-2">
                  <button
                    onClick={startScrapeVerification}
                    className="w-full bg-emerald-500 text-slate-950 font-bold py-2 rounded-xl text-xs hover:bg-emerald-400 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
                    id="verify_me_btn"
                    disabled={isVerifying}
                  >
                    <span>{isVerifying ? 'Running Micro Scrape...' : 'Verify Me Now'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Simulated Scraper Console Screen (BullMQ live responses representation) */}
                {isVerifying && (
                  <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl text-left font-mono text-[10px] flex flex-col gap-2 animate-pulse">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-amber-500 uppercase tracking-widest font-bold">BullMQ Job Queue Monitor</span>
                      <span className="text-slate-500">Job: #scrp_{participantId.slice(-4)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      <span className="text-slate-200">
                        {verifyStep}/5: {verifyMessage}
                        {isVerifying ? (
                          <span className="inline-block w-4 animate-pulse">...</span>
                        ) : (
                          ''
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${verifyStep * 20}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            ) : isOwner ? (
              /* Host owner — cannot participate in own giveaway */
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="p-4 bg-slate-900/60 border border-slate-700/60 rounded-2xl">
                  <span className="text-4xl block mb-3">🔒</span>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">You are the host of this giveaway</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Creators cannot participate in their own giveaway. This ensures fairness for all participants.
                  </p>
                </div>
              </div>
            ) : (
              /* Stage 3: Normal Entry form input */
              <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold font-mono text-xs">1</span>
                  <h4 className="text-sm font-semibold text-white">Enter Instagram Handle</h4>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Your Instagram Handle username</label>
                  <input
                    type="text"
                    placeholder="e.g. mkbhd"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>

                {giveaway.mode === 'verified' && (
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Email subscription (Optional - receive alerts)</label>
                    <input
                      type="email"
                      placeholder="alerts@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                )}

                {referrer && (
                  <div className="p-3 bg-indigo-950/10 border border-indigo-900/30 rounded-xl">
                    <span className="text-[10px] uppercase font-mono text-indigo-400 block tracking-wider">Referrer Friend Identified: </span>
                    <span className="text-xs font-mono font-bold text-slate-300">@{referrer}</span>
                    <span className="text-[10px] text-slate-500 block">They will receive bonus weight tickets on successful validation!</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-amber-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs hover:bg-amber-400 transition cursor-pointer flex items-center justify-center gap-1 shadow-lg shadow-amber-500/10"
                  id="submit_handle_btn"
                  disabled={isJoining}
                >
                  {isJoining ? 'Creating unique bio code...' : 'Proceed to Validation'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>

          {/* Participants pool */}
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-5 flex flex-col gap-3">
            {giveaway.referralBonusTickets > 0 && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-slate-300 leading-relaxed">
                🎟️ Ticket weight system: Each verified participant gets 1 ticket. Share your referral
                link and earn +{giveaway.referralBonusTickets} bonus ticket(s) for every person who joins
                through your link — boosting your chances proportionally.
              </div>
            )}

            <h4 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-400">
              {t('giveaway.registeredCount')}
            </h4>

            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
              {verifiedParticipants.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">No participants yet.</p>
              ) : (
                verifiedParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-900 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono gap-2"
                  >
                    <span
                      className={
                        p.verifiedAt !== null ? 'text-emerald-400 font-bold' : 'text-slate-400'
                      }
                    >
                      @{p.instagramUsername}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.ticketCount > 1 && (
                        <span className="text-amber-400 font-bold whitespace-nowrap">
                          🎟️ {p.ticketCount}x
                        </span>
                      )}
                      {p.verifiedAt !== null ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-slate-600" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SVG Synthesised QR Code Block */}
          <div className="bg-[#090f1d] border border-slate-800 rounded-3xl p-5 flex flex-col items-center justify-center gap-3">
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <QrCode className="h-4 w-4 text-amber-500" /> Shareable Scan Code
            </span>
            
            {/* Simple neat representative SVG QR code block */}
            <div className="p-2 border border-slate-850/60 rounded-2xl bg-white max-w-[130px]">
              <svg viewBox="0 0 100 100" className="w-[100px] h-[100px]">
                {/* Simulated QR block layout */}
                <rect x="0" y="0" width="22" height="22" fill="#000" />
                <rect x="3" y="3" width="16" height="16" fill="#fff" />
                <rect x="6" y="6" width="10" height="10" fill="#000" />
                
                <rect x="78" y="0" width="22" height="22" fill="#000" />
                <rect x="81" y="3" width="16" height="16" fill="#fff" />
                <rect x="84" y="6" width="10" height="10" fill="#000" />

                <rect x="0" y="78" width="22" height="22" fill="#000" />
                <rect x="3" y="81" width="16" height="16" fill="#fff" />
                <rect x="6" y="84" width="10" height="10" fill="#000" />

                {/* Scattered dots */}
                <rect x="30" y="5" width="8" height="8" fill="#000" />
                <rect x="42" y="12" width="12" height="6" fill="#000" />
                <rect x="60" y="4" width="6" height="10" fill="#000" />

                <rect x="5" y="35" width="15" height="4" fill="#000" />
                <rect x="42" y="33" width="6" height="14" fill="#000" />
                <rect x="72" y="35" width="18" height="8" fill="#000" />

                <rect x="30" y="60" width="14" height="6" fill="#000" />
                <rect x="55" y="55" width="20" height="20" fill="#000" />
                <rect x="42" y="80" width="10" height="12" fill="#000" />
                <rect x="80" y="80" width="12" height="12" fill="#000" />
              </svg>
            </div>
            <span className="text-[10px] text-slate-500 font-mono text-center">Auto-generated QR linking directly to lootly.gg/g/{giveaway.slug}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
