import Navbar from "@/components/Navbar";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata = {
  title: "Terms of Service | RecallMate",
  description: "Terms and conditions for using the RecallMate AI study platform.",
};

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 md:py-20 w-full">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-8">Terms of Service</h1>
        <TermsContent />
      </main>
    </div>
  );
}
