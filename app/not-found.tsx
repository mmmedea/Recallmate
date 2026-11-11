import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <h2 className="text-2xl font-bold mb-4">Not Found</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">Could not find requested resource</p>
      <Link href="/" className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
        Return Home
      </Link>
    </div>
  );
}
