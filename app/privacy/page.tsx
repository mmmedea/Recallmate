import Navbar from "@/components/Navbar";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata = {
  title: "Privacy Policy | RecallMate",
  description: "Learn how RecallMate collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 md:py-20 w-full">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-8">Privacy Policy</h1>
        <PrivacyContent />
      </main>
    </div>
  );
}
