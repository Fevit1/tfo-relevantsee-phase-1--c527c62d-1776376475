'use client'

import { useEffect, useRef, useId } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function Modal({ open, onClose, title, children, size = 'md', 'aria-labelledby': ariaLabelledBy }) {
  const overlayRef = useRef(null)
  const dialogRef = useRef(null)
  const generatedTitleId = useId()
  const titleId = ariaLabelledBy || (title ? generatedTitleId : undefined)

  // Escape key + body scroll lock
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // Focus trap: focus first focusable element on open
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (first) {
      // Small delay to ensure the element is fully rendered/animated
      const timer = setTimeout(() => first.focus(), 50)
      return () => clearTimeout(timer)
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab' || !focusable.length) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [open])

  // Tab trap in a separate effect so it always applies when open
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const handleTab = (e) => {
      if (e.key !== 'Tab') return
      const focusable = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [open])

  if (!open) return null

  const maxWidth = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] || 'max-w-lg'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70
                 animate-[fadeIn_200ms_ease_both]
                 motion-reduce:animate-none"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`
          w-full ${maxWidth}
          bg-gray-900 border border-gray-800 rounded-xl shadow-2xl
          animate-[slideUp_200ms_ease_both]
          motion-reduce:animate-none
          focus:outline-none
        `}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2
              id={titleId}
              className="text-lg font-semibold text-white"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="
                p-1.5 rounded-md
                text-gray-400 hover:text-white
                hover:bg-gray-700
                transition-colors duration-150
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                focus-visible:ring-offset-gray-900
              "
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>

      {/* Keyframe definitions injected via a style tag — Tailwind doesn't include custom keyframes by default */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes fadeIn  { from {} to {} }
          @keyframes slideUp { from {} to {} }
        }
      `}</style>
    </div>
  )
}