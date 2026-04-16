/**
 * RelevantSee API Client
 *
 * Reusable frontend API helpers for all route handlers.
 * All functions use fetch with proper error handling.
 * Import these in page/component files instead of calling fetch directly.
 */

// ============================================================
// API ERROR CLASS
// ============================================================

/**
 * Typed API error with a code property for caller-side handling.
 */
export class ApiError extends Error {
  constructor(message, code, status, data = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.data = data
  }
}

// ============================================================
// HTTP HELPER
// ============================================================

/**
 * Create an AbortSignal that times out after `ms` milliseconds.
 * Falls back gracefully if AbortSignal.timeout is unavailable.
 */
function createTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

/**
 * Base fetch wrapper with consistent error handling.
 *
 * Error codes thrown:
 *   'unauthorized'          – 401 (also redirects to /login)
 *   'insufficient_permissions' – 403
 *   'rate_limited'          – 429 (retryAfter property set if header present)
 *   'timeout'               – AbortError from signal
 *   'network_error'         – fetch() threw (no response)
 *   'server_error'          – 5xx
 *   'request_failed'        – any other non-2xx
 *
 * @param {string} path - API path (e.g. '/api/campaigns')
 * @param {RequestInit & { _timeoutMs?: number }} options - fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
async function apiFetch(path, options = {}) {
  const { _timeoutMs = 30_000, signal: callerSignal, ...fetchOptions } = options

  // Build a combined signal: caller signal + timeout
  let signal = createTimeoutSignal(_timeoutMs)
  if (callerSignal) {
    // Compose both signals — abort if either fires
    const controller = new AbortController()
    const abortOnEither = () => controller.abort()
    signal.addEventListener('abort', abortOnEither, { once: true })
    callerSignal.addEventListener('abort', abortOnEither, { once: true })
    signal = controller.signal
  }

  let response
  try {
    response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      ...fetchOptions,
      signal,
    })
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new ApiError(
        `Request timed out after ${Math.round(_timeoutMs / 1000)}s`,
        'timeout',
        null,
        { path }
      )
    }
    throw new ApiError(
      'Network error — please check your connection and try again.',
      'network_error',
      null,
      { path, originalMessage: err?.message }
    )
  }

  const data = await response.json().catch(() => ({}))

  if (response.ok) {
    return data
  }

  // ── Status-specific error handling ──────────────────────────

  if (response.status === 401) {
    // Redirect to login. Only safe in browser context.
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new ApiError(
      'Your session has expired. Redirecting to login…',
      'unauthorized',
      401,
      data
    )
  }

  if (response.status === 403) {
    throw new ApiError(
      data.error || 'You do not have permission to perform this action.',
      'insufficient_permissions',
      403,
      data
    )
  }

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('retry-after')
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null
    const err = new ApiError(
      data.error || 'Too many requests — please wait before trying again.',
      'rate_limited',
      429,
      data
    )
    err.retryAfter = retryAfter
    throw err
  }

  if (response.status >= 500) {
    throw new ApiError(
      data.error || 'A server error occurred. Please try again later.',
      'server_error',
      response.status,
      data
    )
  }

  // Generic fallback for other 4xx errors
  throw new ApiError(
    data.error || `Request failed with status ${response.status}`,
    'request_failed',
    response.status,
    data
  )
}

// ============================================================
// CAMPAIGNS
// ============================================================

/**
 * Create a new campaign in draft status.
 * @param {{ name: string, brief: string, channels: string[] }} payload
 * @returns {Promise<{ campaign: Object }>}
 */
