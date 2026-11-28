/* ══ community-polls/model.ts — community polls + voting system ══ */

export type PollCategory = "feature-request" | "design-vote" | "tech-decision" | "general";
export type PollStatus = "draft" | "active" | "closed";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  category: PollCategory;
  options: PollOption[];
  status: PollStatus;
  createdAt: number;
  expiresAt: number;
  quorum: number;
  voters: string[];
}

export function totalVotes(poll: Poll): number {
  return poll.options.reduce((sum, o) => sum + o.votes, 0);
}

export function votePercentage(option: PollOption, total: number): number {
  if (total === 0) return 0;
  return Math.round((option.votes / total) * 1000) / 10;
}

export function leadingOption(poll: Poll): PollOption | null {
  if (poll.options.length === 0) return null;
  return poll.options.reduce((best, o) => o.votes > best.votes ? o : best, poll.options[0]);
}

export function hasQuorum(poll: Poll): boolean {
  return totalVotes(poll) >= poll.quorum;
}

export function canVote(poll: Poll, userId: string, now: number): { allowed: boolean; reason?: string } {
  if (poll.status !== "active") return { allowed: false, reason: "Poll is not active" };
  if (now > poll.expiresAt) return { allowed: false, reason: "Poll has expired" };
  if (poll.voters.includes(userId)) return { allowed: false, reason: "Already voted" };
  return { allowed: true };
}

export function castVote(poll: Poll, optionId: string, userId: string): Poll {
  return {
    ...poll,
    options: poll.options.map((o) => o.id === optionId ? { ...o, votes: o.votes + 1 } : o),
    voters: [...poll.voters, userId],
  };
}

export function isExpired(poll: Poll, now: number): boolean {
  return now > poll.expiresAt;
}

export function sortByVotes(poll: Poll): PollOption[] {
  return [...poll.options].sort((a, b) => b.votes - a.votes);
}
