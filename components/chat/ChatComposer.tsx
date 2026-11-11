import { useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";

type ChatComposerProps = {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
};

const SUGGESTED_PROMPTS = [
  "Explain this",
  "Solve it",
  "Give me a hint",
  "Quiz me"
];

export function ChatComposer({ input, handleInputChange, handleSubmit, isLoading, stop }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        // Trigger submit
        const form = e.currentTarget.form;
        if (form) form.requestSubmit();
      }
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    const syntheticEvent = {
      preventDefault: () => {},
      target: { value: prompt }
    } as any;
    
    // Quick hack to submit a suggested prompt
    // For a robust implementation, we would use the `append` function from useChat
    // But since we only have `handleInputChange` and `handleSubmit` passed here:
    handleInputChange({ target: { value: prompt } } as any);
    setTimeout(() => {
      if (textareaRef.current?.form) {
        textareaRef.current.form.requestSubmit();
      }
    }, 50);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Suggested Prompts */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={isLoading}
            onClick={() => handleSuggestedPrompt(prompt)}
            className="flex items-center justify-center px-4 min-h-[44px] text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form 
        onSubmit={handleSubmit} 
        className="relative flex items-end w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all overflow-hidden"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          placeholder="Ask Medea a question..."
          className="w-full max-h-[200px] min-h-[56px] py-4 pl-4 pr-12 bg-transparent border-0 focus:ring-0 resize-none text-base outline-none dark:text-white"
          rows={1}
          disabled={isLoading}
          aria-label="Chat input"
        />
        
        <div className="absolute right-2 bottom-2">
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Stop generating"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
