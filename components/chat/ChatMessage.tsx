import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { TutorStatus, VerificationIndicator, CitationBadge } from "./TutorIndicators";
import { MedeaStreamPart } from "@/lib/ai/tutor/stream";

export function ChatMessage({ 
  message, 
  isLast, 
  isLoading,
}: { 
  message: any; 
  isLast: boolean; 
  isLoading: boolean;
}) {
  const isAssistant = message.role === "assistant";
  
  // Extract annotations
  const annotations = ((message.metadata?.annotations || message.annotations) as MedeaStreamPart[]) || [];\n  const messageText = Array.isArray(message.parts)\n    ? message.parts.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('')\n    : message.content || '';
  
  const statusAnnotations = annotations.filter(a => a.type === "data-tutor-status");
  const latestStatus = statusAnnotations.length > 0 ? statusAnnotations[statusAnnotations.length - 1].data : null;
  
  const verificationPart = annotations.find(a => a.type === "data-verification");
  const verificationData = verificationPart?.data;
  
  const citations = annotations.filter(a => a.type === "data-citation").map(a => a.data);

  return (
    <div className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`flex flex-col gap-2 max-w-[85%] ${isAssistant ? "items-start" : "items-end"}`}>
        
        {/* Tutor Status (Only show latest, hide if finalizing or completed) */}
        {isAssistant && isLast && isLoading && latestStatus && latestStatus.phase !== "finalizing" && (
          <TutorStatus phase={latestStatus.phase as any} label={latestStatus.label} />
        )}
        
        <div className={`
          relative px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm break-words
          ${isAssistant 
            ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-tl-sm text-zinc-800 dark:text-zinc-200" 
            : "bg-blue-600 text-white rounded-tr-sm"}
        `}>
          {messageText ? (
             <div className={`prose dark:prose-invert max-w-none prose-sm 
                prose-p:leading-relaxed prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-200 dark:prose-pre:border-zinc-700
                ${isAssistant ? "" : "prose-p:text-white prose-a:text-blue-100 prose-strong:text-white"}
             `}>
               <ReactMarkdown 
                 remarkPlugins={[remarkMath]} 
                 rehypePlugins={[rehypeKatex]}
                 components={{
                   // Disable arbitrary HTML rendering by default in ReactMarkdown
                   // Ensure standard pedagogical tags render cleanly
                   h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-4 mb-2 text-zinc-900 dark:text-zinc-100" {...props} />,
                   ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                   ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                   li: ({node, ...props}) => <li className="pl-1" {...props} />,
                   code: ({node, inline, className, children, ...props}: any) => {
                     if (inline) return <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-800 dark:text-zinc-200 break-words" {...props}>{children}</code>;
                     return <code className={className} {...props}>{children}</code>;
                   },
                   pre: ({node, children, ...props}) => <div className="overflow-x-auto w-full my-4 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"><pre className="p-4 !border-0 !m-0 !bg-transparent w-max min-w-full" {...props}>{children}</pre></div>,
                   table: ({node, ...props}) => <div className="overflow-x-auto w-full my-4"><table className="min-w-full text-left text-sm" {...props} /></div>
                 }}
               >
                 {messageText}
               </ReactMarkdown>
             </div>
          ) : (
             isAssistant && isLoading && (
               <div className="flex gap-1 items-center h-5">
                 <span className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                 <span className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                 <span className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
               </div>
             )
          )}
          
          {/* Citations Footer */}
          {isAssistant && citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2">
               {citations.map((cite: any, i) => (
                 <CitationBadge key={i} label={cite.label} page={cite.page} />
               ))}
            </div>
          )}
        </div>
        
        {/* Verification Indicator (rendered below the message bubble) */}
        {isAssistant && verificationData && (
          <VerificationIndicator verified={verificationData.verified} checks={verificationData.checks} />
        )}

      </div>
    </div>
  );
}
