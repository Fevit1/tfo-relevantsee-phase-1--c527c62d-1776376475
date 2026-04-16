'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import React from 'react'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BrandScoreBadge } from '@/components/ui/BrandScoreBadge'
import { ChannelChips } from '@/components/ui/ChannelChips'
import { listCampaigns } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

// ============================================================
// TOAST SYSTEM
// ============================================================

function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-red-950 border-red-800 text-red-200'
              : toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-800 text-emerald-200'
              : 'bg-gray-900 border-gray-700 text-gray-200'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-current opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 shrink-0 mt-0.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Dismiss notification"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// ERROR BOUNDARY
// ============================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('DashboardPage ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 lg:p-8">
          <div className="bg-gray-900 border border-red-900/50 rounded-xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-red-400 font-semibold text-lg">Something went wrong</p>
            <p className="text-gray-400 text-sm mt-2">An unexpected error occurred while rendering the dashboard.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================================================
// MAIN PAGE
// ============================================================

export function DashboardPage() {
  const { toasts, addToast, removeToast } = useToast()

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ErrorBoundary>
        <DashboardContent addToast={addToast} />
      </ErrorBoundary>
    </>
  )
}

function DashboardContent({ addToast }) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('')
  const [quickStats, setQuickStats] = useState({ total: 0, pending: 0, approvedThisMonth: 0, rejected: 0 })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const [totalData, pendingData, approvedData, rejectedData] = await Promise.all([
        listCampaigns({ page_size: 1 }),
        listCampaigns({ status: 'pending', page_size: 1 }),
        listCampaigns({ status: 'approved', page_size: 100 }),
        listCampaigns({ status: 'rejected', page_size: 1 }),
      ])

      if (!isMountedRef.current) return

      const approvedThisMonth = (approvedData.campaigns || []).filter(c => {
        const date = new Date(c.approved_at || c.updated_at)
        return date >= startOfMonth
      }).length

      setQuickStats({
        total: totalData.pagination?.total || 0,
        pending: pendingData.pagination?.total || 0,
        approvedThisMonth,
        rejected: rejectedData.pagination?.total || 0,
      })
    } catch (err) {
      if (!isMountedRef.current) return
      const msg = err.status === 401 || err.status === 403
        ? 'Session expired. Please log in again.'
        : err.status === 429
        ? 'Too many requests. Stats will retry shortly.'
        : 'Failed to load dashboard stats.'
      setStatsError(msg)
      addToast(msg, 'error')
      console.error('Failed to load stats:', err.message)
    } finally {
      if (isMountedRef.current) setStatsLoading(false)
    }
  }, [addToast])

  const fetchCampaigns = useCallback(async (status = '') => {
    setLoading(true)
    setError(null)
    try {
      const data = await listCampaigns({ status: status || undefined, page_size: 20 })
      if (!isMountedRef.current) return
      setCampaigns(data.campaigns || [])
      setPagination(data.pagination || null)
    } catch (err) {
      if (!isMountedRef.current) return
      let msg
      if (err.status === 401 || err.status === 403) {
        msg = 'Your session has expired. Please log in again.'
      } else if (err.status === 429) {
        msg = 'Too many requests. Please wait a moment and try again.'
      } else {
        msg = err.message || 'Failed to load campaigns. Please try again.'
      }
      setError(msg)
      addToast(msg, 'error')
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchCampaigns(activeTab)
  }, [activeTab, fetchCampaigns])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">

          {/* Page Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Campaigns</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage and track your marketing campaigns</p>
            </div>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Campaign
            </Link>
          </div>

          {/* Quick stats */}
          <section aria-label="Campaign statistics">
            <h2 className="sr-only">Campaign Overview</h2>
            <QuickStatsBar stats={quickStats} loading={statsLoading} error={statsError} onRetry={fetchStats} />
          </section>

          {/* Status filter tabs */}
          <section aria-label="Campaign filter">
            <h2 className="sr-only">Filter Campaigns by Status</h2>
            <div
              role="tablist"
              aria-label="Campaign status filter"
              className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800 w-full sm:w-fit overflow-x-auto"
            >
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  role="tab"
                  aria-selected={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-400 ${
                    activeTab === tab.value
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {/* Campaign list */}
          <section aria-label="Campaign list">
            <h2 className="sr-only">
              {activeTab ? `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Campaigns` : 'All Campaigns'}
            </h2>
            {loading ? (
              <CampaignTableSkeleton />
            ) : error ? (
              <ErrorState message={error} onRetry={() => fetchCampaigns(activeTab)} />
            ) : campaigns.length === 0 ? (
              <EmptyState activeTab={activeTab} />
            ) : (
              <CampaignTable campaigns={campaigns} />
            )}
          </section>

        </div>
      </Layout>
    </ProtectedRoute>
  )
}

// ============================================================
// QUICK STATS BAR
// ============================================================

function StatCard({ label, value, color, loading, error, onRetry }) {
  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5"
      aria-label={`${label}: ${loading ? 'loading' : error ? 'error' : value}`}
    >
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      {loading ? (
        <div
          className="h-8 w-16 bg-gray-800 rounded animate-pulse mt-2"
          aria-hidden="true"
        />
      ) : error ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-red-400">Failed to load</span>
          <button
            onClick={onRetry}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors duration-150 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-400 rounded"
            aria-label={`Retry loading ${label}`}
          >
            Retry
          </button>
        </div>
      ) : (
        <p className={`text-2xl sm:text-3xl font-bold mt-2 tabular-nums ${color}`}>{value}</p>
      )}
    </div>
  )
}

