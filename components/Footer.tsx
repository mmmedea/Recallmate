"use client";

import Link from "next/link";

const links = [
  { label: "Privacy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Cookie Settings", href: "/cookie-settings" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Help", href: "/help" },
  { label: "Contact", href: "/help#contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#a78bfa]/20 bg-[#08070d]/90">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-fredoka bg-gradient-to-r from-[#f5efff] via-[#c4a7ff] to-[#ff7185] bg-clip-text text-xl font-semibold text-transparent">RecallMate</Link>
          <p className="font-nunito text-sm text-[#9f96ad]">Learn it. Recall it. Remember it.</p>
        </div>
        <nav aria-label="Footer resources" className="flex flex-wrap gap-x-6 gap-y-3">
          {links.map((link) => <Link key={link.href} href={link.href} className="font-quicksand text-sm font-semibold text-[#c8bdd9] transition-colors hover:text-[#ff8293]">{link.label}</Link>)}
        </nav>
        <p className="font-nunito border-t border-white/10 pt-5 text-xs leading-relaxed text-[#82798f]">© {new Date().getFullYear()} RecallMate. All rights reserved. Study materials and AI-generated explanations should be checked against your course requirements and trusted sources.</p>
      </div>
    </footer>
  );
}
