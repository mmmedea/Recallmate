import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata: Metadata = {
  title: "Terms of Service | RecallMate",
  description: "Terms and conditions for using the RecallMate AI study platform.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="September 30, 2026">
      <TermsContent />
    </LegalLayout>
  );
}
