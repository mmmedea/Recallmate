"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  let next = "/dashboard";
  if (
    requestedNext &&
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//")
  ) {
    next = requestedNext;
  }

  const privacyControl = (
            <div className="flex flex-col items-center gap-3 mt-4">
              <div className="flex items-start gap-3 bg-[#f5f0fa] p-4 rounded-2xl border border-[#e7def0] w-full">
                <input
                  id="privacy-checkbox"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-[#a78bfa] focus:ring-[#a78bfa] focus:ring-offset-0 cursor-pointer shrink-0"
                  aria-required="true"
                />
                <div className="text-sm text-[#5f536b] leading-relaxed select-none">
                  <label htmlFor="privacy-checkbox" className="cursor-pointer">
                    I have read and agree to the{" "}
                  </label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="font-medium text-[#bd4668] hover:underline"
                      >
                        Privacy Policy
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <DialogHeader>
                        <DialogTitle>Privacy Policy</DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                        <PrivacyContent />
                      </div>
                      <div className="flex justify-end pt-4 border-t mt-auto">
                        <DialogClose asChild>
                          <Button variant="outline">Close</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {" "}and{" "}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="font-medium text-[#a34c75] hover:underline"
                      >
                        Terms of Service
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <DialogHeader>
                        <DialogTitle>Terms of Service</DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                        <TermsContent />
                      </div>
                      <div className="flex justify-end pt-4 border-t mt-auto">
                        <DialogClose asChild>
                          <Button variant="outline">Close</Button>
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
      <div className="space-y-5"><nav aria-label="Account access" className="mx-auto grid w-full max-w-[260px] grid-cols-2 rounded-full bg-[#eee8f6] p-1"><Link href="/login" className="rounded-full px-4 py-2 text-center font-fredoka text-sm font-semibold text-[#756b80] hover:text-[#a34c75]">Sign in</Link><Link href="/signup" aria-current="page" className="rounded-full bg-white px-4 py-2 text-center font-fredoka text-sm font-semibold text-[#24152f] shadow-sm">Sign up</Link></nav>
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-[#21152d]">
            Create your account
          </h1>
          <p className="font-quicksand text-sm font-semibold text-[#746a80]">
            Start learning smarter with RecallMate
          </p>
        </div>

        <div className="space-y-6">

          {/* Email OTP */}
          <EmailOTPForm intent="signup" privacyAgreed={privacyAgreed} redirectTo={next} username={username} onUsernameChange={setUsername} password={password} onPasswordChange={setPassword} confirmPassword={confirmPassword} onConfirmPasswordChange={setConfirmPassword} privacyControl={privacyControl} />
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
}          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#a78bfa]/25" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#fffaff] px-3 font-pixelify text-xs font-medium tracking-widest text-[#8b779f]">
                OR CONTINUE WITH
              </span>
            </div>
          </div>


