import { describe, it, expect } from "vitest";
import { unreadCount, markRead, markAllRead, dismiss, filterByCategory, filterByPriority, sortByRecent, shouldShow, isMuted } from "./model";

describe("notification-center/model", () => {
  const notifs = [
    { id: "n1", title: "PR merged", body: "Your PR was merged", priority: "info" as const, category: "pr" as const, read: false, dismissed: false, createdAt: 1000 },
    { id: "n2", title: "Review requested", body: "Please review", priority: "warning" as const, category: "review" as const, read: false, dismissed: false, createdAt: 2000 },
    { id: "n3", title: "Badge earned", body: "New badge!", priority: "info" as const, category: "badge" as const, read: true, dismissed: false, createdAt: 500 },
  ];
  const prefs = { enabledCategories: ["pr" as const, "review" as const, "badge" as const, "system" as const, "issue" as const, "mention" as const], muteUntil: null, emailDigest: false };

  it("counts unread", () => { expect(unreadCount(notifs)).toBe(2); });
  it("marks one as read", () => { expect(markRead("n1", notifs)[0].read).toBe(true); });
  it("marks all read", () => { expect(markAllRead(notifs).every((n) => n.read)).toBe(true); });
  it("dismisses a notification", () => { expect(dismiss("n1", notifs)[0].dismissed).toBe(true); });
  it("filters by category", () => { expect(filterByCategory(notifs, "pr").length).toBe(1); });
  it("filters by priority", () => { expect(filterByPriority(notifs, "warning").length).toBe(1); });
  it("sorts by recent", () => { expect(sortByRecent(notifs)[0].id).toBe("n2"); });
  it("shows non-dismissed matching notifs", () => { expect(shouldShow(notifs[0], prefs, 500)).toBe(true); });
  it("respects mute", () => {
    const muted = { ...prefs, muteUntil: 9999 };
    expect(isMuted(muted, 500)).toBe(true);
  });
});
