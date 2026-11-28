/* ══ notification-center/model.ts — unified notification management ══ */

export type Priority = "info" | "warning" | "urgent";
export type NotifCategory = "system" | "pr" | "issue" | "review" | "badge" | "mention";

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  category: NotifCategory;
  read: boolean;
  dismissed: boolean;
  createdAt: number;
  link?: string;
}

export interface NotifPrefs {
  enabledCategories: NotifCategory[];
  muteUntil: number | null;
  emailDigest: boolean;
}

export function unreadCount(notifs: Notification[]): number {
  return notifs.filter((n) => !n.read && !n.dismissed).length;
}

export function markRead(id: string, notifs: Notification[]): Notification[] {
  return notifs.map((n) => n.id === id ? { ...n, read: true } : n);
}

export function markAllRead(notifs: Notification[]): Notification[] {
  return notifs.map((n) => ({ ...n, read: true }));
}

export function dismiss(id: string, notifs: Notification[]): Notification[] {
  return notifs.map((n) => n.id === id ? { ...n, dismissed: true } : n);
}

export function filterByCategory(notifs: Notification[], category: NotifCategory): Notification[] {
  return notifs.filter((n) => n.category === category);
}

export function filterByPriority(notifs: Notification[], priority: Priority): Notification[] {
  return notifs.filter((n) => n.priority === priority);
}

export function sortByRecent(notifs: Notification[]): Notification[] {
  return [...notifs].sort((a, b) => b.createdAt - a.createdAt);
}

export function isMuted(prefs: NotifPrefs, now: number): boolean {
  return prefs.muteUntil !== null && now < prefs.muteUntil;
}

export function shouldShow(notif: Notification, prefs: NotifPrefs, now: number): boolean {
  if (notif.dismissed) return false;
  if (isMuted(prefs, now) && notif.priority !== "urgent") return false;
  return prefs.enabledCategories.includes(notif.category);
}