function QuickStatsBar({ stats, loading, error, onRetry }) {
  const items = [
    { label: 'Total Campaigns', value: stats.total, color: 'text-white' },
    { label: 'Pending Approval', value: stats.pending, color: 'text-amber-400' },
    { label: 'Approved This Month', value: stats.approvedThisMonth, color: 'text-emerald-400' },
    { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map(item => (
        <StatCard
          key={item.label}
          label={item.label}
          value={item.value}
          color={item.color}
          loading={loading}
          error={error}
          onRetry={onRetry}
        />
      ))}
    </div>
  )
}

// ============================================================
// CAMPAIGN TABLE
// ============================================================

function CampaignTable({ campaigns }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]" role="grid" aria-label="Campaigns list">
          <thead>
            <tr className="border-b border-gray-800">
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Brand Score</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Channels</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Demo Metrics</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {campaigns.map(campaign => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CampaignRow({ campaign }) {
  const router = useRouter()
  const metrics = getMockMetrics(campaign.id)

  const handleClick = () => router.push(`/campaigns/${campaign.id}`)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(`/campaigns/${campaign.id}`)
    }
  }

  return (
    <tr
      tabIndex={0}
      role="row"
      aria-label={`Campaign: ${campaign.name}, status: ${campaign.status}`}
      className="hover:bg-gray-800/60 cursor-pointer transition-colors duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <td className="px-4 py-4">
        <div>
          <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors duration-150 line-clamp-1">
            {campaign.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{campaign.brief}</p>
        </div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={campaign.status} />
      </td>
      <td className="px-4 py-4">
        <BrandScoreBadge score={campaign.brand_score} />
      </td>
      <td className="px-4 py-4">
        <ChannelChips channels={campaign.channels || []} />
      </td>
      <td className="px-4 py-4 hidden xl:table-cell">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{metrics.impressions.toLocaleString()} imp</span>
            <span>{metrics.clicks.toLocaleString()} clicks</span>
            <span>{metrics.ctr} CTR</span>
          </div>
          <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700 shrink-0">
            Demo
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(campaign.created_at)}</p>
      </td>
    </tr>
  )
}

// ============================================================
// SKELETON LOADING STATE
// ============================================================

function CampaignTableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading campaigns">
      {/* Skeleton stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5"
            aria-hidden="true"
          >
            <div className="h-4 bg-gray-800 rounded w-32 mb-3 animate-pulse" />
            <div className="h-8 bg-gray-800 rounded w-16 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Skeleton table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden" aria-hidden="true">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3">
                  <div className="h-3 bg-gray-800 rounded w-24 animate-pulse" />
                </th>
                <th className="px-4 py-3">
                  <div className="h-3 bg-gray-800 rounded w-16 animate-pulse" />
                </th>
                <th className="px-4 py-3">
                  <div className="h-3 bg-gray-800 rounded w-20 animate-pulse" />
                </th>
                <th className="px-4 py-3">
                  <div className="h-3 bg-gray-800 rounded w-20 animate-pulse" />
                </th>
                <th className="px-4 py-3 hidden xl:table-cell">
                  <div className="h-3 bg-gray-800 rounded w-28 animate-pulse" />
                </th>
                <th className="px-4 py-3">
                  <div className="h-3 bg-gray-800 rounded w-16 animate-pulse" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[1, 2, 3, 4, 5].map(i => (
                <tr
                  key={i}
                  className="animate-pulse"
                  style={{
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-48" />
                      <div className="h-3 bg-gray-800 rounded w-64 max-w-full" />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 bg-gray-800 rounded-full w-16" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 bg-gray-800 rounded w-12" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 bg-gray-800 rounded w-24" />
                  </td>
                  <td className="px-4 py-4 hidden xl:table-cell">
                    <div className="h-4 bg-gray-800 rounded w-40" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 bg-gray-800 rounded w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({ activeTab }) {
  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col items-center justify-center py-16 sm:py-20 px-8 text-center"
      role="status"
      aria-label={activeTab ? `No ${activeTab} campaigns found` : 'No campaigns yet'}
    >
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-5" aria-hidden="true">
        <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="text-white font-semibold text-lg">
        {activeTab ? `No ${activeTab} campaigns` : 'No campaigns yet'}
      </p>
      <p className="text-sm text-gray-400 mt-2 max-w-sm leading-relaxed">
        {activeTab
          ? `There are no campaigns with "${activeTab}" status. Try a different filter or create a new campaign.`
          : 'Get started by creating your first AI-powered marketing campaign.'}
      </p>
      <Link
        href="/campaigns/new"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Create your first campaign
      </Link>
    </div>
  )
}

// ============================================================
// ERROR STATE
// ============================================================

function ErrorState({ message, onRetry }) {
  return (
    <div
      className="bg-gray-900 border border-red-900/50 rounded-xl p-10 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.75 1.096-.136 2.374-1.5 2.374H4.197c-1.364 0-2.25-1.278-1.5-2.374L10.5 5.25c.75-1.096 2.25-1.096 3 0l7.803 11.25zM12 15.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-red-400 font-semibold text-base">{message}</p>
      <p className="text-gray-500 text-sm mt-1">This may be a temporary issue. Please try again.</p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors duration-150 mx-auto border border-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        aria-label="Retry loading campaigns"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Try again
      </button>
    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

function getMockMetrics(campaignId) {
  const chars = (campaignId || '').replace(/-/g, '')
  let hash = 0
  for (let i = 0; i < chars.length; i++) {
    hash = ((hash << 5) - hash + parseInt(chars[i], 16)) | 0
  }
  const abs = Math.abs(hash)
  const impressions = 15000 + (abs % 85000)
  const clicks = 300 + (abs % 4700)
  const ctr = ((clicks / impressions) * 100).toFixed(2) + '%'
  return { impressions, clicks, ctr }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}