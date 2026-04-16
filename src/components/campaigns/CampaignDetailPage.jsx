'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BrandScoreBadge } from '@/components/ui/BrandScoreBadge'
import { ChannelChips } from '@/components/ui/ChannelChips'
import { Modal } from '@/components/ui/Modal'
import { EmailContentPanel } from '@/components/campaigns/EmailContentPanel'
import { SocialContentPanel } from '@/components/campaigns/SocialContentPanel'
import { AdsContentPanel } from '@/components/campaigns/AdsContentPanel'
import { BrandScoreWidget } from '@/components/campaigns/BrandScoreWidget'
import { useAuth } from '@/components/AuthProvider'
import {
  getCampaign,
  approveCampaign,
  rejectCampaign,
  reopenCampaign,
  scoreCampaign,
  submitCampaign,
  formatMockMetrics,
} from '@/lib/api'

// ============================================================
// Toast System
// ============================================================

function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="alert"
          aria-live="polite"
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto transition-all duration-200 ${
            toast.type === 'success'
              ? 'bg-gray-900 border-emerald-700 text-emerald-300'
              : toast.type === 'warning'
              ? 'bg-gray-900 border-amber-700 text-amber-300'
              : 'bg-gray-900 border-red-700 text-red-300'
          }`}
        >
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            aria-label="Dismiss notification"
            className="text-gray-500 hover:text-white transition-colors duration-150 flex-shrink-0 mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Spinner
// ============================================================

function Spinner({ className = 'w-4 h-4' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ============================================================
// Copy-to-clipboard button
// ============================================================

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard API not available
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : `Copy ${label}`}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.637c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}

// ============================================================
// Loading Skeleton
// ============================================================

function CampaignDetailSkeleton() {
  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto animate-pulse">
          {/* Breadcrumb + title */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-800 rounded" />
            <div className="h-8 w-48 sm:w-72 bg-gray-800 rounded" />
            <div className="flex gap-2 mt-2 flex-wrap">
              <div className="h-5 w-16 bg-gray-800 rounded-full" />
              <div className="h-5 w-12 bg-gray-800 rounded-full" />
              <div className="h-5 w-20 bg-gray-800 rounded-full" />
            </div>
          </div>
          {/* Action bar */}
          <div className="h-14 bg-gray-900 border border-gray-800 rounded-xl" />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main */}
            <div className="xl:col-span-2 space-y-6">
              <div className="h-32 bg-gray-900 border border-gray-800 rounded-xl" />
              <div className="h-10 bg-gray-900 border border-gray-800 rounded-xl" />
              <div className="h-64 bg-gray-900 border border-gray-800 rounded-xl" />
              <div className="h-36 bg-gray-900 border border-gray-800 rounded-xl" />
            </div>
            {/* Sidebar */}
            <div className="space-y-4">
              <div className="h-40 bg-gray-900 border border-gray-800 rounded-xl" />
              <div className="h-48 bg-gray-900 border border-gray-800 rounded-xl" />
              <div className="h-48 bg-gray-900 border border-gray-800 rounded-xl" />
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

// ============================================================
// Main Component
// ============================================================

export function CampaignDetailPage({ campaignId }) {
  const router = useRouter()
  const { isAdmin, role } = useAuth()
  const { toasts, addToast, removeToast } = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('email')
  const [actionLoading, setActionLoading] = useState(false)

  // Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [reopenModalOpen, setReopenModalOpen] = useState(false)
  const [approveNotes, setApproveNotes] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [rejectNotesError, setRejectNotesError] = useState('')
  const [overrideNotesError, setOverrideNotesError] = useState('')

  // Score state
  const [brandScore, setBrandScore] = useState(null)
  const [scoringData, setScoringData] = useState(null)
  const [scoreLoading, setScoreLoading] = useState(false)

  const loadCampaign = useCallback(async () => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const result = await getCampaign(campaignId)
      setData(result)
      setBrandScore(result.campaign?.brand_score ?? null)
      const lastScore = result.score_log?.[0]
      if (lastScore) {
        setScoringData({
          brand_score: lastScore.final_score,
          phase1: { passed: lastScore.phase1_passed, banned_phrase_hits: lastScore.phase1_banned_phrase_hits },
          phase2: { score: lastScore.phase2_claude_score },
        })
      }
      const channels = result.campaign?.channels || []
      if (channels.length > 0) setActiveTab(channels[0])
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true)
      } else if (err.status === 401 || err.status === 403) {
        setError('You do not have permission to view this campaign.')
      } else {
        setError(err.message || 'Failed to load campaign. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { loadCampaign() }, [loadCampaign])

  const handleActionError = useCallback((err, defaultMessage) => {
    if (err.status === 401 || err.status === 403) {
      addToast('Insufficient permissions', 'error')
    } else if (err.status === 429) {
      addToast('Too many requests. Please wait a moment and try again.', 'error')
    } else {
      addToast(err.message || defaultMessage, 'error')
    }
  }, [addToast])

  const handleApprove = async (override = false) => {
    if (override && !overrideNotes.trim()) {
      setOverrideNotesError('Override reason is required')
      return
    }
    setActionLoading(true)
    try {
      const notes = override ? overrideNotes : approveNotes
      await approveCampaign(campaignId, { notes, override_flag: override })
      setApproveModalOpen(false)
      setOverrideModalOpen(false)
      setApproveNotes('')
      setOverrideNotes('')
      setOverrideNotesError('')
      addToast(override ? 'Campaign approved with override' : 'Campaign approved', 'success')
      await loadCampaign()
    } catch (err) {
      handleActionError(err, 'Failed to approve campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      setRejectNotesError('Rejection notes are required')
      return
    }
    setActionLoading(true)
    try {
      await rejectCampaign(campaignId, { notes: rejectNotes })
      setRejectModalOpen(false)
      setRejectNotes('')
      setRejectNotesError('')
      addToast('Campaign rejected', 'error')
      await loadCampaign()
    } catch (err) {
      handleActionError(err, 'Failed to reject campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopen = async () => {
    setActionLoading(true)
    try {
      await reopenCampaign(campaignId)
      setReopenModalOpen(false)
      addToast('Campaign reopened for revision', 'success')
      await loadCampaign()
    } catch (err) {
      handleActionError(err, 'Failed to reopen campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleScore = async () => {
    setScoreLoading(true)
    try {
      const result = await scoreCampaign({ campaign_id: campaignId })
      setBrandScore(result.brand_score)
      setScoringData(result)
      addToast(`Brand score: ${result.brand_score}/100`, 'success')
      await loadCampaign()
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        addToast('Insufficient permissions', 'error')
      } else if (err.status === 429) {
        addToast('Scoring rate limit reached. Please wait before trying again.', 'warning')
      } else {
        addToast(err.message || 'Scoring failed. Please try again.', 'error')
      }
    } finally {
      setScoreLoading(false)
    }
  }

  const handleSubmit = async () => {
    setActionLoading(true)
    try {
      await submitCampaign(campaignId)
      addToast('Campaign submitted for approval', 'success')
      await loadCampaign()
    } catch (err) {
      handleActionError(err, 'Submission failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <CampaignDetailSkeleton />

  if (notFound) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Campaign Not Found</h2>
              <p className="text-sm text-gray-400 mb-6">
                This campaign doesn't exist or you don't have access to it.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (error || !data) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="bg-gray-900 border border-red-900/50 rounded-xl p-8 text-center">
              <p className="text-red-400 mb-3">{error || 'Failed to load campaign'}</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={loadCampaign}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                >
                  Try Again
                </button>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  const { campaign, status_log, approval_log, score_log, mock_metrics } = data
  const channels = campaign.channels || []
  const gc = campaign.generated_content || {}
  const hasContent = Object.keys(gc).some(k => k !== '_schema_version')
  const mockMetricsFormatted = formatMockMetrics(mock_metrics)
  const currentScore = brandScore ?? campaign.brand_score
  const canSubmit = (currentScore ?? 0) >= 85
  const isDraft = campaign.status === 'draft'
  const isRejected = campaign.status === 'rejected'
  const tabPanelId = (ch) => `tabpanel-${ch}`
  const tabId = (ch) => `tab-${ch}`

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-6">
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/dashboard"
                  className="text-gray-500 hover:text-gray-300 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                >
                  Campaigns
                </Link>
                <span className="text-gray-600">/</span>
                <span className="text-gray-400 text-sm truncate max-w-[200px] sm:max-w-xs">{campaign.name}</span>
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words">{campaign.name}</h1>

              {/* Meta chips */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={campaign.status} />
                <BrandScoreBadge score={currentScore} />
                <ChannelChips channels={channels} />
                <span className="text-xs text-gray-500">v{campaign.campaign_version}</span>
              </div>
            </div>

            {/* Created at */}
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-500">Created {formatDate(campaign.created_at)}</p>
            </div>
          </div>

          {/* ── Status-aware action panel ── */}
          <ActionPanel
            campaign={campaign}
            isAdmin={isAdmin}
            role={role}
            canSubmit={canSubmit}
            brandScore={currentScore}
            actionLoading={actionLoading}
            onApprove={() => setApproveModalOpen(true)}
            onReject={() => { setRejectNotes(''); setRejectNotesError(''); setRejectModalOpen(true) }}
            onOverride={() => { setOverrideNotes(''); setOverrideNotesError(''); setOverrideModalOpen(true) }}
            onReopen={() => setReopenModalOpen(true)}
            onSubmit={handleSubmit}
            onScore={handleScore}
            scoreLoading={scoreLoading}
          />

          {/* ── Rejection notes banner ── */}
          {isRejected && campaign.approval_notes && (
            <div className="rounded-xl border border-red-800 bg-red-950/30 p-4" role="alert">
              <p className="text-sm font-semibold text-red-300 mb-1">Rejection Notes</p>
              <p className="text-sm text-red-200">{campaign.approval_notes}</p>
            </div>
          )}

          {/* ── Main layout grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
            {/* ── Main content column ── */}
            <div className="xl:col-span-2 space-y-5 sm:space-y-6">
              {/* Brief */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-gray-300 mb-2">Campaign Brief</h2>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{campaign.brief}</p>
              </div>

              {/* Generated content panels with ARIA tab interface */}
              {hasContent && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {/* Tab list */}
                  <div
                    role="tablist"
                    aria-label="Content channels"
                    className="border-b border-gray-800 px-4 sm:px-5 py-3 flex gap-1 overflow-x-auto scrollbar-thin"
                  >
                    {channels.filter(ch => gc[ch]).map(ch => (
                      <button
                        key={ch}
                        id={tabId(ch)}
                        role="tab"
                        aria-selected={activeTab === ch}
                        aria-controls={tabPanelId(ch)}
                        onClick={() => setActiveTab(ch)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          activeTab === ch
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>

                  {/* Tab panels */}
                  <div className="p-4 sm:p-5">
                    {channels.filter(ch => gc[ch]).map(ch => (
                      <div
                        key={ch}
                        id={tabPanelId(ch)}
                        role="tabpanel"
                        aria-labelledby={tabId(ch)}
                        hidden={activeTab !== ch}
                        tabIndex={0}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                      >
                        {activeTab === ch && (
                          <>
                            {ch === 'email' && <EmailContentPanelWithIframe content={gc.email} />}
                            {ch === 'social' && <SocialContentPanel content={gc.social} />}
                            {ch === 'ads' && <AdsContentPanel content={gc.ads} />}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand score widget — show on draft, visually distinct card */}
              {isDraft && (
                <div className="rounded-xl border border-indigo-900/40 bg-gradient-to-br from-gray-900 via-indigo-950/10 to-gray-900 shadow-sm">
                  <BrandScoreWidget
                    score={currentScore}
                    scoringData={scoringData}
                    loading={scoreLoading}
                    onScore={handleScore}
                  />
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-4">
              {/* Mock metrics */}
              {mock_metrics && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">Performance</h3>
                    <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded border border-gray-700">Demo data</span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="space-y-3 min-w-0">
                      {mockMetricsFormatted.map(m => (
                        <div key={m.label} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500 truncate">{m.label}</span>
                          <span className="text-sm font-semibold text-white tabular-nums flex-shrink-0">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Score history */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Score History</h3>
                {score_log?.length > 0 ? (
                  <div className="space-y-2">
                    {score_log.map(entry => (
                      <div key={entry.id} className="border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors duration-150">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold tabular-nums ${
                            entry.final_score >= 85
                              ? 'text-emerald-400'
                              : entry.final_score >= 60
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}>
                            {entry.final_score}/100
                          </span>
                          <span className="text-xs text-gray-500">v{entry.campaign_version}</span>
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500 flex items-center gap-2">
                          <span className={entry.phase1_passed ? 'text-emerald-400' : 'text-red-400'}>
                            P1 {entry.phase1_passed ? '✓' : '✗'}
                          </span>
                          {entry.phase2_claude_score !== null && entry.phase2_claude_score !== undefined && (
                            <span>P2: {entry.phase2_claude_score}</span>
                          )}
                        </div>
                        {(entry.phase1_banned_phrase_hits?.length ?? 0) > 0 && (
                          <p className="text-xs text-red-400 mt-1 truncate" title={entry.phase1_banned_phrase_hits.join(', ')}>
                            Hits: {entry.phase1_banned_phrase_hits.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">{formatDate(entry.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No scoring runs yet</p>
                )}
              </div>

              {/* Status timeline */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Status Timeline</h3>
                {status_log?.length > 0 ? (
                  <ol className="space-y-3" aria-label="Campaign status history">
                    {status_log.map((entry, i) => (
                      <li key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full mt-1 ${i === 0 ? 'bg-gray-500' : 'bg-indigo-500'}`} />
                          {i < status_log.length - 1 && (
                            <div className="w-px flex-1 bg-gray-800 mt-1" aria-hidden="true" />
                          )}
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.from_status && (
                              <>
                                <span className="text-xs text-gray-500 capitalize">{entry.from_status}</span>
                                <span className="text-gray-600" aria-hidden="true">→</span>
                              </>
                            )}
                            <span className="text-xs text-white font-medium capitalize">{entry.to_status}</span>
                          </div>
                          {entry.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 break-words">{entry.notes}</p>
                          )}
                          <p className="text-xs text-gray-600 mt-0.5">
                            <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-gray-500">No transitions logged</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Approve modal ── */}
        <Modal
          open={approveModalOpen}
          onClose={() => !actionLoading && setApproveModalOpen(false)}
          title="Approve Campaign"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Approving <strong className="text-white">{campaign.name}</strong>.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="approve-notes" className="block text-sm font-medium text-gray-300">
                Notes (optional)
              </label>
              <textarea
                id="approve-notes"
                value={approveNotes}
                onChange={e => setApproveNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes for the campaign creator..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-none transition-colors duration-150"
              />
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                onClick={() => setApproveModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(false)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {actionLoading && <Spinner />}
                {actionLoading ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Override modal ── */}
        <Modal
          open={overrideModalOpen}
          onClose={() => !actionLoading && setOverrideModalOpen(false)}
          title="Approve with Override"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-950/30 border border-amber-800 p-3" role="alert">
              <p className="text-sm text-amber-300">
                This campaign's brand score ({campaign.brand_score ?? '—'}) is below the 85 threshold.
                Overriding requires a documented reason.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="override-notes" className="block text-sm font-medium text-gray-300">
                Override Reason <span className="text-red-400" aria-hidden="true">*</span>
              </label>
              <textarea
                id="override-notes"
                value={overrideNotes}
                onChange={e => { setOverrideNotes(e.target.value); setOverrideNotesError('') }}
                rows={3}
                aria-required="true"
                aria-describedby={overrideNotesError ? 'override-notes-error' : undefined}
                placeholder="Explain why this campaign should be approved despite the low brand score..."
                className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 resize-none transition-colors duration-150 ${
                  overrideNotesError
                    ? 'border-red-600 focus-visible:ring-red-500'
                    : 'border-gray-700 focus-visible:ring-amber-500'
                }`}
              />
              {overrideNotesError && (
                <p id="override-notes-error" role="alert" className="text-xs text-red-400">{overrideNotesError}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                onClick={() => setOverrideModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                {actionLoading && <Spinner />}
                {actionLoading ? 'Approving…' : 'Approve with Override'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Reject modal ── */}
        <Modal
          open={rejectModalOpen}
          onClose={() => !actionLoading && setRejectModalOpen(false)}
          title="Reject Campaign"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-red-950/30 border border-red-800 p-3" role="alert">
              <p className="text-sm text-red-300">
                This action will reject <strong className="text-white">{campaign.name}</strong> and notify the creator.
                The campaign will need to be reopened and revised before it can be resubmitted.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reject-notes" className="block text-sm font-medium text-gray-300">
                Rejection Notes <span className="text-red-400" aria-hidden="true">*</span>
              </label>
              <textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={e => { setRejectNotes(e.target.value); setRejectNotesError('') }}
                rows={4}
                aria-required="true"
                aria-describedby={rejectNotesError ? 'reject-notes-error' : 'reject-notes-hint'}
                placeholder="Explain what needs to be changed before this campaign can be approved..."
                className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 resize-none transition-colors duration-150 ${
                  rejectNotesError
                    ? 'border-red-600 focus-visible:ring-red-500'
                    : 'border-gray-700 focus-visible:ring-red-500'
                }`}
              />
              {rejectNotesError ? (
                <p id="reject-notes-error" role="alert" className="text-xs text-red-400">{rejectNotesError}</p>
              ) : (
                <p id="reject-notes-hint" className="text-xs text-gray-500">Notes are required for rejection</p>
              )}
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                onClick={() => setRejectModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {actionLoading && <Spinner />}
                {actionLoading ? 'Rejecting…' : 'Reject Campaign'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Reopen confirmation modal ── */}
        <Modal
          open={reopenModalOpen}
          onClose={() => !actionLoading && setReopenModalOpen(false)}
          title="Reopen for Revision"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Reopening <strong className="text-white">{campaign.name}</strong> will move it back to draft status,
              increment the campaign version, and allow the content to be revised before resubmission.
            </p>
            <div className="rounded-lg bg-indigo-950/30 border border-indigo-800/50 p-3">
              <p className="text-xs text-indigo-300">
                The campaign version will be incremented from v{campaign.campaign_version} to v{(campaign.campaign_version ?? 0) + 1}.
                Brand scores from the previous version will be preserved in the history.
              </p>
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                onClick={() => setReopenModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {actionLoading && <Spinner />}
                {actionLoading ? 'Reopening…' : 'Reopen for Revision'}
              </button>
            </div>
          </div>
        </Modal>

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </Layout>
    </ProtectedRoute>
  )
}

// ============================================================
// Email content panel with sandboxed iframe for HTML preview
// ============================================================

function EmailContentPanelWithIframe({ content }) {
  const iframeRef = useRef(null)
  const [iframeHeight, setIframeHeight] = useState(400)

  const sanitizedHtml = content?.html_body
    ? sanitizeHtmlClient(content.html_body)
    : null

  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc) {
        const height = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 400
        setIframeHeight(Math.min(Math.max(height, 200), 800))
      }
    } catch {
      // cross-origin sandboxing may block access — keep default height
    }
  }

  if (!content) {
    return <p className="text-sm text-gray-500">No email content generated</p>
  }

  return (
    <div className="space-y-4">
      {content.subject_lines?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Subject Lines</p>
          </div>
          <div className="space-y-1.5">
            {content.subject_lines.map((line, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 group"
              >
                <span className="text-xs text-gray-500 mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                <p className="text-sm text-white flex-1">{line}</p>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0">
                  <CopyButton text={line} label="subject line" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.preview_text && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview Text</p>
            <CopyButton text={content.preview_text} label="preview text" />
          </div>
          <p className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            {content.preview_text}
          </p>
        </div>
      )}

      {sanitizedHtml ? (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Email Preview</p>
          <div className="rounded-lg border border-gray-700 overflow-hidden bg-white">
            <iframe
              ref={iframeRef}
              srcDoc={sanitizedHtml}
              sandbox="allow-same-origin"
              title="Email HTML Preview"
              onLoad={handleIframeLoad}
              style={{ width: '100%', height: `${iframeHeight}px`, border: 'none', display: 'block' }}
            />
          </div>
        </div>
      ) : content.body_text ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email Body</p>
            <CopyButton text={content.body_text} label="body text" />
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 overflow-x-auto">
            <p className="text-sm text-gray-200 whitespace-pre-wrap">{content.body_text}</p>
          </div>
        </div>
      ) : null}

      {content.cta && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Call to Action</p>
            <CopyButton text={content.cta} label="CTA" />
          </div>
          <p className="text-sm text-indigo-300 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            {content.cta}
          </p>
        </div>
      )}
    </div>
  )
}

