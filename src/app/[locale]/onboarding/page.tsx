import type { Metadata } from "next";
import Onboarding from "@/views/Onboarding";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Five steps to a profile: your name, the languages and domains you build in, the mentored programs you are aiming at, and the archived projects that fit.",
  alternates: { canonical: canonical("/onboarding") },
};

export default function Page() {
  return <Onboarding />;
}
