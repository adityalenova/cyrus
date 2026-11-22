import type { Metadata } from "next";
import Leaderboard from "@/views/Leaderboard";
import { BOARD_META } from "@/data/leaderboard";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "PR Leaderboard",
  description: `${BOARD_META.humans} open-source contributors ranked by GitHub's own merged, reviewed and open pull-request counts, with the method printed next to the numbers and automation accounts held back by default.`,
  alternates: { canonical: canonical("/leaderboard") },
};

export default function Page() {
  return <Leaderboard />;
}
