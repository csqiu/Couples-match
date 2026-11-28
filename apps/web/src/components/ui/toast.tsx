'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = next.current++;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-2xl bg-text px-4 py-3 text-sm text-bg shadow-glass"
          >
            <span>{t.message}</span>
            {t.action ? (
              <button
                className="min-h-9 rounded-md px-2 font-semibold underline underline-offset-2"
                onClick={() => {
                  t.action!.onClick();
                  setItems((xs) => xs.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
