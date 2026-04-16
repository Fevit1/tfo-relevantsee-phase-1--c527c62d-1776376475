import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getAuthenticatedUser
 *
 * The single auth gate for all API route handlers.
 * 1. Validates the Supabase session server-side via createClient() from @/lib/supabase/server.
 * 2. Fetches the user's role from the `users` table — NEVER from JWT claims.
 * 3. Returns { user, role, accountId, userId } on success, throws on failure.
 *
 * Usage in API route handlers:
 *   const { user, role, accountId } = await getAuthenticatedUser()
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser()

  if (sessionError || !user) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }

  // Fetch role and account info from DB — never trust JWT claims for role
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, account_id, role, full_name, email')
    .eq('id', user.id)
    .single()

  if (userError || !dbUser) {
    const err = new Error('User record not found')
    err.status = 403
    throw err
  }

  return {
    user: dbUser,
    role: dbUser.role,
    accountId: dbUser.account_id,
    userId: dbUser.id,
  }
}

/**
 * requireRole
 *
 * Role guard factory. Returns a function that wraps an API handler,
 * enforcing that the authenticated user has one of the allowed roles.
 *
 * Usage:
 *   export const POST = requireRole(['admin', 'editor'])(async (req, context) => { ... })
 */
export function requireRole(allowedRoles) {
  return function (handler) {
    return async function (req, context) {
      let authContext
      try {
        authContext = await getAuthenticatedUser()
      } catch (err) {
        return Response.json(
          { error: err.message || 'Unauthorized' },
          { status: err.status || 401 }
        )
      }

      if (!allowedRoles.includes(authContext.role)) {
        return Response.json(
          { error: 'Forbidden — insufficient role' },
          { status: 403 }
        )
      }

      // Attach auth context to request for handler use
      req.authContext = authContext
      return handler(req, context)
    }
  }
}

/**
 * requireAdmin
 * Convenience wrapper — admin-only routes.
 */
export const requireAdmin = requireRole(['admin'])

/**
 * requireAdminOrEditor
 * Convenience wrapper — admin or editor routes.
 */
export const requireAdminOrEditor = requireRole(['admin', 'editor'])

/**
 * requireAnyRole
 * Convenience wrapper — any authenticated user with a valid role.
 */
export const requireAnyRole = requireRole(['admin', 'editor', 'viewer'])

/**
 * getSessionUser
 *
 * Lightweight session check for middleware use.
 * Returns the Supabase auth user or null.
 */
export async function getSessionUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user || null
  } catch {
    return null
  }
}

/**
 * signOut
 * Server-side sign out helper.
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}