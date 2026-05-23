import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import type { Giveaway } from '../data';
import {
  buildHostNotifications,
  loadDismissedNotificationIds,
  loadReadNotificationIds,
  saveDismissedNotificationIds,
  saveReadNotificationIds,
} from '../utils/hostNotifications';

interface HostNotificationsProps {
  hostId: string;
  giveaways: Giveaway[];
  onNavigate: (route: string) => void;
}

export default function HostNotifications({
  hostId,
  giveaways,
  onNavigate,
}: HostNotificationsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadNotificationIds(hostId));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    loadDismissedNotificationIds(hostId)
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const myGiveaways = useMemo(
    () => giveaways.filter((g) => g.hostId === hostId),
    [giveaways, hostId]
  );

  const notifications = useMemo(() => {
    const all = buildHostNotifications(myGiveaways, t);
    return all.filter((n) => !dismissedIds.has(n.id));
  }, [myGiveaways, t, dismissedIds]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => {
    setReadIds(loadReadNotificationIds(hostId));
    setDismissedIds(loadDismissedNotificationIds(hostId));
  }, [hostId]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const persistDismissed = (next: Set<string>) => {
    setDismissedIds(next);
    saveDismissedNotificationIds(hostId, next);
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set<string>(dismissedIds);
    next.add(id);
    persistDismissed(next);
    const alsoRead = new Set<string>(readIds);
    alsoRead.add(id);
    setReadIds(alsoRead);
    saveReadNotificationIds(hostId, alsoRead);
  };

  const markAllRead = () => {
    const next = new Set<string>(readIds);
    notifications.forEach((n) => next.add(n.id));
    setReadIds(next);
    saveReadNotificationIds(hostId, next);
  };

  const openNotification = (id: string, route: string) => {
    const next = new Set<string>(readIds);
    next.add(id);
    setReadIds(next);
    saveReadNotificationIds(hostId, next);
    setOpen(false);
    onNavigate(route);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl border border-slate-800/80 bg-[#0a0f1d]/75 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
        title={t('notifications.title')}
        aria-label={t('notifications.title')}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-hidden bg-[#090f1d] border border-slate-800 rounded-2xl shadow-2xl z-[130] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-xs font-bold text-white font-display">{t('notifications.title')}</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="h-3 w-3" /> {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 px-3">{t('notifications.empty')}</p>
            ) : (
              notifications.map((n) => {
                const unread = !readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={`relative mb-1.5 rounded-xl border transition ${
                      unread
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-transparent border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(n.id, n.route)}
                      className="w-full text-left p-3 pr-9 cursor-pointer hover:bg-slate-900/30 rounded-xl"
                    >
                      <div className="flex items-start gap-2">
                        {unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-200">{n.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => dismissNotification(n.id, e)}
                      className="absolute top-2 right-2 p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition cursor-pointer"
                      title={t('notifications.dismiss')}
                      aria-label={t('notifications.dismiss')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
