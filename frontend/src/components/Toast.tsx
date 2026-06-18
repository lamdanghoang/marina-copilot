"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

const ToastContext = createContext<(message: string, type?: Toast["type"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-slide-up rounded-lg px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md border ${
              t.type === "success" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" :
              t.type === "error" ? "bg-red-500/20 border-red-500/40 text-red-300" :
              "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
            }`}
          >
            {t.type === "success" && "✅ "}{t.type === "error" && "❌ "}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
