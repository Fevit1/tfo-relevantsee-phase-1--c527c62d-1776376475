'use client'

import { useEffect, useState } from 'react'

export function BrandScoreWidget({ score, scoringData, loading, error, onScore, onRetry }) {
  const [mounted, setMounted] = useState(false)
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Animate bar fill after mount and when score changes
  useEffect(() => {
    if (mounted && score !== null && score !== undefined) {
      const timer = setTimeout(() => {
        setBarWidth(score)
      }, 50)
      return () => clearTimeout(timer)
    } else {
      setBarWidth(0)
    }
  }, [mounted, score])

  const hasScore = score !== null && score !== undefined

  // Color logic: green >=80, yellow 50-79, red <50
  const scoreColor = !hasScore
    ? 'text-gray-400'
    : score >= 80
    ? 'text-emerald-400'
    : score >= 50
    ? 'text-amber-400'
    : 'text-red-400'

  const borderColor = !hasScore
    ? 'border-gray-800'
    : score >= 80
    ? 'border-emerald-800'
    : score >= 50
    ? 'border-amber-800'
    : 'border-red-800'

  const bgColor = !hasScore
    ? 'bg-gray-900'
    : score >= 80
    ? 'bg-emerald-950/30'
    : score >= 50
    ? 'bg-amber-950/30'
    : 'bg-red-950/30'

  const barColor = !hasScore
    ? 'bg-gray-700'
    : score >= 80
    ? 'bg-emerald-500'
    : score >= 50
    ? 'bg-amber-500'
    : 'bg-red-500'

  const fadeClass = mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5 transition-all duration-300 ease-out ${fadeClass} motion-reduce:transition-none motion-reduce:transform-none`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-300">Brand Compliance Score</h3>
            <p className="text-xs text-gray-500 mt-0.5">85+ required to submit for approval</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="h-9 w-16 bg-gray-800 rounded animate-pulse" />
            <p className="text-xs text-gray-500 animate-pulse">Scoring…</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-violet-400 animate-spin shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="text-xs text-gray-400">
              Running brand compliance checks…
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={0}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Brand compliance score loading"
            className="h-2 bg-gray-800 rounded-full overflow-hidden"
          >
            <div className="h-full bg-violet-700/60 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────
  if (error) {
    return (
      <div
        className={`rounded-xl border border-red-900/60 bg-red-950/20 p-4 sm:p-5 transition-all duration-300 ease-out ${fadeClass} motion-reduce:transition-none motion-reduce:transform-none`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-300">Brand Compliance Score</h3>
            <p className="text-xs text-gray-500 mt-0.5">85+ required to submit for approval</p>
          </div>
          <div
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-900/30 shrink-0"
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-red-900/40">
          <p className="text-xs text-red-400 font-medium">Score unavailable</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {typeof error === 'string' ? error : 'The scoring service encountered an error. Please try again.'}
          </p>
          {(onRetry || onScore) && (
            <button
              onClick={onRetry || onScore}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded transition-colors duration-150"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Retry scoring
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── No score yet (neutral placeholder) ──────────────────────
  if (!hasScore) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5 transition-all duration-300 ease-out ${fadeClass} motion-reduce:transition-none motion-reduce:transform-none`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-300">Brand Compliance Score</h3>
            <p className="text-xs text-gray-500 mt-0.5">85+ required to submit for approval</p>
          </div>
          <span className="text-3xl font-bold tabular-nums text-gray-600 shrink-0" aria-label="No score yet">—</span>
        </div>

        {/* Empty progress bar */}
        <div className="mt-4">
          <div
            role="progressbar"
            aria-valuenow={0}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Brand compliance score: not yet scored"
            className="h-2 bg-gray-800 rounded-full overflow-hidden"
          >
            <div className="h-full w-0 bg-gray-700 rounded-full" />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Generate content, then run the scorer to check brand compliance before submitting.
          </p>
          {onScore && (
            <button
              onClick={onScore}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded transition-colors duration-150"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Run brand scorer
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Scored state ─────────────────────────────────────────────
  return (
    <div
      className={`rounded-xl border ${borderColor} ${bgColor} p-4 sm:p-5 transition-all duration-300 ease-out ${fadeClass} motion-reduce:transition-none motion-reduce:transform-none`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-300">Brand Compliance Score</h3>
          <p className="text-xs text-gray-500 mt-0.5">85+ required to submit for approval</p>
        </div>
        <div className="text-right shrink-0">
          <span
            className={`text-3xl font-bold tabular-nums ${scoreColor}`}
            aria-label={`Brand compliance score: ${score} out of 100`}
          >
            {score}
          </span>
          <p className="text-xs text-gray-400 mt-0.5">/ 100</p>
        </div>
      </div>

      {/* Animated progress bar */}
      <div className="mt-3">
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label={`Brand compliance score: ${score} out of 100`}
          className="h-2.5 bg-gray-800 rounded-full overflow-hidden"
        >
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out motion-reduce:transition-none`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-600">0</span>
          <span className="text-xs text-gray-600">85</span>
          <span className="text-xs text-gray-600">100</span>
        </div>
      </div>

      {/* Score breakdown */}
      {scoringData && (
        <div className="mt-4 pt-4 border-t border-gray-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-gray-400 min-w-0 truncate">Phase 1 — Banned phrase check</span>
            <span className={`shrink-0 font-medium ${scoringData.phase1?.passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {scoringData.phase1?.passed
                ? '✓ Passed'
                : `✗ ${scoringData.phase1?.banned_phrase_hits?.length || 0} hit(s)`}
            </span>
          </div>
          {scoringData.phase2?.score !== null && scoringData.phase2?.score !== undefined && (
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-gray-400 min-w-0 truncate">Phase 2 — Tone &amp; style alignment</span>
              <span className="text-white font-medium shrink-0">{scoringData.phase2?.score}/100</span>
            </div>
          )}
          {(scoringData.phase1?.banned_phrase_hits?.length ?? 0) > 0 && (
            <div className="mt-2 p-2.5 bg-red-950/30 rounded-lg border border-red-900/50">
              <p className="text-xs text-red-400 font-medium">Banned phrases detected:</p>
              <p className="text-xs text-red-300 mt-0.5 break-words">
                {scoringData.phase1.banned_phrase_hits.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Gate indicator */}
      <div className="mt-3">
        {score >= 85 ? (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Ready to submit
          </p>
        ) : (
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            Score must be ≥ 85 to submit (need {85 - score} more points)
          </p>
        )}
      </div>

      {/* Re-score option */}
      {onScore && (
        <button
          onClick={onScore}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded transition-colors duration-150"
        >
          <svg
            className="w-3 h-3 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Re-score
        </button>
      )}
    </div>
  )
}