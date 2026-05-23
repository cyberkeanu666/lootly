import React, { useState, useMemo } from 'react';
import { Giveaway, HostUser, Participant } from '../data';
import { Trophy, Plus, Crown, Trash2, BarChart, Calendar, Upload, Users, Copy } from 'lucide-react';
import { useI18n, slugifyTitle } from '../i18n/LanguageContext';
import { parseBulkProfiles } from '../utils/parseProfiles';
import { useLootlyUI } from './LootlyUI';

interface HostDashboardProps {
  host: HostUser;
  giveaways: Giveaway[];
  participants: Participant[];
  onCreateGiveaway: (data: Partial<Giveaway>) => Promise<any>;
  onDeleteGiveaway: (id: string) => void;
  onSelectRoute: (route: string) => void;
  onUpgradeHost: () => void;
}

export default function HostDashboard({
  host,
  giveaways = [],
  participants = [],
  onCreateGiveaway,
  onDeleteGiveaway,
  onSelectRoute,
  onUpgradeHost
}: HostDashboardProps) {
  const { t } = useI18n();
  const { showToast } = useLootlyUI();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [prizeName, setPrizeName] = useState('');
  const [description, setDescription] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [bulkProfilesText, setBulkProfilesText] = useState('');
  const [drawHours, setDrawHours] = useState('72');
  const [customDrawHours, setCustomDrawHours] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [maxPart, setMaxPart] = useState('');
  const [mode, setMode] = useState<'verified' | 'simple'>('verified');
  const [winners, setWinners] = useState('1');
  const [refBonus, setRefBonus] = useState('1');
  const [errorMessage, setErrorMessage] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleCopyLink = async (slug: string) => {
    const url = `${window.location.origin}/#/giveaway/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const openCreateModal = () => {
    setErrorMessage('');
    setShowUpgradePrompt(false);
    setShowCreateModal(true);
  };

  const parsedProfiles = useMemo(() => parseBulkProfiles(bulkProfilesText), [bulkProfilesText]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugifyTitle(value));
  };

  const handlePrizeImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.prizeImageUploadFail'), 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast(t('dashboard.prizeImageUploadFail'), 'error');
      return;
    }
    setUploadingImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1];
      const res = await fetch('/api/upload/prize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || t('dashboard.prizeImageUploadFail'), 'error');
        return;
      }
      setImageURL(data.url);
      showToast(t('dashboard.prizeImageUpload'), 'success');
    } catch {
      showToast(t('dashboard.prizeImageUploadFail'), 'error');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setShowUpgradePrompt(false);

    const finalSlug = slug.trim() || slugifyTitle(title);
    if (!title.trim() || !prizeName.trim() || !finalSlug) {
      setErrorMessage(t('dashboard.missingFields'));
      return;
    }

    const requiredProfiles = parsedProfiles;
    if (requiredProfiles.length === 0) {
      setErrorMessage(t('dashboard.bulkProfilesEmpty'));
      return;
    }

    const hours =
      drawHours === 'custom' ? Number(customDrawHours) : Number(drawHours);
    if (!hours || hours < 1 || hours > 8760) {
      setErrorMessage(t('dashboard.drawCustomInvalid'));
      return;
    }

    const drawDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const result = await onCreateGiveaway({
      title: title.trim(),
      slug: finalSlug,
      prize: prizeName.trim(),
      prizeDescription: description,
      prizeImageURL: imageURL,
      requiredProfiles,
      drawDate,
      maxParticipants: maxPart ? Number(maxPart) : null,
      mode,
      numWinners: Number(winners),
      referralBonusTickets: Number(refBonus)
    });

    if (result && result.error) {
      const isLimitError = /limit|plan|upgrade|maximum/i.test(result.error);
      if (isLimitError) {
        setShowUpgradePrompt(true);
      } else {
        setErrorMessage(result.error);
      }
    } else {
      setShowCreateModal(false);
      // Reset form
      setTitle('');
      setSlug('');
      setSlugTouched(false);
      setPrizeName('');
      setDescription('');
      setImageURL('');
      setBulkProfilesText('');
      setDrawHours('72');
      setCustomDrawHours('');
      setMaxPart('');
      setMode('verified');
      setWinners('1');
    }
  };

  // Pre-calculate cumulative analytics for the current active host
  const myGiveaways = giveaways.filter(g => g.hostId === host.id);

  const entryStats = useMemo(() => {
    const map = new Map<string, { registered: number; verified: number }>();
    for (const g of myGiveaways) {
      map.set(g.id, { registered: 0, verified: 0 });
    }
    for (const p of participants) {
      const stat = map.get(p.giveawayId);
      if (!stat) continue;
      stat.registered += 1;
      if (p.verifiedAt !== null) stat.verified += 1;
    }
    return map;
  }, [myGiveaways, participants]);
  const activeCount = myGiveaways.filter(g => g.status !== 'completed').length;
  const completedCount = myGiveaways.filter(g => g.status === 'completed').length;

  // Aggregate stats across all campaigns
  const totalDirect = myGiveaways.reduce((acc, g) => acc + (g.trafficSources?.direct || 0), 0);
  const totalReferral = myGiveaways.reduce((acc, g) => acc + (g.trafficSources?.referral || 0), 0);
  const totalSocial = myGiveaways.reduce((acc, g) => acc + (g.trafficSources?.social || 0), 0);
  const totalSearch = myGiveaways.reduce((acc, g) => acc + (g.trafficSources?.search || 0), 0);
  const totalHits = totalDirect + totalReferral + totalSocial + totalSearch || 1;

  // Render donut ratios
  const percentDirect = Math.round((totalDirect / totalHits) * 100);
  const percentReferral = Math.round((totalReferral / totalHits) * 100);
  const percentSocial = Math.round((totalSocial / totalHits) * 100);
  const percentSearch = Math.round((totalSearch / totalHits) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" id="host_dashboard_view">
    <div className="flex flex-col gap-8 text-gray-200">
      
      {/* Host Banner & Freemium upgrade options */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#090f1d] border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 text-amber-400 rounded-2xl relative">
            <Trophy className="h-7 w-7" />
            <div className="absolute inset-0 bg-amber-500/10 rounded-2xl blur-sm scale-110"></div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-white font-display">{host.username}</h2>
              <span className={`text-[10px] font-sans tracking-widest px-2.5 py-0.5 rounded-full font-bold uppercase ${
                host.plan === 'pro' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                Lootly {host.plan.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{host.email} — Creator Space ID: {host.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {host.plan === 'free' && (
            <button
              onClick={onUpgradeHost}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-xl text-xs transition duration-200 cursor-pointer shadow-lg shadow-amber-500/10 flex items-center gap-1.5 uppercase tracking-wider"
              id="upgrade_pro_btn"
            >
              <Crown className="h-4 w-4" /> {t('dashboard.goPro')}
            </button>
          )}

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            id="create_new_campaign_btn"
          >
            <Plus className="h-4 w-4 text-emerald-400 font-bold" /> {t('dashboard.newSweepstakes')}
          </button>
        </div>
      </div>

      {host.plan === 'free' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Free Plan Usage</span>
            <button
              type="button"
              onClick={onUpgradeHost}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
            >
              Upgrade to Pro →
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (myGiveaways.length / 3) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {myGiveaways.length} / 3 campaigns
            </span>
          </div>
          {myGiveaways.length >= 3 && (
            <p className="text-xs text-amber-400/90">
              Campaign limit reached. Upgrade to Pro for unlimited campaigns.
            </p>
          )}
        </div>
      )}

      {/* Analytics Insight Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="dashboard_analytics">
        
        {/* KPI Summaries (7-colspan) */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-sans block uppercase">Active Giveaway Campaigns</span>
            <div>
              <span className="text-4xl font-extrabold text-white font-sans">{activeCount}</span>
              <span className="text-xs text-slate-500 ml-2">running campaigns</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-3 border-t border-slate-800/40 pt-2 block font-sans">
              {host.plan === 'free' ? 'Cap remaining: 3 active' : 'Unlimited capabilities unlocked'}
            </span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-sans block uppercase">Total Recorded Page Visits</span>
            <div>
              <span className="text-4xl font-extrabold text-white font-sans">{totalHits - 1 || 0}</span>
              <span className="text-xs text-slate-500 ml-2">views today</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-3 border-t border-slate-800/40 pt-2 block font-sans">
              Average engagement conversion: 35%
            </span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-sans block uppercase">Completed Drawings</span>
            <div>
              <span className="text-4xl font-extrabold text-slate-400 font-sans">{completedCount}</span>
              <span className="text-xs text-slate-500 ml-2">proven outputs</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-3 border-t border-slate-800/40 pt-2 block font-sans">
              Evidence logs permanently archived the same
            </span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-sans block uppercase">Weighted Tickets Odds Bonus</span>
            <div>
              <span className="text-4xl font-extrabold text-amber-500 font-sans">+{percentReferral}%</span>
              <span className="text-xs text-slate-500 ml-2">via referrals</span>
            </div>
            <span className="text-[10px] text-amber-500/70 mt-3 border-t border-slate-800/40 pt-2 block font-sans">
              Viral expansion system working
            </span>
          </div>
        </div>

        {/* Traffic Channels SVG Graph (5-colspan) */}
        <div className="md:col-span-5 bg-[#090f1d] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <BarChart className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold font-sans text-white uppercase tracking-wider">Campaign Traffic Demographics</h3>
          </div>

          <div className="flex flex-col gap-3">
            {/* Direct */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300">Social (Instagram, YouTube)</span>
                <span className="font-sans text-slate-400">{percentSocial || 0}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full" style={{ width: `${percentSocial || 0}%` }}></div>
              </div>
            </div>

            {/* Referrals */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300">Viral Referrals (Lootly links)</span>
                <span className="font-sans text-slate-400">{percentReferral || 0}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full" style={{ width: `${percentReferral || 0}%` }}></div>
              </div>
            </div>

            {/* Direct */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300">Direct / Bookmark URLs</span>
                <span className="font-sans text-slate-400">{percentDirect || 0}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: `${percentDirect || 0}%` }}></div>
              </div>
            </div>

            {/* Search */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300">Google Search / Discover</span>
                <span className="font-sans text-slate-400">{percentSearch || 0}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full" style={{ width: `${percentSearch || 0}%` }}></div>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-sans mt-4 text-center block">Demographic coordinates parsed live from route queries</span>
        </div>
      </div>

      {/* Campaign List Display Grid */}
      <div className="flex flex-col gap-4" id="campaign_list_widget">
        <h3 className="text-lg font-bold text-white font-sans flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-500" />
          {t('dashboard.yourCampaigns')} ({myGiveaways.length})
        </h3>

        {myGiveaways.length === 0 ? (
          <div className="py-12 border border-dashed border-slate-800 rounded-3xl text-center text-slate-500 flex flex-col items-center gap-2 bg-[#090f1d]/20">
            <Trophy className="h-10 w-10 text-slate-700 stroke-1" />
            <p className="font-sans text-sm">{t('dashboard.noCampaigns')}</p>
            <button
              onClick={openCreateModal}
              className="mt-2 bg-amber-500 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-400 transition cursor-pointer"
            >
              {t('dashboard.addFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myGiveaways.map(g => {
              const stats = entryStats.get(g.id) ?? { registered: 0, verified: 0 };
              return (
              <div
                key={g.id}
                className="bg-[#090f1d] border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-700 transition relative overflow-hidden group shadow-md"
              >
                {/* Background prize image blur */}
                <div className="absolute top-0 right-0 w-28 h-28 opacity-10 pointer-events-none group-hover:scale-110 transition duration-300">
                  <img src={g.prizeImageURL} alt="" className="w-full h-full object-cover rounded-bl-3xl" referrerPolicy="no-referrer" />
                </div>

                <div className="flex flex-col gap-3 relative z-10 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-sans tracking-widest uppercase font-bold px-2 py-0.5 rounded-full border ${
                        g.status === 'completed' 
                          ? 'bg-slate-950 border-slate-800 text-slate-500' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {g.status}
                      </span>
                      {g.watermark && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          FREE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">{g.id}</span>
                  </div>

                  <div>
                    <h4 className="text-lg font-extrabold text-white leading-tight mt-1">{g.title}</h4>
                    <p className="text-xs text-slate-400 truncate mt-1">Prize: {g.prize}</p>
                  </div>

                  <div className="flex items-center gap-3 mt-2 py-2 px-2.5 bg-slate-950/60 border border-slate-900 rounded-xl">
                    <Users className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-slate-300 font-semibold">
                        {t('dashboard.campaignEntries', { registered: stats.registered })}
                      </span>
                      <span className="text-emerald-400/90">
                        {t('dashboard.campaignVerified', { verified: stats.verified })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {g.requiredProfiles.map((p, pIdx) => (
                      <span key={pIdx} className="text-[10px] font-sans bg-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-slate-900">
                        @{p}
                      </span>
                    ))}
                    {g.requiredProfiles.length === 0 && (
                      <span className="text-[10px] font-sans bg-slate-950 text-slate-500 px-2 py-0.5 rounded-md border border-slate-900">
                        Simple Honor System Mode
                      </span>
                    )}
                  </div>

                  {g.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => onSelectRoute(`/giveaway/${g.slug}/archive`)}
                      className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer text-left mt-1"
                    >
                      View Proof Archive →
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-800/80 pt-4 mt-6 flex flex-wrap items-center justify-between gap-3 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-sans uppercase">Campaign Url</span>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => onSelectRoute(`/giveaway/${g.slug}`)}
                        className="text-amber-500 text-xs font-sans font-bold hover:underline select-all text-left truncate max-w-[180px] cursor-pointer"
                      >
                        lootly.gg/g/{g.slug}
                      </button>
                      <button
                        onClick={() => handleCopyLink(g.slug)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition cursor-pointer ${
                          copiedSlug === g.slug
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'
                        }`}
                        title="Copy giveaway link"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedSlug === g.slug ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDeleteGiveaway(g.id)}
                      className="p-2 bg-red-950/20 text-red-400 rounded-lg hover:bg-red-950 hover:text-white transition cursor-pointer"
                      title="Delete Campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {g.status === 'completed' ? (
                      <button
                        onClick={() => onSelectRoute(`/giveaway/${g.slug}/archive`)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        {t('dashboard.proofArchive')}
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectRoute(`/giveaway/${g.slug}/draw`)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Trophy className="h-3.5 w-3.5" /> Sweepstake Draw
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#090f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-bold text-white mb-2">{t('dashboard.createTitle')}</h4>
            <p className="text-xs text-slate-400 mb-6">{t('dashboard.createDesc')}</p>
            
            {showUpgradePrompt && (
              <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400 shrink-0" />
                  <p className="text-sm font-bold text-amber-300">Free plan limit reached</p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Upgrade to Pro for unlimited campaigns, no watermark, and higher participant caps.
                </p>
                <button
                  type="button"
                  onClick={onUpgradeHost}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold rounded-xl hover:from-amber-400 hover:to-amber-300 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Crown className="h-4 w-4" /> Upgrade to Pro
                </button>
              </div>
            )}

            {errorMessage && !showUpgradePrompt && (
              <div className="mb-4 p-3 bg-red-950/20 border border-red-900/40 text-red-400 text-xs rounded-lg font-sans leading-relaxed">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-4 text-left">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.campaignTitle')}</label>
                <input
                  type="text"
                  placeholder={t('dashboard.campaignTitlePh')}
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.prizeName')}</label>
                  <input
                    type="text"
                    placeholder={t('dashboard.prizeNamePh')}
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.urlSlug')}</label>
                  <input
                    type="text"
                    placeholder={t('dashboard.urlSlugPh')}
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''));
                    }}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 font-sans block">{t('dashboard.slugHint')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-2 font-sans">{t('dashboard.prizeImageUpload')}</label>
                <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-800 rounded-xl p-4 cursor-pointer hover:border-amber-500/40 transition bg-[#050811]">
                  {imageURL ? (
                    <img
                      src={imageURL}
                      alt=""
                      className="max-h-28 rounded-lg object-contain mb-2"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-slate-600 mb-2" />
                  )}
                  <span className="text-xs text-slate-400 text-center">
                    {uploadingImage ? t('dashboard.prizeImageUploading') : t('dashboard.prizeImageUploadHint')}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handlePrizeImageFile}
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.prizeDesc')}</label>
                <textarea
                  placeholder={t('dashboard.prizeDescPh')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.bulkProfiles')}</label>
                <textarea
                  placeholder={t('dashboard.bulkProfilesPh')}
                  value={bulkProfilesText}
                  onChange={(e) => setBulkProfilesText(e.target.value)}
                  rows={4}
                  className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">
                  {bulkProfilesText.trim()
                    ? t('dashboard.bulkProfilesHint', { count: parsedProfiles.length })
                    : t('dashboard.followHint')}
                </span>
                {parsedProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parsedProfiles.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] bg-slate-900 border border-slate-800 text-amber-400/90 px-2 py-0.5 rounded-md"
                      >
                        @{p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.drawHours')}</label>
                  <select
                    value={drawHours}
                    onChange={(e) => setDrawHours(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="2">{t('dashboard.hours2')}</option>
                    <option value="24">{t('dashboard.hours24')}</option>
                    <option value="72">{t('dashboard.hours72')}</option>
                    <option value="168">{t('dashboard.hours168')}</option>
                    <option value="custom">{t('dashboard.drawCustom')}</option>
                  </select>
                </div>
                {drawHours === 'custom' && (
                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-sans">{t('dashboard.drawCustom')}</label>
                    <input
                      type="number"
                      min={1}
                      max={8760}
                      placeholder={t('dashboard.drawCustomPh')}
                      value={customDrawHours}
                      onChange={(e) => setCustomDrawHours(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">{t('dashboard.maxParticipants')}</label>
                  <input
                    type="number"
                    placeholder="No limit"
                    value={maxPart}
                    onChange={(e) => setMaxPart(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">{t('dashboard.winnersCount')}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={winners}
                    onChange={(e) => setWinners(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">{t('dashboard.referralBonus')}</label>
                  <input
                    type="number"
                    min="1"
                    value={refBonus}
                    onChange={(e) => setRefBonus(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Verification Mode Method</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode('verified')}
                    className={`py-2 rounded-lg border text-center transition cursor-pointer ${
                      mode === 'verified' 
                        ? 'bg-slate-800 border-slate-700 text-amber-500 font-bold' 
                        : 'border-slate-800 text-slate-500'
                    }`}
                  >
                    {t('dashboard.modeVerified')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('simple')}
                    className={`py-2 rounded-lg border text-center transition cursor-pointer ${
                      mode === 'simple' 
                        ? 'bg-slate-800 border-slate-700 text-slate-300 font-bold' 
                        : 'border-slate-800 text-slate-500'
                    }`}
                  >
                    {t('dashboard.modeSimple')}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-950 font-bold py-2.5 rounded-xl hover:bg-amber-400 transition cursor-pointer"
                >
                  {t('dashboard.publish')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 border border-slate-800 rounded-xl hover:bg-slate-900 transition text-slate-400 cursor-pointer"
                >
                  {t('dashboard.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
