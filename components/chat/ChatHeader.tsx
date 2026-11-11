import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export function ChatHeader({ documentTitle }: { documentTitle: string }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Study Hub</span>
        </Link>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        <span>Chatting with {documentTitle}</span>
      </div>
    </header>
  );
}
