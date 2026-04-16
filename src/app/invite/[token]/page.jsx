'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider, useToast } from '@/components/ui/Toast'

function InvitePageInner({ token }) {
  const router = useRouter()
  const toast = useToast()

  const [inviteData, setInviteData] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState(null)
  const [inviteErrorStatus, setInviteErrorStatus] = useState(null)
  const [inviteErrorType, setInviteErrorType] = useState(null)
  const [cardVisible, setCardVisible] = useState(false)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(null)
  const [signInFailed, setSignInFailed] = useState(false)

  useEffect(() => {
    if (!token) return

    async function fetchInvite() {
      try {
        const res = await fetch(`/api/team/invite/${token}`)
        const data = await res.json()

        if (!res.ok) {
          setInviteErrorStatus(res.status)
          if (res.status === 410) {
            const msg = data.error || ''
            if (
              msg.toLowerCase().includes('accept') ||
              msg.toLowerCase().includes('used') ||
              msg.toLowerCase().includes('already')
            ) {
              setInviteErrorType('used')
              setInviteError(data.error || 'This invite has already been used.')
            } else {
              setInviteErrorType('expired')
              setInviteError(data.error || 'This invite link has expired.')
            }
          } else if (res.status === 404) {
            setInviteErrorType('not_found')
            setInviteError(data.error || 'This invite link is invalid or does not exist.')
          } else {
            setInviteErrorType('generic')
            setInviteError(data.error || 'Failed to validate invite link.')
          }
        } else {
          setInviteData(data)
        }
      } catch (err) {
        setInviteErrorType('generic')
        setInviteError('Failed to load invite. Please check your connection and try again.')
        setInviteErrorStatus(500)
      } finally {
        setLoadingInvite(false)
        // Trigger entrance animation after content is ready
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setCardVisible(true))
        })
      }
    }

    fetchInvite()
  }, [token])

  function validateFields() {
    const errors = {}
    if (!fullName.trim()) {
      errors.fullName = 'Please enter your full name.'
    }
    if (!password) {
      errors.password = 'Please enter a password.'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setRateLimitRetryAfter(null)

    const errors = validateFields()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)

    try {
      const acceptRes = await fetch(`/api/team/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), password }),
      })

      const acceptData = await acceptRes.json()

      if (!acceptRes.ok) {
        if (acceptRes.status === 429) {
          const retryAfterHeader = acceptRes.headers.get('retry-after')
          const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null
          setRateLimitRetryAfter(retryAfter)
          setSubmitError(
            retryAfter
              ? `Too many attempts. Please wait ${retryAfter} seconds before trying again.`
              : 'Too many attempts. Please wait before trying again.'
          )
          setSubmitting(false)
          return
        }
        if (acceptRes.status === 410) {
          setSubmitError('This invite link has expired or has already been used.')
          setSubmitting(false)
          return
        }
        if (acceptRes.status === 401 || acceptRes.status === 403) {
          setSubmitError('You do not have permission to accept this invite.')
          setSubmitting(false)
          return
        }
        setSubmitError(acceptData.error || 'Failed to create your account. Please try again.')
        setSubmitting(false)
        return
      }

      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password,
      })

      if (signInError) {
        console.error('[InvitePage] Sign in failed after account creation:', signInError.message)
        setSignInFailed(true)
        setSubmitting(false)
        return
      }

      toast.success('Account created! Welcome aboard.', { title: 'Welcome!' })
      router.push('/dashboard')
    } catch (err) {
      console.error('[InvitePage] Unexpected error:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500"
            role="status"
            aria-label="Validating invite link"
          />
          <p className="text-sm text-gray-500">Validating your invite link…</p>
        </div>
      </div>
    )
  }

  // ── Error states ───────────────────────────────────────────────────────────
  if (inviteError) {
    const isExpired = inviteErrorType === 'expired'
    const isUsed = inviteErrorType === 'used'
    const isNotFound = inviteErrorType === 'not_found'

    let title = 'Invite Not Found'
    let iconBg = 'bg-red-900/40'
    let iconColor = 'text-red-400'

    if (isExpired) {
      title = 'Invite Has Expired'
      iconBg = 'bg-yellow-900/40'
      iconColor = 'text-yellow-400'
    } else if (isUsed) {
      title = 'Invite Already Used'
      iconBg = 'bg-blue-900/40'
      iconColor = 'text-blue-400'
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
        <div
          className={`w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8 text-center shadow-xl transition-all duration-300 motion-safe:duration-300 ${
            cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          role="alert"
          aria-live="assertive"
        >
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}
            aria-hidden="true"
          >
            {isUsed ? (
              <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <h1 className="mb-2 text-xl font-semibold text-white">{title}</h1>
          <p className="mb-4 text-sm text-gray-400">{inviteError}</p>

          {isExpired && (
            <div className="mb-6 rounded-lg border border-yellow-800/50 bg-yellow-900/20 px-4 py-3">
              <p className="text-sm text-yellow-300">
                Invite links expire after 7 days. Please contact your team administrator to send a new invite.
              </p>
            </div>
          )}

          {isUsed && (
            <div className="mb-6 rounded-lg border border-blue-800/50 bg-blue-900/20 px-4 py-3">
              <p className="text-sm text-blue-300">
                This invite link has already been accepted. If you created your account,{' '}
                <a
                  href="/login"
                  className="underline hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm transition-colors duration-150"
                >
                  sign in here
                </a>
                . Otherwise, contact your admin for a new invite.
              </p>
            </div>
          )}

          {isNotFound && (
            <p className="mb-6 text-sm text-gray-500">
              Double-check the link in your invitation email, or contact your team administrator.
            </p>
          )}

          <a
            href="/login"
            className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  // ── Sign-in failed fallback ────────────────────────────────────────────────
  if (signInFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
        <div
          className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8 text-center shadow-xl"
          role="alert"
          aria-live="assertive"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-900/40" aria-hidden="true">
            <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">Account Created</h1>
          <p className="mb-4 text-sm text-gray-400">
            Your account was created successfully, but we were unable to sign you in automatically.
          </p>
          <p className="mb-6 text-sm text-gray-500">
            Please{' '}
            <a
              href="/login"
              className="text-indigo-400 underline hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-sm transition-colors duration-150"
            >
              sign in manually
            </a>{' '}
            using{' '}
            <span className="font-medium text-gray-300">{inviteData?.email}</span> and the password you just set.
          </p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  // ── Invite form ────────────────────────────────────────────────────────────
  const roleLabel = inviteData?.role
    ? inviteData.role.charAt(0).toUpperCase() + inviteData.role.slice(1)
    : 'Team Member'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
      <div
        className={`w-full max-w-md transition-all duration-300 motion-safe:duration-300 ${
          cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-900/50"
            aria-hidden="true"
          >
            <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">You're Invited!</h1>
          <p className="mt-2 text-sm text-gray-400">
            Join{' '}
            <span className="font-medium text-gray-200">{inviteData?.account_name}</span>
            {' '}as a{' '}
            <span className="font-medium text-indigo-400">{roleLabel}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">{inviteData?.email}</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-xl sm:p-8">
          <h2 className="mb-6 text-lg font-semibold text-white">Create your account</h2>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
            aria-label="Create account form"
          >
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-300">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }))
                }}
                placeholder="Jane Smith"
                autoComplete="name"
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
                className={`w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                  fieldErrors.fullName
                    ? 'border-red-600 focus:border-red-500 focus-visible:ring-red-500'
                    : 'border-gray-700 focus:border-indigo-500 focus-visible:ring-indigo-500'
                }`}
              />
              {fieldErrors.fullName && (
                <p id="fullName-error" className="mt-1.5 text-xs text-red-400" role="alert">
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
                  if (fieldErrors.confirmPassword && e.target.value === confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                  }
                }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                  fieldErrors.password
                    ? 'border-red-600 focus:border-red-500 focus-visible:ring-red-500'
                    : 'border-gray-700 focus:border-indigo-500 focus-visible:ring-indigo-500'
                }`}
              />
              {fieldErrors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-400" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={`w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                  fieldErrors.confirmPassword
                    ? 'border-red-600 focus:border-red-500 focus-visible:ring-red-500'
                    : 'border-gray-700 focus:border-indigo-500 focus-visible:ring-indigo-500'
                }`}
              />
              {fieldErrors.confirmPassword && (
                <p id="confirmPassword-error" className="mt-1.5 text-xs text-red-400" role="alert">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Rate limit error */}
            {rateLimitRetryAfter !== null && (
              <div
                className="rounded-lg border border-yellow-800 bg-yellow-900/30 px-4 py-3"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-yellow-300">{submitError}</p>
                </div>
              </div>
            )}

            {/* Generic submit error */}
            {submitError && rateLimitRetryAfter === null && (
              <div
                className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-sm text-red-400">{submitError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              aria-disabled={submitting}
              aria-label={submitting ? 'Creating your account…' : 'Create Account & Sign In'}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-indigo-600"
            >
              {submitting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>Creating account…</span>
                </>
              ) : (
                'Create Account & Sign In'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-indigo-400 underline hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-sm transition-colors duration-150"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage({ params }) {
  const { token } = params
  return (
    <ToastProvider>
      <InvitePageInner token={token} />
    </ToastProvider>
  )
}