"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { AuthenticatedUser } from "@/lib/types/auth";

export function AccountMenu({ user }: { user: AuthenticatedUser }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };
  const initial = (user.email?.trim()[0] || "U").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open account menu" className="rounded-full border border-white/10 bg-white/[0.05] font-fredoka text-sm font-bold text-[#d9c8ff] hover:bg-white/10">{initial}<span className="sr-only">Account menu</span></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-white/10 bg-[#15131d] text-white">
        <DropdownMenuLabel className="font-normal"><div className="flex flex-col space-y-1"><p className="font-nunito text-sm font-bold">Your account</p><p className="truncate font-quicksand text-xs text-white/45">{user.email}</p></div></DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer font-nunito focus:bg-white/10 focus:text-white"><Link href="/settings"><span className="mr-2 text-[#c4b5fd]">⚙</span>Settings & Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer font-nunito focus:bg-white/10 focus:text-white"><Link href="/help"><span className="mr-2 text-[#c4b5fd]">?</span>Help center</Link></DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="cursor-pointer font-nunito text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"><span className="mr-2">{isLoggingOut ? "…" : "↗"}</span>{isLoggingOut ? "Signing out…" : "Log out"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
