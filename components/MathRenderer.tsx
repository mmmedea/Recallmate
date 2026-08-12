"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Advanced LaTeX Math & Markdown Renderer
 * Uses react-markdown with remark-math and rehype-katex plugins.
 */
export default function MathRenderer({ content, className = "" }: MathRendererProps) {
  if (!content) return null;

  return (
    <div className={`text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-indigo-900 dark:text-indigo-100" {...props}/>,
          h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2 text-indigo-900 dark:text-indigo-100" {...props}/>,
          h3: ({node, ...props}) => <h3 className="text-md font-bold mt-3 mb-2 text-indigo-900 dark:text-indigo-100" {...props}/>,
          p: ({node, ...props}) => <p className="mb-2 leading-relaxed last:mb-0" {...props}/>,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props}/>,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props}/>,
          li: ({node, ...props}) => <li {...props}/>,
          strong: ({node, ...props}) => <strong className="font-bold text-indigo-900 dark:text-indigo-200" {...props}/>,
          a: ({node, ...props}) => <a className="text-indigo-600 hover:underline dark:text-indigo-400" {...props}/>,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 my-2 italic text-slate-600 dark:text-slate-300" {...props}/>,
          code: ({node, inline, ...props}: any) => 
            inline ? 
              <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-xs text-indigo-600 dark:text-indigo-400" {...props}/> : 
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs my-2"><code {...props}/></pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
