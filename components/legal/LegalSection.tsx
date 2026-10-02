import type { ReactNode } from "react";

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  const headingId = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-xl font-semibold text-slate-950 dark:text-white">
        {heading}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
