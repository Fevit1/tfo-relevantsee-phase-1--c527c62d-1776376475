'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BrandScoreBadge } from '@/components/ui/BrandScoreBadge'
import { ChannelChips } from '@/components/ui/ChannelChips'
import { getApprovalQueue, approveCampaign, rejectCampaign } from '@/lib/api'

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============================================================
// TOAST SYSTEM
// ============================================================

function Toast({ toasts, dismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          className={`
            pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg max-w-sm
            ${t.type === 'success' ? 'bg-emerald-900 border border-emerald-700 text-emerald-100' : ''}
            ${t.type === 'error'   ? 'bg-red-900 border border-red-700 text-red-100'           : ''}
            ${t.type === 'warning' ? 'bg-amber-900 border border-amber-700 text-amber-100'     : ''}
            ${t.type === 'info'    ? 'bg-gray-800 border border-gray-600 text-gray-100'        : ''}
          `}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 rounded transition-opacity text-sm leading-none"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const timerRef = useRef({})

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timerRef.current[id]) {
      clearTimeout(timerRef.current[id])
      delete timerRef.current[id]
    }
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      timerRef.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info',     dur),
  }

  return { toasts, toast, dismiss }
}

// ============================================================
// SKELETON
// ============================================================

function QueueSkeleton() {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      aria-label="Loading campaigns"
      aria-busy="true"
    >
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 bg-gray-800 rounded w-40" />
              <div className="h-5 bg-gray-800 rounded w-16" />
              <div className="h-5 bg-gray-800 rounded w-10" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
            <div className="flex gap-2">
              <div className="h-5 bg-gray-800 rounded w-16" />
              <div className="h-5 bg-gray-800 rounded w-16" />
            </div>
            <div className="flex gap-2 mt-1">
              <div className="h-8 bg-gray-800 rounded-lg w-16" />
              <div className="h-8 bg-gray-800 rounded-lg w-20" />
              <div className="h-8 bg-gray-800 rounded-lg w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyQueue() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-800 flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-7 h-7 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-white font-semibold text-base">All clear!</p>
      <p className="text-sm text-gray-400 mt-1">No campaigns pending approval.</p>
      <p className="text-xs text-gray-500 mt-0.5">Check back when editors submit new campaigns for review.</p>
    </div>
  )
}

// ============================================================
// SPINNER
// ============================================================

