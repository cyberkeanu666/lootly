import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  ShieldCheck, 
  Gauge, 
  ChevronRight, 
  Share2, 
  ArrowLeft, 
  User, 
  RefreshCw, 
  Lock, 
  HelpCircle,
  Eye,
  Settings,
  Sparkles,
  LogOut,
  AlertTriangle,
  BookOpen,
  Globe
} from 'lucide-react';

// Import Types
import { Giveaway, Participant, VerificationLog, HostUser } from './data';
import { useI18n } from './i18n/LanguageContext';
import type { Locale } from './i18n/types';

// Import Modular Page Widgets
import LandingPage from './components/LandingPage';
import HostDashboard from './components/HostDashboard';
import GiveawayPage from './components/GiveawayPage';
import DrawPage from './pages/DrawPage';
import ArchivePage from './pages/ArchivePage';
import VerifyPage from './pages/VerifyPage';
import EmbedWidget from './components/EmbedWidget';
import DocumentationPage from './components/DocumentationPage';
import HowItWorksPage from './components/HowItWorksPage';
import LiveDrawSelectPage from './components/LiveDrawSelectPage';
import AuthModal from './components/AuthModal';
import HostNotifications from './components/HostNotifications';
import LiveChatFab from './components/LiveChatFab';
import { useLootlyUI } from './components/LootlyUI';
import {
  authFetch,
  clearAuthSession,
  loadStoredHost,
  parseAuthResponse,
  storeAuthSession,
} from './utils/authHeaders';

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const { showToast, confirm } = useLootlyUI();

  // Host Session State (requires JWT + host profile in localStorage)
  const [host, setHost] = useState<HostUser | null>(() => loadStoredHost());

  // Navigation Route state
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || '/';
  });

  // Global Sync Database Arrays
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [globalLogs, setGlobalLogs] = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverOffline, setServerOffline] = useState(false);
  const [referralsQueryCode, setReferralsQueryCode] = useState('');
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'register' }>({
    open: false,
    mode: 'login',
  });

  // Synchronise navigation hashes
  useEffect(() => {
    window.location.hash = currentRoute;
  }, [currentRoute]);

  // Parse referrals query from standard url params if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralsQueryCode(ref);
    }
  }, []);

  // Fetch all state from full-stack Express server endpoints
  const fetchGlobalState = async () => {
    try {
      setLoading(true);
      const gwRes = await fetch('/api/giveaways');
      const gwData = await gwRes.json();
      setGiveaways(Array.isArray(gwData) ? gwData : []);
      setServerOffline(false);

      const routeParts = currentRoute.split('/').filter((p) => p.length > 0);
      const slugName = routeParts[0] === 'giveaway' ? routeParts[1] : null;
      const giveawayMatch = slugName
        ? (gwData || []).find((g: Giveaway) => g.slug === slugName)
        : null;

      if (host?.id) {
        const partRes = await fetch(`/api/participants/for-host/${host.id}`);
        const partData = await partRes.json();
        const allForHost = Array.isArray(partData) ? partData : [];
        if (giveawayMatch) {
          setParticipants(allForHost.filter((p: Participant) => p.giveawayId === giveawayMatch.id));
          const logRes = await fetch(`/api/verification/logs?giveawayId=${giveawayMatch.id}`);
          const logData = await logRes.json();
          setGlobalLogs(Array.isArray(logData) ? logData : []);
        } else {
          setParticipants(allForHost);
          setGlobalLogs([]);
        }
      } else if (giveawayMatch) {
        const partRes = await fetch(`/api/participants/by-giveaway/${giveawayMatch.id}`);
        const partData = await partRes.json();
        setParticipants(Array.isArray(partData) ? partData : []);
        const logRes = await fetch(`/api/verification/logs?giveawayId=${giveawayMatch.id}`);
        const logData = await logRes.json();
        setGlobalLogs(Array.isArray(logData) ? logData : []);
      } else {
        setParticipants([]);
        setGlobalLogs([]);
      }
    } catch (err) {
      console.error('[Lootly State Engine] Failed to sync data with server:', err);
      setServerOffline(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalState();
    // Use faster polling on draw routes, slower elsewhere
    const isDrawRoute = currentRoute.includes('/draw') || currentRoute === '/live-draw';
    const pollInterval = isDrawRoute ? 5000 : 20000;
    const activePoll = setInterval(fetchGlobalState, pollInterval);
    return () => clearInterval(activePoll);
  }, [currentRoute, host?.id]);

  const handleSessionExpired = () => {
    setHost(null);
    clearAuthSession();
    showToast(t('auth.loginPrompt'), 'warning');
    setCurrentRoute('/');
  };

  const completeAuth = (session: { host: HostUser; token: string }) => {
    setHost(session.host);
    storeAuthSession(session.host, session.token);
    setAuthModal({ open: false, mode: 'login' });
    setCurrentRoute('/dashboard');
  };

  const handleHostRegister = async (
    email: string,
    username: string,
    password: string
  ) => {
    try {
      const res = await fetch('/api/hosts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || t('authForm.registerFailed') };
      const parsed = parseAuthResponse(data);
      if (!parsed) return { error: t('authForm.registerFailed') };
      if ('error' in parsed) return { error: parsed.error };
      completeAuth(parsed);
      return { success: true };
    } catch {
      return { error: t('authForm.registerFailed') };
    }
  };

  const handleHostLogin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/hosts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || t('authForm.loginFailed') };
      const parsed = parseAuthResponse(data);
      if (!parsed) return { error: t('authForm.loginFailed') };
      if ('error' in parsed) return { error: parsed.error };
      completeAuth(parsed);
      return { success: true };
    } catch {
      return { error: t('authForm.loginFailed') };
    }
  };

  const handleUpgradeHost = () => {
    showToast(t('ui.comingSoon'), 'info');
  };

  const handleLogOutHost = () => {
    setHost(null);
    clearAuthSession();
    setCurrentRoute('/');
  };

  // Create Campaign API
  const handleCreateGiveaway = async (payload: Partial<Giveaway>) => {
    if (!host) return { error: 'No authenticated creator session detected.' };
    try {
      const res = await authFetch('/api/giveaway/create', {
        method: 'POST',
        body: JSON.stringify({
          hostId: host.id,
          ...payload
        })
      });
      if (res.status === 401) {
        handleSessionExpired();
        return { error: t('auth.loginPrompt') };
      }
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Server rejected publication.' };
      }
      fetchGlobalState();
      return data;
    } catch (err) {
      return { error: 'Connection failed.' };
    }
  };

  // Delete Campaign Request
  const handleDeleteGiveaway = async (id: string) => {
    const ok = await confirm(t('ui.deleteCampaignConfirm'));
    if (!ok) return;
    try {
      const res = await authFetch(`/api/giveaway/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      fetchGlobalState();
    } catch (err) {
      console.error(err);
    }
  };

  // Submit join requests to enrole username
  const handleJoinRegistration = async (username: string, referredBy?: string, email?: string) => {
    const routeParts = currentRoute.split('/').filter(p => p.length > 0);
    const slugName = routeParts[1];
    const giveawayMatch = giveaways.find(g => g.slug === slugName);
    
    if (!giveawayMatch) return { error: 'Campaign details failed to parse.' };

    try {
      const res = await fetch('/api/participants/join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagramUsername: username,
          giveawayId: giveawayMatch.id,
          referredBy,
          email
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Join request rejected.' };
      }
      fetchGlobalState();
      return data;
    } catch (err) {
      return { error: 'Connection limits exceeded.' };
    }
  };

  // BullMQ bio scrape — enqueue job and poll until complete
  const handleScrapeVerification = async (participantId: string) => {
    try {
      const res = await fetch('/api/participants/verify-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      const enqueue = await res.json();
      if (!res.ok) {
        return { success: false, message: enqueue.error || 'Verify request rejected.' };
      }

      const jobId = enqueue.jobId as string;
      const maxPolls = 60;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const statusRes = await fetch(`/api/participants/verify-status/${jobId}`);
        const status = await statusRes.json();

        if (status.status === 'completed') {
          fetchGlobalState();
          return {
            success: !!status.success,
            message: status.message,
            participant: status.participant,
            source: status.source,
            attempts: status.attempts,
            stage: status.stage,
          };
        }
        if (status.status === 'failed') {
          fetchGlobalState();
          return { success: false, message: status.message || 'Scrape job failed.' };
        }
      }
      return { success: false, message: 'Verification timed out. Try again.' };
    } catch (err) {
      console.error(err);
      return { success: false, message: 'Verify action failed.' };
    }
  };

  // Start crypto draw
  const handleTriggerSweepstakeDraw = async () => {
    const routeParts = currentRoute.split('/').filter(p => p.length > 0);
    const slugName = routeParts[1];
    const giveawayMatch = giveaways.find(g => g.slug === slugName);

    if (!giveawayMatch) return { error: 'Campaign slug resolution failed.' };

    try {
      const res = await authFetch(`/api/giveaway/draw-start/${giveawayMatch.id}`, {
        method: 'POST',
      });
      if (res.status === 401) {
        handleSessionExpired();
        return { error: t('auth.loginPrompt') };
      }
      const data = await res.json();
      fetchGlobalState();
      return data;
    } catch (err) {
      return { error: 'Sweeping process failed.' };
    }
  };

  const hostGiveaways = host ? giveaways.filter((g) => g.hostId === host.id) : [];
  const drawableGiveaways = hostGiveaways.filter((g) => g.status !== 'completed');
  const liveDrawRoute =
    drawableGiveaways.length === 0
      ? null
      : drawableGiveaways.length === 1
        ? `/giveaway/${drawableGiveaways[0].slug}/draw`
        : '/live-draw';

  const completedHostGiveaway = hostGiveaways
    .filter((g) => g.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const proofArchiveRoute = completedHostGiveaway
    ? `/giveaway/${completedHostGiveaway.slug}/archive`
    : null;

  const navBtnBase =
    'px-3 py-2 rounded-xl text-xs font-semibold font-display transition duration-200 flex items-center gap-2';
  const navBtnActive =
    'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/15 cursor-pointer';
  const navBtnIdle =
    'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 cursor-pointer';
  const navBtnDisabled =
    'text-slate-600 opacity-50 cursor-not-allowed pointer-events-none';

  // --- COMPONENT ROUTING MAPS ---
  const renderPlatformPage = () => {
    const parts = currentRoute.split('/').filter(p => p.length > 0);
    
    // Documentation Blueprint route
    if (currentRoute === '/docs' || currentRoute === '/documentation') {
      return <DocumentationPage />;
    }

    if (currentRoute === '/guide' || currentRoute === '/how-it-works') {
      return <HowItWorksPage onSelectRoute={setCurrentRoute} />;
    }

    if (currentRoute === '/verify') {
      return <VerifyPage />;
    }

    if (currentRoute === '/live-draw') {
      if (!host) {
        return (
          <div className="max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center gap-4">
            <Lock className="h-10 w-10 text-amber-500 animate-bounce" />
            <h3 className="text-lg font-bold font-display">{t('auth.unauthenticated')}</h3>
            <p className="text-xs text-slate-400">{t('auth.loginPrompt')}</p>
            <button
              onClick={() => setAuthModal({ open: true, mode: 'login' })}
              className="mt-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              {t('nav.creatorLogin')}
            </button>
          </div>
        );
      }
      return (
        <LiveDrawSelectPage campaigns={drawableGiveaways} onSelectRoute={setCurrentRoute} />
      );
    }
    
    // 1. Landing / Entry Home page
    if (currentRoute === '/' || parts.length === 0) {
      return (
        <LandingPage
          host={host}
          onRegisterHost={handleHostRegister}
          onLoginHost={handleHostLogin}
          onGoDashboard={() => setCurrentRoute('/dashboard')}
          onRequestUpgrade={handleUpgradeHost}
          onOpenAuth={(mode) => setAuthModal({ open: true, mode })}
        />
      );
    }

    // 2. Creator Management Space
    if (currentRoute === '/dashboard') {
      if (!host) {
        // Redirect back home if they try to look at dashboard without a validated host session
        return (
          <div className="max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center gap-4">
            <Lock className="h-10 w-10 text-amber-500 animate-bounce" />
            <h3 className="text-lg font-bold font-display">{t('auth.unauthenticated')}</h3>
            <p className="text-xs text-slate-400">{t('auth.loginPrompt')}</p>
            <button
              onClick={() => setCurrentRoute('/')}
              className="mt-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              {t('auth.goHome')}
            </button>
          </div>
        );
      }
      return (
        <HostDashboard
          host={host}
          giveaways={giveaways}
          participants={participants}
          onCreateGiveaway={handleCreateGiveaway}
          onDeleteGiveaway={handleDeleteGiveaway}
          onSelectRoute={setCurrentRoute}
          onUpgradeHost={handleUpgradeHost}
        />
      );
    }

    // Specifc Sweepstakes Path parses
    if (parts[0] === 'giveaway' && parts[1]) {
      const slugName = parts[1];

      if (parts[2] === 'archive') {
        return <ArchivePage slug={slugName} />;
      }

      const giveawayMatch = giveaways.find(g => g.slug === slugName);

      if (!giveawayMatch) {
        return (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <h3 className="text-lg font-bold">{t('errors.notFound')}</h3>
            <p className="text-xs text-slate-450">The private slug "{slugName}" was either deleted or never registered.</p>
            <button
              onClick={() => setCurrentRoute('/')}
              className="mt-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {t('errors.goHome')}
            </button>
          </div>
        );
      }

      // Live Drum roll panels — creator only, own campaigns only
      if (parts[2] === 'draw') {
        if (!host) {
          return (
            <div className="max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center gap-4">
              <Lock className="h-10 w-10 text-amber-500 animate-bounce" />
              <h3 className="text-lg font-bold font-display">{t('auth.unauthenticated')}</h3>
              <p className="text-xs text-slate-400">{t('auth.loginPrompt')}</p>
              <button
                onClick={() => setCurrentRoute('/')}
                className="mt-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('auth.goHome')}
              </button>
            </div>
          );
        }
        if (giveawayMatch.hostId !== host.id) {
          return (
            <div className="max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center gap-4">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <h3 className="text-lg font-bold font-display">{t('errors.notFound')}</h3>
              <p className="text-xs text-slate-400">{t('nav.noCampaignForDraw')}</p>
              <button
                onClick={() => setCurrentRoute('/dashboard')}
                className="mt-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('nav.dashboard')}
              </button>
            </div>
          );
        }
        return (
          <DrawPage slug={slugName} onSelectRoute={setCurrentRoute} />
        );
      }

      // Normal joining page
      return (
        <GiveawayPage
          giveaway={giveawayMatch}
          participants={participants}
          onJoinRequest={handleJoinRegistration}
          onVerifyRequest={handleScrapeVerification}
          onSelectRoute={setCurrentRoute}
          referralCode={referralsQueryCode}
        />
      );
    }

    // OBS Stream Widget Embed simulator
    if (parts[0] === 'embed' && parts[1]) {
      const slugName = parts[1];
      const giveawayMatch = giveaways.find(g => g.slug === slugName);
      if (giveawayMatch) {
        return (
          <div className="flex items-center justify-center min-h-[50vh] transition-colors">
            <EmbedWidget
              giveaway={giveawayMatch}
              participants={participants}
              onSelectRoute={setCurrentRoute}
            />
          </div>
        );
      }
    }

    // Default 404 block fallback
    return (
      <div className="py-20 text-center">
        <h3 className="text-lg font-bold text-white">{t('errors.pathFailed')}</h3>
        <button onClick={() => setCurrentRoute('/')} className="mt-4 bg-amber-500 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold cursor-pointer">
          {t('errors.goHome')}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#040813] text-[#f1f5f9] flex flex-col font-sans transition-all selection:bg-amber-500/20 selection:text-amber-300">

      {serverOffline && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2.5 text-center text-sm text-red-200">
          <span className="mr-2" aria-hidden>
            ⚠
          </span>
          Backend server is offline — run npm run dev in your terminal
        </div>
      )}

      {/* Ultra-Modern Premium Unified Header with Active Navigation Menus */}
      <header className="border-b border-slate-800/60 bg-[#060a15]/90 sticky top-0 z-45 backdrop-blur-xl px-4 sm:px-8 py-4.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 transition-all duration-300">
        <div className="flex items-center justify-between w-full xl:w-auto">
          {/* Logo Brand Brandings */}
          <div className="flex items-center gap-3 cursor-pointer group select-none" onClick={() => setCurrentRoute('/')}>
            <div className="relative">
              <Trophy className="h-7 w-7 text-amber-500 relative z-10 transition-transform group-hover:rotate-12 duration-300" />
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-md group-hover:scale-125 transition-transform duration-300"></div>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white font-display flex items-center gap-1.5">
                Lootly<span className="text-amber-500 font-mono text-xs tracking-widest uppercase bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">.gg</span>
              </h1>
              <p className="text-[9px] text-slate-400 tracking-wider uppercase">Provably Fair Sweepstakes Engagements</p>
            </div>
          </div>
          
          {/* Mobile indicator or simple action */}
          <div className="xl:hidden flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">{t('nav.liveSync')}</span>
          </div>
        </div>

        {/* Dynamic Navigation Menu Buttons with exquisite styling and active state indicators */}
        <nav className="flex flex-wrap items-center gap-1.5 bg-[#0a0f1d]/75 p-1 rounded-2xl border border-slate-800/80 max-w-full">
          <button
            onClick={() => setCurrentRoute('/')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold font-display transition duration-200 flex items-center gap-2 cursor-pointer ${
              currentRoute === '/' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/15' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            {t('nav.home')}
          </button>
          
          <button
            type="button"
            disabled={!host}
            title={!host ? t('nav.navDisabledLogin') : undefined}
            onClick={() => host && setCurrentRoute('/dashboard')}
            className={`${navBtnBase} ${
              !host
                ? navBtnDisabled
                : currentRoute === '/dashboard'
                  ? navBtnActive
                  : navBtnIdle
            }`}
          >
            {t('nav.dashboard')}
          </button>

          <button
            type="button"
            disabled={!host || !liveDrawRoute}
            title={
              !host
                ? t('nav.navDisabledLogin')
                : !liveDrawRoute
                  ? t('nav.noCampaignForDraw')
                  : undefined
            }
            onClick={() => liveDrawRoute && setCurrentRoute(liveDrawRoute)}
            className={`${navBtnBase} ${
              !host || !liveDrawRoute
                ? navBtnDisabled
                : currentRoute.endsWith('/draw') || currentRoute === '/live-draw'
                  ? navBtnActive
                  : navBtnIdle
            }`}
          >
            {t('nav.liveDraw')}
          </button>

          <button
            type="button"
            disabled={!host || !proofArchiveRoute}
            title={
              !host
                ? t('nav.navDisabledLogin')
                : !proofArchiveRoute
                  ? t('nav.noCampaignForArchive')
                  : undefined
            }
            onClick={() => proofArchiveRoute && setCurrentRoute(proofArchiveRoute)}
            className={`${navBtnBase} ${
              !host || !proofArchiveRoute
                ? navBtnDisabled
                : currentRoute.endsWith('/archive')
                  ? navBtnActive
                  : navBtnIdle
            }`}
          >
            {t('nav.proofArchive')}
          </button>

          <button
            onClick={() => setCurrentRoute('/guide')}
            className={`${navBtnBase} ${
              currentRoute === '/guide' || currentRoute === '/how-it-works'
                ? navBtnActive
                : navBtnIdle
            }`}
          >
            {t('nav.guide')}
          </button>

          <button
            onClick={() => setCurrentRoute('/docs')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold font-display transition duration-200 flex items-center gap-3 cursor-pointer ${
              currentRoute === '/docs' || currentRoute === '/documentation'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/15' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" /> {t('nav.docs')}
          </button>
        </nav>

        {/* Language + notifications + host profile */}
        <div className="flex items-center gap-3">
          {host && (
            <HostNotifications
              hostId={host.id}
              giveaways={giveaways}
              onNavigate={setCurrentRoute}
            />
          )}
          <div className="flex items-center gap-1 bg-[#0a0f1d]/75 border border-slate-800/80 rounded-xl p-1">
            <Globe className="h-3.5 w-3.5 text-slate-500 ml-1.5" aria-hidden />
            {(['en', 'sr'] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  locale === code
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t(`lang.${code}`)}
              >
                {code}
              </button>
            ))}
          </div>
          {host ? (
            <div className="bg-[#0b1224] border border-slate-800/90 rounded-2xl px-3.5 py-1.5 flex items-center gap-3 text-xs shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col text-left">
                <span className="text-slate-200 font-semibold font-sans">{host.username}</span>
                <span className="text-[9px] text-amber-400 tracking-wider font-semibold uppercase">{host.plan} {t('auth.proTier')}</span>
              </div>
              <button
                onClick={handleLogOutHost}
                className="text-slate-500 hover:text-red-400 p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer ml-1"
                title="Log Out Session"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModal({ open: true, mode: 'login' })}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold rounded-xl transition duration-200 cursor-pointer shadow-md shadow-amber-500/10 font-display uppercase tracking-widest"
              title={t('nav.creatorLogin')}
            >
              {t('nav.creatorLogin')}
            </button>
          )}
        </div>
      </header>
      
      {/* Route Render Core View */}
      <main className={`flex-1 ${serverOffline ? 'mt-8' : ''}`}>
        {renderPlatformPage()}
      </main>

      <LiveChatFab />

      <footer className="border-t border-slate-850 bg-[#040810]/60 py-6 text-center text-[10px] text-slate-500">
        <p>{t('footer.copy')}</p>
      </footer>

      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        onClose={() => setAuthModal((s) => ({ ...s, open: false }))}
        onRegisterHost={handleHostRegister}
        onLoginHost={handleHostLogin}
      />

    </div>
  );
}
