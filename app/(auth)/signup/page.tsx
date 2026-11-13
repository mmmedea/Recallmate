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

  return (
    <AuthCard>
      <div className="space-y-6">
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-[#fffaff]">
            Create your account
          </h1>
          <p className="font-quicksand text-sm font-semibold text-[#c9c2d5]">
            Start learning smarter with RecallMate
          </p>
        </div>

        <div className="space-y-6">
          {/* Google OAuth */}
          <OAuthButtons redirectTo={next} />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#a78bfa]/25" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#17111f] px-3 font-pixelify text-[#c4a7ff] font-medium tracking-widest">
                or
              </span>
            </div>
          </div>

          {/* Email OTP */}
          <EmailOTPForm intent="signup" privacyAgreed={privacyAgreed} redirectTo={next} username={username} onUsernameChange={setUsername} password={password} onPasswordChange={setPassword} confirmPassword={confirmPassword} onConfirmPasswordChange={setConfirmPassword} />
        </div>

        {/* Privacy acknowledgement */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="flex items-start gap-3 bg-[#21172a]/90 p-4 rounded-2xl border border-[#a78bfa]/25 w-full">
            <input
              id="privacy-checkbox"
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer shrink-0"
              aria-required="true"
            />
            <div className="text-sm text-[#c9c2d5] leading-relaxed select-none">
              <label htmlFor="privacy-checkbox" className="cursor-pointer">
                I have read and agree to the{" "}
              </label>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="font-medium text-[#ff7185] hover:underline"
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
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
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

        {/* Sign in link */}
        <p className="text-center text-sm text-[#c9c2d5] pt-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
          <p role="status" className="py-8 text-center text-sm text-slate-500">
            Loading sign-up form…
          </p>
        </AuthCard>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
