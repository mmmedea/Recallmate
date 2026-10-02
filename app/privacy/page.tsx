import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy | RecallMate",
  description: "How RecallMate processes account information, study materials, and AI-assisted study activity.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="September 30, 2026">
      <PrivacyContent />
    </LegalLayout>
  );
}
