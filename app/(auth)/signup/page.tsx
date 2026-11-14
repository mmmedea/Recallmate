"use client";

import { Suspense, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { TermsContent } from "@/components/legal/TermsContent";

function SignupPageContent() {
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const next = "/dashboard";

  const privacyControl = (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="flex w-full items-start gap-3 rounded-2xl border border-[#dfd0f3] bg-[linear-gradient(120deg,#f3edff,#fff0f3)] p-4 shadow-[0_5px_18px_rgba(45,25,60,.05)]">
                <input
                  id="privacy-checkbox"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-[#bba8d1] text-[#a04ee8] accent-[#a04ee8] focus:ring-2 focus:ring-[#c4a7ff] focus:ring-offset-2 focus:ring-offset-[#f8f2ff]"
                  aria-required="true"
                />
                <div className="select-none text-sm leading-relaxed text-[#4c4059]">
                  <label htmlFor="privacy-checkbox" className="cursor-pointer">
                    I have read and agree to the{" "}
                  </label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="font-bold text-[#d43d5b] underline-offset-4 transition-colors hover:text-[#8c55cf] hover:underline"
                      >
                        Privacy Policy
                      </button>
                    </DialogTrigger>
                    <DialogContent className="!fixed !left-1/2 !top-1/2 !z-[100] !w-[calc(100vw-2rem)] !max-w-3xl !-translate-x-1/2 !-translate-y-1/2 !gap-0 !p-0 flex max-h-[min(86dvh,820px)] flex-col overflow-hidden rounded-[1.75rem] border border-[#5c456f] bg-[#100b16] text-[#f8f2ff] shadow-[0_35px_110px_rgba(0,0,0,.72),0_0_55px_rgba(167,139,250,.12)] sm:max-w-3xl">
                      <DialogHeader className="relative border-b border-[#6a527b]/40 bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,.22),transparent_55%),linear-gradient(110deg,#181020,#1c101b)] px-6 pb-5 pt-6 text-left sm:px-8">
                        <p className="font-pixelify text-[10px] tracking-[.24em] text-[#c4a7ff]">RECALLMATE · YOUR DATA</p>
                        <DialogTitle className="font-fredoka text-2xl font-semibold tracking-tight text-white sm:text-3xl">Privacy Policy</DialogTitle>
                        <p className="font-quicksand text-sm text-[#b8a9c8]">Understand how your information is handled.</p>
                      </DialogHeader>
                      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pr-4 [scrollbar-color:#8b6aa8_#211829] [scrollbar-width:thin] sm:px-8 sm:py-6">
                        <PrivacyContent />
                      </div>
                      <div className="mt-auto flex justify-end border-t border-[#6a527b]/40 bg-[#120d18] px-6 py-4 sm:px-8">
                        <DialogClose asChild>
                          <Button variant="outline" className="h-10 rounded-xl border-[#80618e] bg-[#211729] px-6 font-fredoka text-sm text-[#f8f2ff] transition-all hover:border-[#ff7185] hover:bg-[#34203a] hover:text-white">Close</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {" "}and{" "}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="font-bold text-[#d43d5b] underline-offset-4 transition-colors hover:text-[#8c55cf] hover:underline"
                      >
                        Terms of Service
                      </button>
                    </DialogTrigger>
                    <DialogContent className="!fixed !left-1/2 !top-1/2 !z-[100] !w-[calc(100vw-2rem)] !max-w-3xl !-translate-x-1/2 !-translate-y-1/2 !gap-0 !p-0 flex max-h-[min(86dvh,820px)] flex-col overflow-hidden rounded-[1.75rem] border border-[#5c456f] bg-[#100b16] text-[#f8f2ff] shadow-[0_35px_110px_rgba(0,0,0,.72),0_0_55px_rgba(167,139,250,.12)] sm:max-w-3xl">
                      <DialogHeader className="relative border-b border-[#6a527b]/40 bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,.22),transparent_55%),linear-gradient(110deg,#181020,#1c101b)] px-6 pb-5 pt-6 text-left sm:px-8">
                        <p className="font-pixelify text-[10px] tracking-[.24em] text-[#ff7185]">RECALLMATE · THE AGREEMENT</p>
                        <DialogTitle className="font-fredoka text-2xl font-semibold tracking-tight text-white sm:text-3xl">Terms of Service</DialogTitle>
                        <p className="font-quicksand text-sm text-[#b8a9c8]">The guidelines for using RecallMate.</p>
                      </DialogHeader>
                      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pr-4 [scrollbar-color:#8b6aa8_#211829] [scrollbar-width:thin] sm:px-8 sm:py-6">
                        <TermsContent />
                      </div>
                      <div className="mt-auto flex justify-end border-t border-[#6a527b]/40 bg-[#120d18] px-6 py-4 sm:px-8">
                        <DialogClose asChild>
                          <Button variant="outline" className="h-10 rounded-xl border-[#80618e] bg-[#211729] px-6 font-fredoka text-sm text-[#f8f2ff] transition-all hover:border-[#ff7185] hover:bg-[#34203a] hover:text-white">Close</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                  .
                </div>
              </div>
            </div>
  );

  return (
    <AuthCard>
      <div className="space-y-5"><nav aria-label="Account access" className="mx-auto grid w-full max-w-[280px] grid-cols-2 rounded-full border border-[#e5d9f4] bg-[#eee8f7] p-1.5 shadow-inner"><Link href="/login" className="rounded-full px-4 py-2.5 text-center font-fredoka text-sm font-semibold text-[#766b84] transition-all duration-200 hover:bg-white/70 hover:text-[#21152d]">Sign in</Link><Link href="/signup" aria-current="page" className="rounded-full bg-gradient-to-r from-white to-[#fff4f6] px-4 py-2.5 text-center font-fredoka text-sm font-semibold text-[#21152d] shadow-[0_3px_12px_rgba(34,18,48,.12)] ring-1 ring-white">Sign up</Link></nav>
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-[#21152d] sm:text-4xl">
            Create your account
          </h1>
          <p className="font-quicksand text-sm font-semibold text-[#746a80] sm:text-base">
            Start learning smarter with RecallMate
          </p>
        </div>

        <div className="space-y-6">

          {/* Email OTP */}
          <EmailOTPForm intent="signup" privacyAgreed={privacyAgreed} redirectTo={next} username={username} onUsernameChange={setUsername} password={password} onPasswordChange={setPassword} confirmPassword={confirmPassword} onConfirmPasswordChange={setConfirmPassword} privacyControl={privacyControl} />
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#a78bfa]/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#fffaff] px-3 font-pixelify text-[11px] tracking-[0.18em] text-[#8b779f]">OR CONTINUE WITH</span>
            </div>
          </div>
          <OAuthButtons redirectTo={next} intent="signup" />
        </div>

        {/* Sign in link */}
        <p className="text-center text-sm text-[#746a80] pt-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#bd4668] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <p role="status" className="py-8 text-center text-sm text-[#746a80]">
            Loading sign-up form…
          </p>
        </AuthCard>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
