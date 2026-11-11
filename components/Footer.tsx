import { RECALLMATE_CONTACT_EMAIL } from "@/lib/legal-contact";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-slate-600 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} RecallMate</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a className="hover:text-slate-950 dark:hover:text-white" href={`mailto:${RECALLMATE_CONTACT_EMAIL}`}>Contact</a>
        </nav>
      </div>
    </footer>
  );
}