export async function createCampaign(payload) {
  return apiFetch('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * List campaigns for the account with optional filters.
 * @param {{ status?: string, page?: number, page_size?: number }} params
 * @returns {Promise<{ campaigns: Object[], pagination: Object }>}
 */
export async function listCampaigns(params = {}) {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.page_size) searchParams.set('page_size', String(params.page_size))

  const query = searchParams.toString()
  return apiFetch(`/api/campaigns${query ? `?${query}` : ''}`)
}

/**
 * Get full campaign detail including generated content, score log, and mock metrics.
 * @param {string} campaignId
 * @returns {Promise<{ campaign: Object, status_log: Object[], approval_log: Object[], score_log: Object[], mock_metrics: Object }>}
 */
export async function getCampaign(campaignId) {
  return apiFetch(`/api/campaigns/${campaignId}`)
}

/**
 * Update campaign fields (draft status only).
 * @param {string} campaignId
 * @param {Object} updates
 * @returns {Promise<{ campaign: Object }>}
 */
export async function updateCampaign(campaignId, updates) {
  return apiFetch(`/api/campaigns/${campaignId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

/**
 * Trigger AI generation for a campaign's channels.
 * Uses 90-second timeout (AI generation can be slow).
 * @param {{ campaign_id: string, channels: string[] }} payload
 * @returns {Promise<{ campaign: Object, channel_errors?: Object[] }>}
 */
export async function generateCampaignContent(payload) {
  return apiFetch('/api/campaigns/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
    _timeoutMs: 90_000,
  })
}

/**
 * Run two-phase brand scoring on a campaign.
 * @param {{ campaign_id: string }} payload
 * @returns {Promise<{ brand_score: number, phase1: Object, phase2: Object, score_log_entry: Object }>}
 */
export async function scoreCampaign(payload) {
  return apiFetch('/api/campaigns/score', {
    method: 'POST',
    body: JSON.stringify(payload),
    _timeoutMs: 60_000,
  })
}

/**
 * Submit a campaign for approval (draft -> pending).
 * @param {string} campaignId
 * @returns {Promise<{ campaign: Object }>}
 */
export async function submitCampaign(campaignId) {
  return apiFetch(`/api/campaigns/${campaignId}/submit`, { method: 'POST' })
}

/**
 * Approve a pending campaign. Admin only.
 * @param {string} campaignId
 * @param {{ notes?: string, override_flag?: boolean }} payload
 * @returns {Promise<{ campaign: Object }>}
 */
export async function approveCampaign(campaignId, payload = {}) {
  return apiFetch(`/api/campaigns/${campaignId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Reject a pending campaign. Admin only. Notes required.
 * @param {string} campaignId
 * @param {{ notes: string }} payload
 * @returns {Promise<{ campaign: Object }>}
 */
export async function rejectCampaign(campaignId, payload) {
  return apiFetch(`/api/campaigns/${campaignId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Reopen a rejected campaign (rejected -> draft). Admin | Editor.
 * @param {string} campaignId
 * @param {{ notes?: string }} payload
 * @returns {Promise<{ campaign: Object, new_version: number }>}
 */
export async function reopenCampaign(campaignId, payload = {}) {
  return apiFetch(`/api/campaigns/${campaignId}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ============================================================
// APPROVAL QUEUE
// ============================================================

/**
 * Get all pending campaigns for the approval queue. Admin only.
 * @returns {Promise<{ campaigns: Object[], count: number }>}
 */
export async function getApprovalQueue() {
  return apiFetch('/api/approvals')
}

// ============================================================
// CAMPAIGN STATS (dashboard)
// ============================================================

/**
 * Get campaign counts by status for the dashboard stats bar.
 * Makes parallel requests for each status to get counts.
 * @returns {Promise<{ draft: number, pending: number, approved: number, rejected: number, total: number }>}
 */
export async function getCampaignStats() {
  const statuses = ['draft', 'pending', 'approved', 'rejected']

  const [draftRes, pendingRes, approvedRes, rejectedRes] = await Promise.allSettled(
    statuses.map(status =>
      apiFetch(`/api/campaigns?status=${status}&page=1&page_size=1`)
    )
  )

  const getValue = (result) => {
    if (result.status === 'fulfilled') {
      return result.value?.pagination?.total ?? 0
    }
    return 0
  }

  const draft = getValue(draftRes)
  const pending = getValue(pendingRes)
  const approved = getValue(approvedRes)
  const rejected = getValue(rejectedRes)

  return {
    draft,
    pending,
    approved,
    rejected,
    total: draft + pending + approved + rejected,
  }
}

// ============================================================
// BRAND SETTINGS
// ============================================================

/**
 * Get the account's brand model.
 * @returns {Promise<{ account: Object, first_run: boolean }>}
 */
export async function getBrandModel() {
  return apiFetch('/api/accounts/brand')
}

/**
 * Update the account's brand model. Admin only.
 * @param {Object} updates
 * @returns {Promise<{ account: Object, first_run: boolean }>}
 */
export async function updateBrandModel(updates) {
  return apiFetch('/api/accounts/brand', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

// ============================================================
// TEAM MANAGEMENT
// ============================================================

/**
 * Get team members and pending invites. Admin only.
 * @returns {Promise<{ members: Object[], pending_invites: Object[], member_count: number, soft_cap_warning: boolean }>}
 */
export async function getTeam() {
  return apiFetch('/api/team')
}

/**
 * Send a team invite. Admin only.
 * @param {{ email: string, role: string }} payload
 * @returns {Promise<{ invite: Object, soft_cap_warning: boolean, email_sent: boolean }>}
 */
export async function inviteTeamMember(payload) {
  return apiFetch('/api/team/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Validate an invite token (public).
 * @param {string} token
 * @returns {Promise<{ account_name: string, role: string, email: string }>}
 */
export async function validateInviteToken(token) {
  return apiFetch(`/api/team/invite/${token}`)
}

/**
 * Accept an invite and create account (public).
 * @param {string} token
 * @param {{ full_name: string, password: string }} payload
 * @returns {Promise<{ success: boolean, user: Object }>}
 */
export async function acceptInvite(token, payload) {
  return apiFetch(`/api/team/invite/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Update a team member's role. Admin only.
 * @param {string} userId
 * @param {{ role: string }} payload
 * @returns {Promise<{ user: Object }>}
 */
export async function updateMemberRole(userId, payload) {
  return apiFetch(`/api/team/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/**
 * Remove a team member. Admin only.
 * @param {string} userId
 * @returns {Promise<{ success: boolean, removed_user_id: string }>}
 */
export async function removeMember(userId) {
  return apiFetch(`/api/team/${userId}`, { method: 'DELETE' })
}

// ============================================================
// MOCK METRICS HELPERS
// ============================================================

/**
 * Format mock metrics for display.
 * Metrics come from the GET /api/campaigns/[id] response.
 *
 * @param {{ impressions: number, clicks: number, ctr: string, conversions: number }} metrics
 * @returns {{ label: string, value: string }[]}
 */
export function formatMockMetrics(metrics) {
  if (!metrics) return []
  return [
    { label: 'Impressions', value: metrics.impressions?.toLocaleString() || '—' },
    { label: 'Clicks', value: metrics.clicks?.toLocaleString() || '—' },
    { label: 'CTR', value: metrics.ctr || '—' },
    { label: 'Conversions', value: metrics.conversions?.toLocaleString() || '—' },
  ]
}

// ============================================================
// PAGINATION HELPERS
// ============================================================

/**
 * Check if there are more pages to load.
 * @param {Object} pagination - Pagination object from list responses
 * @returns {boolean}
 */
export function hasNextPage(pagination) {
  return pagination?.has_next === true
}

/**
 * Get query params for a specific page.
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ page: number, page_size: number }}
 */
export function paginationParams(page, pageSize = 20) {
  return { page: Math.max(1, page), page_size: pageSize }
}

// ============================================================
// ERROR HELPERS
// ============================================================

/**
 * Check if an error is a specific ApiError code.
 * Useful in catch blocks for conditional handling.
 *
 * @param {unknown} err
 * @param {string} code
 * @returns {boolean}
 *
 * @example
 * try {
 *   await approveCampaign(id)
 * } catch (err) {
 *   if (isApiError(err, 'insufficient_permissions')) {
 *     showPermissionPrompt()
 *   } else if (isApiError(err, 'rate_limited')) {
 *     showRateLimitMessage(err.retryAfter)
 *   }
 * }
 */
export function isApiError(err, code) {
  return err instanceof ApiError && err.code === code
}

/**
 * Get a user-friendly message from any caught error.
 * Falls back gracefully for non-ApiError instances.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function getErrorMessage(err) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'unauthorized':
        return 'Your session has expired. Please log in again.'
      case 'insufficient_permissions':
        return 'You do not have permission to perform this action.'
      case 'rate_limited':
        return err.retryAfter
          ? `Too many requests. Please try again in ${err.retryAfter} seconds.`
          : 'Too many requests. Please wait before trying again.'
      case 'timeout':
        return 'The request timed out. Please try again.'
      case 'network_error':
        return 'Network error — please check your connection and try again.'
      case 'server_error':
        return 'A server error occurred. Please try again later.'
      default:
        return err.message || 'An unexpected error occurred.'
    }
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred.'
}