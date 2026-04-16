'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
})

const resetSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

/**
 * Login
 *
 * Email/password sign-in only — no self-signup (invite-only platform).
 * Handles forgot password via Supabase reset email.
 *
 * Designed for use at /login route.
 * On success, redirects to /dashboard.
 */
export function Login() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const toast = useToast()

  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [authError, setAuthError] = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })

  const handleSignIn = async (values) => {
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        const msg = error.message || ''
        const status = error.status

        if (
          status === 429 ||
          msg.toLowerCase().includes('too many requests') ||
          msg.toLowerCase().includes('rate limit')
        ) {
          setAuthError('Too many login attempts. Please wait a moment and try again.')
          return
        }

        if (
          status === 401 ||
          msg.toLowerCase().includes('invalid login credentials') ||
          msg.toLowerCase().includes('invalid_credentials') ||
          msg.toLowerCase().includes('wrong password') ||
          msg.toLowerCase().includes('user not found')
        ) {
          setAuthError('Incorrect email or password. Please try again.')
          return
        }

        if (
          msg.toLowerCase().includes('email not confirmed') ||
          msg.toLowerCase().includes('not confirmed')
        ) {
          setAuthError('Please verify your email address before signing in.')
          return
        }

        if (status === 403) {
          setAuthError('Access denied. Your account may have been disabled.')
          return
        }

        setAuthError(msg || 'Sign in failed. Please try again.')
        toast.error(msg || 'Sign in failed. Please try again.', {
          title: 'Authentication error',
        })
        return
      }

      toast.success('Signed in successfully.', { title: 'Welcome back' })
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      const message = 'An unexpected error occurred. Please try again.'
      setAuthError(message)
      toast.error(message, { title: 'Unexpected error' })
      console.error('[Login] Sign in error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordReset = async (values) => {
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (error) {
        const msg = error.message || ''
        const status = error.status

        if (
          status === 429 ||
          msg.toLowerCase().includes('too many requests') ||
          msg.toLowerCase().includes('rate limit')
        ) {
          setAuthError('Too many requests. Please wait before requesting another reset link.')
          return
        }

        setAuthError(msg || 'Failed to send reset email. Please try again.')
        toast.error(msg || 'Failed to send reset email. Please try again.', {
          title: 'Reset failed',
        })
        return
      }

      setResetSent(true)
    } catch (err) {
      const message = 'An unexpected error occurred. Please try again.'
      setAuthError(message)
      toast.error(message, { title: 'Unexpected error' })
      console.error('[Login] Password reset error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Shared input class builder
  const inputClass = (hasError) =>
    [
      'w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500',
      'transition-colors duration-150',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
      'disabled:cursor-not-allowed disabled:opacity-60',
      hasError
        ? 'border-red-700 focus-visible:ring-red-500'
        : 'border-gray-700 hover:border-gray-600 focus-visible:border-indigo-500',
    ].join(' ')

  const primaryButtonClass =
    'w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white ' +
    'transition-all duration-150 ' +
    'hover:bg-indigo-500 active:scale-[0.98] ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ' +
    'motion-reduce:transition-none motion-reduce:active:scale-100'

  const secondaryButtonClass =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 ' +
    'transition-all duration-150 ' +
    'hover:bg-gray-700 hover:border-gray-600 active:scale-[0.98] ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ' +
    'motion-reduce:transition-none motion-reduce:active:scale-100'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Logo / Branding */}
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            RelevantSee
          </h1>
          <p className="mt-1 text-sm text-gray-400">AI Marketing Campaign Copilot</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 sm:p-8 shadow-2xl">
          {mode === 'login' ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Sign in</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Enter your credentials to access your account
                </p>
              </div>

              <form
                onSubmit={loginForm.handleSubmit(handleSignIn)}
                noValidate
                aria-label="Sign in form"
                className="space-y-5"
              >
                {/* Global auth error */}
                {authError && (
                  <div
                    id="login-error"
                    role="alert"
                    aria-live="assertive"
                    className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3"
                  >
                    <p className="text-sm text-red-400">{authError}</p>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-email"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={!!loginForm.formState.errors.email}
                    aria-describedby={
                      loginForm.formState.errors.email
                        ? 'login-email-error'
                        : authError
                        ? 'login-error'
                        : undefined
                    }
                    {...loginForm.register('email')}
                    className={inputClass(!!loginForm.formState.errors.email)}
                    placeholder="you@company.com"
                  />
                  {loginForm.formState.errors.email && (
                    <p
                      id="login-email-error"
                      className="text-xs text-red-400"
                      role="alert"
                    >
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset')
                        setAuthError(null)
                        loginForm.reset()
                      }}
                      className="text-xs text-indigo-400 transition-colors duration-150 hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 rounded motion-reduce:transition-none"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={!!loginForm.formState.errors.password}
                    aria-describedby={
                      loginForm.formState.errors.password
                        ? 'login-password-error'
                        : undefined
                    }
                    {...loginForm.register('password')}
                    className={inputClass(!!loginForm.formState.errors.password)}
                    placeholder="••••••••"
                  />
                  {loginForm.formState.errors.password && (
                    <p
                      id="login-password-error"
                      className="text-xs text-red-400"
                      role="alert"
                    >
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  aria-label={isSubmitting ? 'Signing in, please wait' : 'Sign in'}
                  className={primaryButtonClass}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden="true"
                      />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              {/* No self-signup notice */}
              <p className="mt-6 text-center text-xs text-gray-500">
                Don&apos;t have an account?{' '}
                <span className="text-gray-400">
                  Contact your account administrator for an invitation.
                </span>
              </p>
            </>
          ) : (
            <>
              {/* Password Reset Mode */}
              <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Reset password
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Enter your email to receive a password reset link
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-4">
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-lg border border-green-800 bg-green-950/50 px-4 py-3"
                  >
                    <p className="text-sm text-green-400">
                      If an account exists for that email, a reset link has been sent.
                      Please check your inbox.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setResetSent(false)
                      setAuthError(null)
                      resetForm.reset()
                    }}
                    className={secondaryButtonClass}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={resetForm.handleSubmit(handlePasswordReset)}
                  noValidate
                  aria-label="Password reset form"
                  className="space-y-5"
                >
                  {authError && (
                    <div
                      id="reset-error"
                      role="alert"
                      aria-live="assertive"
                      className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3"
                    >
                      <p className="text-sm text-red-400">{authError}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="reset-email"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={!!resetForm.formState.errors.email}
                      aria-describedby={
                        resetForm.formState.errors.email
                          ? 'reset-email-error'
                          : authError
                          ? 'reset-error'
                          : undefined
                      }
                      {...resetForm.register('email')}
                      className={inputClass(!!resetForm.formState.errors.email)}
                      placeholder="you@company.com"
                    />
                    {resetForm.formState.errors.email && (
                      <p
                        id="reset-email-error"
                        className="text-xs text-red-400"
                        role="alert"
                      >
                        {resetForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    aria-label={
                      isSubmitting ? 'Sending reset link, please wait' : 'Send reset link'
                    }
                    className={primaryButtonClass}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          aria-hidden="true"
                        />
                        Sending…
                      </span>
                    ) : (
                      'Send reset link'
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setMode('login')
                      setAuthError(null)
                      resetForm.reset()
                    }}
                    className={secondaryButtonClass}
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-gray-600">
          &copy; {new Date().getFullYear()} RelevantSee. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default Login