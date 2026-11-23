import type { Metadata } from "next";
import LedgerRecovery from "@/features/ledger-guard/LedgerRecovery";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Issue board recovery",
  description:
    "See which account owns this browser's tracked-issue board, and choose what happens when a GitHub account is disconnected, replaced, or newly linked. Keep the board, export it as JSON, or clear it.",
  alternates: { canonical: canonical("/issues/recovery") },
};

export default function Page() {
  return <LedgerRecovery />;
}
