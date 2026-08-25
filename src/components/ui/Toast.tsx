"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

const ToastCtx = createContext<{ toast: (message: string, tone?: Toast["tone"]) => void }>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="card flex items-center gap-3 px-4 py-3 text-sm font-medium shadow-pop"
          >
            {t.tone === "success" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
            {t.tone === "error" && <XCircle className="h-5 w-5 shrink-0 text-rose-500" />}
            {t.tone === "info" && <Info className="h-5 w-5 shrink-0 text-brand-500" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
