"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import type { MedeaOpenOptions } from "@/lib/medea-navigation";
import { useAppStore } from "@/lib/store";

type MedeaLauncherProps =
  MedeaOpenOptions &
    Omit<
      ButtonHTMLAttributes<HTMLButtonElement>,
      "onClick" | "type"
    > & {
      children: ReactNode;
    };

/**
 * Canonical UI entry point for opening Medea.
 *
 * Use this instead of:
 * - setChatDrawerOpen(true)
 * - router.push("/chat")
 * - router.push("/chat?documentId=...")
 *
 * It safely passes optional launch context into Zustand.
 */
export function MedeaLauncher({
  documentId,
  source,
  suggestedPrompt,
  children,
  ...buttonProps
}: MedeaLauncherProps) {
  const openMedea = useAppStore(
    (state) => state.openMedea,
  );

  const handleOpenMedea = () => {
    openMedea({
      documentId,
      source,
      suggestedPrompt,
    });
  };

  return (
    <button
      type="button"
      {...buttonProps}
      onClick={handleOpenMedea}
    >
      {children}
    </button>
  );
}