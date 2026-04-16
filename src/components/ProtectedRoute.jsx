'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

/**
 * ProtectedRoute
 *
 * Client-side route guard component. Middleware handles the primary
 * server-side auth redirect, so this component only handles optional
 * role-based access control within authenticated routes.
 *
 * Props:
 *   requiredRole: string — e.g. 'admin'. If omitted, any authenticated user is allowed.
 *   allowedRoles: string[] — e.g. ['admin', 'editor']. Alternative to requiredRole.
 *   redirectTo: string — path to redirect unauthorized users (default: '/dashboard')
 *   children: React node
 *   fallback: React node — shown while loading (optional)
 */
export function ProtectedRoute({
  requiredRole,
  allowedRoles,
  redirectTo = '/dashboard',
  children,
  fallback = null,
}) {
  const { role, loading } = useAuth()
  const router = useRouter()

  // Compute effective allowed roles
  const effectiveAllowedRoles = allowedRoles
    ? allowedRoles
    : requiredRole
    ? [requiredRole]
    : null

  useEffect(() => {
    if (loading) return
    if (effectiveAllowedRoles && !effectiveAllowedRoles.includes(role)) {
      router.replace(redirectTo)
    }
  }, [loading, role, effectiveAllowedRoles, redirectTo, router])

  if (loading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        </div>
      )
    )
  }

  if (effectiveAllowedRoles && !effectiveAllowedRoles.includes(role)) {
    return null
  }

  return <>{children}</>
}

/**
 * AdminOnly
 * Convenience wrapper — renders children only for admin role.
 * Non-admins see nothing (or optional fallback).
 */
export function AdminOnly({ children, fallback = null }) {
  const { role, loading } = useAuth()

  if (loading) return null
  if (role !== 'admin') return fallback
  return <>{children}</>
}

/**
 * EditorOrAdmin
 * Convenience wrapper — renders children for admin or editor roles.
 */
export function EditorOrAdmin({ children, fallback = null }) {
  const { role, loading } = useAuth()

  if (loading) return null
  if (!['admin', 'editor'].includes(role)) return fallback
  return <>{children}</>
}

export default ProtectedRoute