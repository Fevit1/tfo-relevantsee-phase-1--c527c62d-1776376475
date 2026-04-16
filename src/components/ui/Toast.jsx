'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    bg: 'bg-green-900/90',
    border: 'border-green-700',
    icon: (
      <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    titleColor: 'text-green-100',
    messageColor: 'text-green-300',
    role: 'status',
    ariaLive: 'polite',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-700',
    icon: (
      <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    titleColor: 'text-red-100',
    messageColor: 'text-red-300',
    role: 'alert',
    ariaLive: 'assertive',
  },
  warning: {
    bg: 'bg-yellow-900/90',
    border: 'border-yellow-700',
    icon: (
      <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    titleColor: 'text-yellow-100',
    messageColor: 'text-yellow-300',
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-700',
    icon: (
      <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    titleColor: 'text-blue-100',
    messageColor: 'text-blue-300',
    role: 'status',
    ariaLive: 'polite',
  },
};

const AUTO_DISMISS_MS = 5000;

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);
  const variant = VARIANTS[toast.variant] || VARIANTS.info;

  const dismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [leaving, onDismiss, toast.id]);

  useEffect(() => {
    // Trigger enter animation on next paint
    const enterTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss timer
    timerRef.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entrance: slide in from right + fade in
  // Exit: slide out to right + fade out
  // Respects prefers-reduced-motion via globals.css
  const motionClasses = visible && !leaving
    ? 'opacity-100 translate-x-0'
    : leaving
      ? 'opacity-0 translate-x-8'
      : 'opacity-0 translate-x-8';

  return (
    <div
      role={variant.role}
      aria-live={variant.ariaLive}
      aria-atomic="true"
      className={[
        'flex items-start gap-3 w-full max-w-sm px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
        'transition-all duration-300 ease-in-out',
        'motion-reduce:transition-none',
        variant.bg,
        variant.border,
        motionClasses,
      ].join(' ')}
    >
      <div className="mt-0.5" aria-hidden="true">{variant.icon}</div>

      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-semibold leading-tight ${variant.titleColor}`}>
            {toast.title}
          </p>
        )}
        {toast.message && (
          <p className={`text-sm leading-snug mt-0.5 ${toast.title ? variant.messageColor : variant.titleColor}`}>
            {toast.message}
          </p>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss notification"
        type="button"
        className={[
          'flex-shrink-0 mt-0.5 rounded p-0.5',
          'text-gray-400 hover:text-white',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          'motion-reduce:transition-none',
        ].join(' ')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, variant = 'info' }) => {
    const id = ++idCounter;
    setToasts((prev) => {
      // Cap at 5 toasts — remove oldest if needed
      const next = prev.length >= 5 ? prev.slice(1) : prev;
      return [...next, { id, title, message, variant }];
    });
    return id;
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      if (typeof message === 'string') {
        return addToast({ message, variant: opts.variant || 'info', title: opts.title });
      }
      return addToast(message);
    },
    [addToast]
  );

  toast.success = useCallback(
    (message, opts = {}) => addToast({ message, variant: 'success', ...opts }),
    [addToast]
  );

  toast.error = useCallback(
    (message, opts = {}) => addToast({ message, variant: 'error', ...opts }),
    [addToast]
  );

  toast.warning = useCallback(
    (message, opts = {}) => addToast({ message, variant: 'warning', ...opts }),
    [addToast]
  );

  toast.info = useCallback(
    (message, opts = {}) => addToast({ message, variant: 'info', ...opts }),
    [addToast]
  );

  toast.dismiss = dismiss;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export default ToastProvider;