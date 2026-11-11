import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TermsContent } from "@/components/legal/TermsContent";
export const metadata = { title: "Terms & Conditions | RecallMate", description: "Terms and conditions for using RecallMate." };
export default function TermsPage(){return <div className="flex min-h-screen flex-col bg-[#08070d] text-white"><Navbar/><main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 md:py-20"><h1 className="font-fredoka mb-8 text-4xl">Terms & Conditions</h1><div className="rounded-3xl border border-[#a78bfa]/20 bg-[#14101d] p-7 sm:p-10"><TermsContent/></div></main><Footer/></div>}