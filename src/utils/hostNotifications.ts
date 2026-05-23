import type { Giveaway } from '../data';

export type HostNotificationType = 'campaign_created' | 'draw_soon' | 'draw_overdue';

export interface HostNotification {
  id: string;
  type: HostNotificationType;
  title: string;
  body: string;
  at: string;
  route: string;
  giveawayId: string;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function buildHostNotifications(
  giveaways: Giveaway[],
  t: TranslateFn
): HostNotification[] {
  const now = Date.now();
  const list: HostNotification[] = [];

  for (const g of giveaways) {
    const drawAt = new Date(g.drawDate).getTime();
    const msUntil = drawAt - now;
    const createdMs = now - new Date(g.createdAt).getTime();

    if (createdMs >= 0 && createdMs < 7 * 24 * 60 * 60 * 1000) {
      list.push({
        id: `created-${g.id}`,
        type: 'campaign_created',
        title: t('notifications.campaignCreatedTitle'),
        body: t('notifications.campaignCreatedBody', { title: g.title }),
        at: g.createdAt,
        route: '/dashboard',
        giveawayId: g.id,
      });
    }

    if (g.status !== 'completed' && msUntil > 0 && msUntil <= 60 * 60 * 1000) {
      const mins = Math.max(1, Math.round(msUntil / 60000));
      list.push({
        id: `soon-${g.id}`,
        type: 'draw_soon',
        title: t('notifications.drawSoonTitle'),
        body: t('notifications.drawSoonBody', { title: g.title, mins }),
        at: new Date().toISOString(),
        route: `/giveaway/${g.slug}/draw`,
        giveawayId: g.id,
      });
    }

    if (g.status === 'active' && msUntil < 0) {
      list.push({
        id: `overdue-${g.id}`,
        type: 'draw_overdue',
        title: t('notifications.drawOverdueTitle'),
        body: t('notifications.drawOverdueBody', { title: g.title }),
        at: g.drawDate,
        route: `/giveaway/${g.slug}/draw`,
        giveawayId: g.id,
      });
    }
  }

  return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function loadReadNotificationIds(hostId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`lootly_notif_read_${hostId}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(hostId: string, ids: Set<string>) {
  localStorage.setItem(`lootly_notif_read_${hostId}`, JSON.stringify([...ids]));
}

export function loadDismissedNotificationIds(hostId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`lootly_notif_dismissed_${hostId}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveDismissedNotificationIds(hostId: string, ids: Set<string>) {
  localStorage.setItem(`lootly_notif_dismissed_${hostId}`, JSON.stringify([...ids]));
}