function sanitizeHtmlClient(html) {
  if (typeof window === 'undefined') return html
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const dangerous = doc.querySelectorAll('script, iframe, object, embed, form, input, link[rel="stylesheet"]')
    dangerous.forEach(el => el.remove())
    const allElements = doc.querySelectorAll('*')
    const dangerousAttrs = [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onsubmit',
      'onfocus', 'onblur', 'onchange', 'onkeydown', 'onkeypress', 'onkeyup',
    ]
    allElements.forEach(el => {
      dangerousAttrs.forEach(attr => el.removeAttribute(attr))
    })
    return doc.documentElement.outerHTML
  } catch {
    return ''
  }
}

// ============================================================
// Action Panel
// ============================================================

function ActionPanel({
  campaign,
  isAdmin,
  role,
  canSubmit,
  brandScore,
  actionLoading,
  onApprove,
  onReject,
  onOverride,
  onReopen,
  onSubmit,
  onScore,
  scoreLoading,
}) {
  const { status } = campaign
  const hasContent = Object.keys(campaign.generated_content || {}).some(k => k !== '_schema_version')
  const canReopenOrEdit = role === 'admin' || role === 'editor'

  if (status === 'draft') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
          Draft
        </div>
        {canReopenOrEdit && hasContent && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onScore}
              disabled={scoreLoading || actionLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {scoreLoading && <Spinner />}
              {scoreLoading ? 'Scoring…' : 'Score Content'}
            </button>
            <button
              onClick={onSubmit}
              disabled={actionLoading || !canSubmit || scoreLoading}
              title={!canSubmit ? `Brand score must be ≥ 85 (current: ${brandScore ?? '—'})` : ''}
              aria-disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {actionLoading && <Spinner />}
              {actionLoading ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        )}
        {!hasContent && (
          <span className="text-xs text-gray-500">Generate content before submitting</span>
        )}
        {canReopenOrEdit && hasContent && !canSubmit && (
          <span className="text-xs text-amber-500">
            Brand score must be ≥ 85 to submit (current: {brandScore ?? '—'})
          </span>
        )}
      </div>
    )
  }

  if (status === 'pending' && isAdmin) {
    return (
      <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-amber-300 flex-1 min-w-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Awaiting your review
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onApprove}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {actionLoading && <Spinner />}
            Approve
          </button>
          {(campaign.brand_score === null || (campaign.brand_score ?? 0) < 85) && (
            <button
              onClick={onOverride}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-amber-100 bg-amber-800/60 hover:bg-amber-700/60 border border-amber-700 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Approve with Override
            </button>
          )}
          <button
            onClick={onReject}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-200 bg-red-900/40 hover:bg-red-900/60 border border-red-800 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Reject
          </button>
        </div>
      </div>
    )
  }

  if (status === 'pending' && !isAdmin) {
    return (
      <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-4 flex items-center gap-2 text-sm text-amber-300" role="status">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        This campaign is pending admin review
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-4 flex items-center gap-2 text-sm text-emerald-300" role="status">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Approved {campaign.approved_at ? (
          <time dateTime={campaign.approved_at}>on {formatDate(campaign.approved_at)}</time>
        ) : ''}
      </div>
    )
  }

  if (status === 'rejected' && canReopenOrEdit) {
    return (
      <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-red-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Campaign was rejected
        </div>
        <button
          onClick={onReopen}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {actionLoading && <Spinner />}
          {actionLoading ? 'Reopening…' : 'Reopen for Revision'}
        </button>
      </div>
    )
  }

  if (status === 'rejected' && !canReopenOrEdit) {
    return (
      <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-4 flex items-center gap-2 text-sm text-red-300" role="status">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Campaign was rejected
      </div>
    )
  }

  return null
}

// ============================================================
// Helpers
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}