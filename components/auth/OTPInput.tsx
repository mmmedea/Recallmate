"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  "aria-describedby"?: string;
}

// Six visual fields that behave as one logical accessible control.
// - role="group" + aria-label on wrapper = one semantic unit for screen readers
// - Single status announcement per error/success (via aria-describedby)
// - Auto-advance, backspace navigation, paste-from-clipboard supported
export const OTPInput = forwardRef<{ focus: () => void }, OTPInputProps>(
  function OTPInput(
    {
      value,
      onChange,
      length = 6,
      disabled = false,
      hasError = false,
      "aria-describedby": ariaDescribedBy,
    },
    ref
  ) {
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const digits = value.padEnd(length, "").split("").slice(0, length);

    useImperativeHandle(ref, () => ({
      focus: () => inputsRef.current[0]?.focus(),
    }));

    const focusIndex = (index: number) => {
      inputsRef.current[Math.max(0, Math.min(length - 1, index))]?.focus();
    };

    const handleChange = useCallback(
      (index: number, char: string) => {
        const sanitized = char.replace(/\D/g, "").slice(0, 1);
        if (!sanitized) return;
        const next = digits.map((d, i) => (i === index ? sanitized : d)).join("").slice(0, length);
        onChange(next.trimEnd());
        if (index < length - 1) focusIndex(index + 1);
      },
      [digits, length, onChange]
    );

    const handleKeyDown = useCallback(
      (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          if (digits[index]) {
            const next = digits.map((d, i) => (i === index ? "" : d)).join("");
            onChange(next.trimEnd());
          } else {
            focusIndex(index - 1);
          }
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          focusIndex(index - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          focusIndex(index + 1);
        }
      },
      [digits, onChange]
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        onChange(pasted);
        focusIndex(Math.min(pasted.length, length - 1));
      },
      [length, onChange]
    );

    return (
      <div
        role="group"
        aria-label="Verification code, 6 digits"
        aria-describedby={ariaDescribedBy}
        className="flex items-center gap-2 justify-center"
        onPaste={handlePaste}
      >
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputsRef.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[index] || ""}
            disabled={disabled}
            autoComplete="one-time-code"
            aria-label={`Digit ${index + 1} of ${length}`}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            className={cn(
              "h-12 w-10 rounded-lg border text-center text-lg font-bold tabular-nums",
              "bg-white dark:bg-slate-900",
              "transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              hasError
                ? "border-rose-400 dark:border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white",
              digits[index] && !hasError && "border-indigo-400 dark:border-indigo-500"
            )}
          />
        ))}
      </div>
    );
  }
);
