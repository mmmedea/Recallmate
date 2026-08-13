"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// SessionGuard — observer only.
//
// Subscribes to Supabase client-side auth state changes and triggers a server
// re-evaluation when the session is lost or the token refresh fails.
//
// Rule: SessionGuard observes and signals. It never grants or revokes
// authorization itself. The server layout (getClaims) is authoritative.
export function SessionGuard() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        // Force server layout to re-evaluate the session.
        // If session is gone, the server redirect kicks in.
        // If session is still valid after TOKEN_REFRESHED, this is a no-op.
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  // Renders nothing — purely reactive
  return null;
}