function Spinner({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ============================================================
// APPROVAL MODAL
// ============================================================

function ApproveModal({ open, onClose, campaign, actionLoading, actionError, onApprove }) {
  const [notes, setNotes] = useState('')
  const titleId = 'approve-modal-title'
  const needsOverride = campaign && (campaign.brand_score === null || campaign.brand_score < 85)

  useEffect(() => {
    if (open) setNotes('')
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={e => { if (e.currentTarget === e.target && !actionLoading) onClose() }}
    >
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 id={titleId} className="text-lg font-semibold text-white">Approve Campaign</h2>
          <button
            onClick={() => { if (!actionLoading) onClose() }}
            className="p-1 text-gray-400 hover:text-white transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close approve campaign dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {actionError && (
            <p role="alert" className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}

          <p className="text-sm text-gray-300">
            Reviewing: <strong className="text-white">{campaign?.name}</strong>
          </p>

          {needsOverride && (
            <div className="rounded-lg bg-amber-950/30 border border-amber-800 p-3" role="note">
              <p className="text-sm text-amber-300">
                ⚠ Brand score ({campaign?.brand_score ?? '—'}) is below the 85 threshold.
                You may approve normally or use <strong>Approve with Override</strong> to document the exception.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="approve-notes" className="block text-sm font-medium text-gray-300">
              Notes{' '}
              {needsOverride
                ? <span className="text-red-400">* (required for override)</span>
                : <span className="text-gray-500">(optional)</span>}
            </label>
            <textarea
              id="approve-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder={
                needsOverride
                  ? 'Explain why this campaign is approved despite low brand score…'
                  : 'Optional notes for the creator…'
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-none transition-colors duration-150"
            />
          </div>

          <div className="flex gap-3 justify-end flex-wrap">
            <button
              onClick={() => { if (!actionLoading) onClose() }}
              disabled={actionLoading}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Cancel
            </button>

            <button
              onClick={() => onApprove(false, notes)}
              disabled={actionLoading}
              aria-label={`Approve campaign: ${campaign?.name}`}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            >
              {actionLoading ? <><Spinner /> Approving…</> : 'Approve'}
            </button>

            {needsOverride && (
              <button
                onClick={() => onApprove(true, notes)}
                disabled={actionLoading}
                aria-label={`Approve campaign with override: ${campaign?.name}`}
                className="px-4 py-2 text-sm font-semibold text-amber-200 bg-amber-900/50 hover:bg-amber-900/70 border border-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                {actionLoading ? <><Spinner /> Approving…</> : 'Approve with Override'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// REJECT MODAL
// ============================================================

function RejectModal({ open, onClose, campaign, actionLoading, actionError, onReject }) {
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState(null)
  const titleId = 'reject-modal-title'

  useEffect(() => {
    if (open) { setNotes(''); setLocalError(null) }
  }, [open])

  if (!open) return null

  const handleReject = () => {
    if (!notes.trim()) {
      setLocalError('Rejection notes are required.')
      return
    }
    setLocalError(null)
    onReject(notes)
  }

  const displayError = localError || actionError

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={e => { if (e.currentTarget === e.target && !actionLoading) onClose() }}
    >
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 id={titleId} className="text-lg font-semibold text-white">Reject Campaign</h2>
          <button
            onClick={() => { if (!actionLoading) onClose() }}
            className="p-1 text-gray-400 hover:text-white transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close reject campaign dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {displayError && (
            <p role="alert" className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
              {displayError}
            </p>
          )}

          <p className="text-sm text-gray-300">
            Rejecting: <strong className="text-white">{campaign?.name}</strong>
          </p>

          <div className="rounded-lg bg-red-950/30 border border-red-900 p-3" role="note">
            <p className="text-sm text-red-300">
              The campaign creator will be notified. Rejected campaigns can be reopened and revised.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reject-notes" className="block text-sm font-medium text-gray-300">
              Rejection Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              id="reject-notes"
              value={notes}
              onChange={e => {
                setNotes(e.target.value)
                if (localError && e.target.value.trim()) setLocalError(null)
              }}
              rows={4}
              placeholder="Explain why this campaign is being rejected and what changes are needed…"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 resize-none transition-colors duration-150"
              aria-required="true"
              aria-describedby="reject-notes-hint"
            />
            <p id="reject-notes-hint" className="text-xs text-gray-500">Required — this will be shared with the campaign creator.</p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { if (!actionLoading) onClose() }}
              disabled={actionLoading}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              aria-label={`Reject campaign: ${campaign?.name}`}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            >
              {actionLoading ? <><Spinner /> Rejecting…</> : 'Reject Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function ApprovalQueuePage() {
  const router = useRouter()
  const { toasts, toast, dismiss } = useToast()

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)

  // Modal state
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Track which campaign IDs have in-flight requests to prevent double-submit
  const [inFlightIds, setInFlightIds] = useState(new Set())

  const addInFlight = (id) => setInFlightIds(prev => new Set([...prev, id]))
  const removeInFlight = (id) => setInFlightIds(prev => { const s = new Set(prev); s.delete(id); return s })

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAccessDenied(false)
    try {
      const result = await getApprovalQueue()
      setCampaigns(result.campaigns || [])
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setAccessDenied(true)
        toast.error('Admin access required to view the approval queue.')
      } else if (err.status === 429) {
        setError('Too many requests. Please wait a moment and try again.')
        toast.warning('Rate limit reached. Please slow down.')
      } else {
        setError(err.message || 'Failed to load approval queue')
      }
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadQueue() }, [loadQueue])

  const openApprove = (campaign) => {
    if (inFlightIds.has(campaign.id)) return
    setSelectedCampaign(campaign)
    setActionError(null)
    setApproveModalOpen(true)
  }

  const openReject = (campaign) => {
    if (inFlightIds.has(campaign.id)) return
    setSelectedCampaign(campaign)
    setActionError(null)
    setRejectModalOpen(true)
  }

  const handleApprove = async (overrideFlag, notes) => {
    if (!selectedCampaign) return

    if (overrideFlag && !notes.trim()) {
      setActionError('Override reason is required when approving with override.')
      return
    }

    const campaignId = selectedCampaign.id
    const campaignName = selectedCampaign.name

    setActionLoading(true)
    setActionError(null)
    addInFlight(campaignId)

    try {
      await approveCampaign(campaignId, {
        notes: notes || undefined,
        override_flag: overrideFlag,
      })
      setApproveModalOpen(false)
      toast.success(
        overrideFlag
          ? `"${campaignName}" approved with override.`
          : `"${campaignName}" approved successfully.`
      )
      await loadQueue()
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setApproveModalOpen(false)
        toast.error('Admin access required. You do not have permission to approve campaigns.')
        setAccessDenied(true)
      } else if (err.status === 429) {
        setActionError('Too many requests. Please wait a moment and try again.')
        toast.warning('Rate limit reached.')
      } else {
        setActionError(err.message || 'Failed to approve campaign')
        toast.error(`Failed to approve "${campaignName}".`)
      }
    } finally {
      setActionLoading(false)
      removeInFlight(campaignId)
    }
  }

  const handleReject = async (notes) => {
    if (!selectedCampaign) return

    const campaignId = selectedCampaign.id
    const campaignName = selectedCampaign.name

    setActionLoading(true)
    setActionError(null)
    addInFlight(campaignId)

    try {
      await rejectCampaign(campaignId, { notes })
      setRejectModalOpen(false)
      toast.success(`"${campaignName}" rejected. The creator has been notified.`)
      await loadQueue()
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setRejectModalOpen(false)
        toast.error('Admin access required. You do not have permission to reject campaigns.')
        setAccessDenied(true)
      } else if (err.status === 429) {
        setActionError('Too many requests. Please wait a moment and try again.')
        toast.warning('Rate limit reached.')
      } else {
        setActionError(err.message || 'Failed to reject campaign')
        toast.error(`Failed to reject "${campaignName}".`)
      }
    } finally {
      setActionLoading(false)
      removeInFlight(campaignId)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
            <p className="text-sm text-gray-400 mt-0.5">Review and approve pending campaigns</p>
          </div>

          {/* Access Denied Banner */}
          {accessDenied && (
            <div role="alert" className="bg-red-950/30 border border-red-800 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-300">Admin access required</p>
                <p className="text-xs text-red-400 mt-0.5">You do not have permission to view or manage the approval queue. Contact your account administrator.</p>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <QueueSkeleton />
          ) : error ? (
            <div className="bg-gray-900 border border-red-900/50 rounded-xl p-8 text-center" role="alert">
              <svg className="w-8 h-8 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-red-400 font-medium">{error}</p>
              <button
                onClick={loadQueue}
                className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              >
                Retry
              </button>
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyQueue />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} awaiting review
              </p>

              {/* Responsive grid: 1 col on mobile, 2 cols on lg */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {campaigns.map(campaign => {
                  const isInFlight = inFlightIds.has(campaign.id)
                  return (
                    <article
                      key={campaign.id}
                      aria-label={`Campaign: ${campaign.name}`}
                      className={`
                        bg-gray-900 border rounded-xl p-5
                        transition-all duration-200
                        ${isInFlight
                          ? 'opacity-60 pointer-events-none border-gray-800'
                          : 'border-gray-800 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-950/20'
                        }
                      `}
                    >
                      {/* Campaign info — stacks vertically on mobile */}
                      <div className="flex flex-col gap-3">
                        {/* Title row */}
                        <div className="flex items-start gap-2 flex-wrap">
                          <button
                            onClick={() => router.push(`/campaigns/${campaign.id}`)}
                            className="text-base font-semibold text-white hover:text-indigo-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded text-left"
                            aria-label={`View campaign: ${campaign.name}`}
                          >
                            {campaign.name}
                          </button>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={campaign.status} />
                            <BrandScoreBadge score={campaign.brand_score} />
                          </div>
                        </div>

                        {/* Brief */}
                        <p className="text-sm text-gray-400 line-clamp-2">{campaign.brief}</p>

                        {/* Channels + date */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <ChannelChips channels={campaign.channels || []} />
                          <span className="text-xs text-gray-500">
                            Submitted {formatDate(campaign.updated_at)}
                          </span>
                        </div>

                        {/* Action buttons — full width row on mobile */}
                        {!accessDenied && (
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <button
                              onClick={() => router.push(`/campaigns/${campaign.id}`)}
                              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              aria-label={`View details for campaign: ${campaign.name}`}
                            >
                              View
                            </button>
                            <button
                              onClick={() => openApprove(campaign)}
                              aria-label={`Approve campaign: ${campaign.name}`}
                              className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex items-center gap-1.5"
                            >
                              {isInFlight ? (
                                <><Spinner /> Working…</>
                              ) : 'Approve'}
                            </button>
                            <button
                              onClick={() => openReject(campaign)}
                              aria-label={`Reject campaign: ${campaign.name}`}
                              className="px-3 py-1.5 text-sm text-red-300 bg-red-950/40 hover:bg-red-950/60 border border-red-900 hover:border-red-700 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Approve Modal */}
        <ApproveModal
          open={approveModalOpen}
          onClose={() => { if (!actionLoading) { setApproveModalOpen(false); setActionError(null) } }}
          campaign={selectedCampaign}
          actionLoading={actionLoading}
          actionError={actionError}
          onApprove={handleApprove}
        />

        {/* Reject Modal */}
        <RejectModal
          open={rejectModalOpen}
          onClose={() => { if (!actionLoading) { setRejectModalOpen(false); setActionError(null) } }}
          campaign={selectedCampaign}
          actionLoading={actionLoading}
          actionError={actionError}
          onReject={handleReject}
        />

        {/* Toast notifications */}
        <Toast toasts={toasts} dismiss={dismiss} />
      </Layout>
    </ProtectedRoute>
  )
}