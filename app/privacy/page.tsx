import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
export const metadata = { title: "Privacy Policy | RecallMate", description: "Learn how RecallMate handles account, study, and preference information." };
export default function PrivacyPage(){return <div className="flex min-h-screen flex-col bg-[#08070d] text-white"><Navbar/><main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 md:py-20"><h1 className="font-fredoka mb-8 text-4xl">Privacy Policy</h1><div className="rounded-3xl border border-[#a78bfa]/20 bg-[#14101d] p-7 sm:p-10"><PrivacyContent/></div></main><Footer/></div>}