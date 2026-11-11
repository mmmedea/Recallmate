'use client';

import { useState } from 'react';
import { Download, FileText, Loader2, File, Printer } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Format = 'pdf' | 'docx';

export function ReviewerMakerDialog({ 
  documentId, 
  isOpen, 
  onClose 
}: { 
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  
  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    setGeneratedPath(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch('/api/jobs/generate-reviewer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          documentIds: [documentId],
          format
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate reviewer');
      }

      setGeneratedPath(data.storagePath);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedPath) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('reviewers')
        .createSignedUrl(generatedPath, 60);
        
      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Create Reviewer
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        {!generatedPath ? (
          <>
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Source</label>
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  This document
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Format</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input 
                      type="radio" 
                      name="format" 
                      value="pdf" 
                      checked={format === 'pdf'} 
                      onChange={() => setFormat('pdf')}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <FileText className="w-5 h-5 text-red-500" />
                    <span>PDF</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input 
                      type="radio" 
                      name="format" 
                      value="docx" 
                      checked={format === 'docx'} 
                      onChange={() => setFormat('docx')}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <File className="w-5 h-5 text-blue-500" />
                    <span>Word (.docx)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button 
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  'Generate Reviewer'
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Reviewer Ready!</h3>
            <p className="text-sm text-slate-500 mb-8">
              Your exam-ready reviewer has been generated and securely stored.
            </p>
            
            <div className="flex gap-3 justify-center">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                Close
              </button>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Download className="w-4 h-4" />
                Download {format.toUpperCase()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

