import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  let next = "/dashboard";
  if (
    resolvedSearchParams.next &&
    resolvedSearchParams.next.startsWith("/") &&
    !resolvedSearchParams.next.startsWith("//")
  ) {
    next = resolvedSearchParams.next;
  }

  return (
    <AuthCard>
      <div className="space-y-6">
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-[#fffaff]">
            Welcome back
          </h1>
          <p className="font-quicksand text-sm font-semibold text-[#c9c2d5]">
            Sign in to your RecallMate account
          </p>
        </div>

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
        <EmailOTPForm intent="signin" redirectTo={next} />

        {/* Sign up link */}
        <p className="text-center text-sm text-[#c9c2d5]">
          New to RecallMate?{" "}
          <Link
            href="/signup"
            className="font-fredoka font-semibold text-[#ff7185] hover:text-[#c4a7ff] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a7ff] rounded"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
