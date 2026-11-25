import { describe, it, expect } from "vitest";
import { totalVotes, votePercentage, leadingOption, hasQuorum, canVote, castVote, isExpired, sortByVotes } from "./model";

describe("community-polls/model", () => {
  const poll = {
    id: "p1", title: "Best framework?", description: "", category: "tech-decision" as const,
    options: [{ id: "a", text: "React", votes: 10 }, { id: "b", text: "Vue", votes: 7 }, { id: "c", text: "Svelte", votes: 3 }],
    status: "active" as const, createdAt: 1000, expiresAt: 99999999999, quorum: 15, voters: ["u1", "u2"],
  };

  it("counts total votes", () => { expect(totalVotes(poll)).toBe(20); });
  it("computes vote percentage", () => { expect(votePercentage(poll.options[0], 20)).toBe(50); });
  it("finds leading option", () => { expect(leadingOption(poll)?.id).toBe("a"); });
  it("checks quorum", () => { expect(hasQuorum(poll)).toBe(true); });
  it("allows new voter", () => { expect(canVote(poll, "u3", 2000).allowed).toBe(true); });
  it("blocks duplicate voter", () => { expect(canVote(poll, "u1", 2000).allowed).toBe(false); });
  it("casts a vote", () => { const updated = castVote(poll, "b", "u3"); expect(updated.options[1].votes).toBe(8); });
  it("detects expiry", () => { expect(isExpired(poll, 999999999999)).toBe(true); });
  it("sorts options by votes", () => { expect(sortByVotes(poll)[0].id).toBe("a"); });
});
