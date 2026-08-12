"use client";

import React from "react";

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight LaTeX Math & Text Renderer
 * Supports inline math \( ... \) or $ ... $ and block math \[ ... \] or $$ ... $$
 */
export default function MathRenderer({ content, className = "" }: MathRendererProps) {
  if (!content) return null;

  // Simple regex parser for LaTeX expressions in AI responses
  const renderFormattedText = (text: string) => {
    // Split text by inline/block math delimiters
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g);

    return parts.map((part, index) => {
      // Block math $$ ... $$ or \[ ... \]
      if ((part.startsWith("$$") && part.endsWith("$$")) || (part.startsWith("\\[") && part.endsWith("\\]"))) {
        const math = part.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, "").trim();
        return (
          <div
            key={index}
            className="my-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/40 border-l-4 border-indigo-500 rounded-r-xl font-mono text-sm overflow-x-auto text-indigo-900 dark:text-indigo-200"
          >
            {math}
          </div>
        );
      }

      // Inline math \( ... \)
      if (part.startsWith("\\(") && part.endsWith("\\)")) {
        const math = part.replace(/^\\\(|\\\)$/g, "").trim();
        return (
          <span
            key={index}
            className="px-1.5 py-0.5 mx-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
          >
            {math}
          </span>
        );
      }

      // Regular text with markdown formatting (e.g. **bold**)
      const renderMarkdownFormatting = (str: string) => {
        const subParts = str.split(/(\*\*[\s\S]*?\*\*)/g);
        return subParts.map((sub, sIdx) => {
          if (sub.startsWith("**") && sub.endsWith("**") && sub.length > 4) {
            return (
              <strong key={sIdx} className="font-bold text-slate-900 dark:text-white">
                {sub.slice(2, -2)}
              </strong>
            );
          }
          return sub;
        });
      };

      return <span key={index}>{renderMarkdownFormatting(part)}</span>;
    });
  };

  return <div className={className}>{renderFormattedText(content)}</div>;
}
