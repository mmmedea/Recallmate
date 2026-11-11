"use client"

import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, Check, Sparkles } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isSuccess = variant === "success"
        const isError = variant === "destructive"
        return (
          <Toast key={id} variant={variant} className={isSuccess ? "rm-toast-success" : isError ? "rm-toast-error" : "rm-toast-default"} {...props}>
            {(isSuccess || isError) && (
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70 dark:bg-white/10">
                {isSuccess ? (
                  <>
                    <Sparkles className="rm-reveal-spark absolute -top-1 right-0 h-3.5 w-3.5 text-violet-500" />
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </>
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                )}
              </span>
            )}
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
