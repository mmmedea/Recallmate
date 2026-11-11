import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./DiamondLoader.module.css";

export type DiamondLoaderVariant = "page" | "section" | "inline";

interface DiamondLoaderProps {
  variant?: DiamondLoaderVariant;
  label?: string;
  sublabel?: string;
  className?: string;
  decorative?: boolean;
  children?: ReactNode;
}

const visualClassByVariant: Record<DiamondLoaderVariant, string> = {
  page: styles.pageVisual,
  section: styles.sectionVisual,
  inline: styles.inlineVisual,
};

/** Shared violet diamond loading state for routes, sections, and actions. */
export function DiamondLoader({
  variant = "section",
  label = "Loading",
  sublabel,
  className,
  decorative = false,
  children,
}: DiamondLoaderProps) {
  const inline = variant === "inline";
  const RootElement = inline ? "span" : "div";

  return (
    <RootElement
      className={cn(styles.root, styles[variant], className)}
      {...(decorative
        ? { "aria-hidden": true }
        : {
            role: "status",
            "aria-live": "polite" as const,
            "aria-atomic": true,
            "aria-label": label,
          })}
      data-variant={variant}
    >
      {variant === "page" && <span className={styles.glow} aria-hidden="true" />}

      <span
        className={cn(styles.visual, visualClassByVariant[variant])}
        aria-hidden="true"
      >
        <span className={cn(styles.orbit, styles.orbitOuter)}>
          <span className={styles.orbitSpark} />
        </span>
        <span className={cn(styles.orbit, styles.orbitInner)} />
        <svg className={styles.gem} viewBox="0 0 128 128" focusable="false">
          <polygon className={cn(styles.facet, styles.facetTopLeft)} points="64,8 64,62 12,64" />
          <polygon className={cn(styles.facet, styles.facetTopRight)} points="64,8 116,64 64,62" />
          <polygon className={cn(styles.facet, styles.facetBottomRight)} points="64,62 116,64 64,120" />
          <polygon className={cn(styles.facet, styles.facetBottomLeft)} points="12,64 64,62 64,120" />
          <path className={styles.gemHighlight} d="M64 8 116 64 64 120 12 64 64 8Z" />
        </svg>
        <span className={styles.core} />
      </span>

      {!inline ? (
        <span className={styles.copy}>
          <span className={styles.label}>
            {label}
            <span className={styles.dots} aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span className={styles.dot} key={dot} />
              ))}
            </span>
          </span>
          {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}

      {children && (inline
        ? <span className={styles.details}>{children}</span>
        : <div className={styles.details}>{children}</div>)}
    </RootElement>
  );
}
