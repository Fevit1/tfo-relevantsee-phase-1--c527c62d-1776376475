import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/team/invite/[token]
 *
 * Public endpoint — validates invite token.
 * Uses service role client since the requester is unauthenticated.
 * Returns 404 for invalid/not-found tokens.
 * Returns 410 for accepted or expired tokens.
 * Returns { account_name, role, email } on success.
 */
export async function GET(req, { params }) {
  const { token } = params

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  let serviceClient
  try {
    serviceClient = createServiceClient()
  } catch (err) {
    console.error('Service client creation failed:', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { data: invite, error } = await serviceClient
    .from('team_invites')
    .select('id, account_id, email, role, status, expires_at, accounts(name)')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  // Check if already accepted
  if (invite.status === 'accepted') {
    return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 410 })
  }

  // Check expiry
  const now = new Date()
  const expiresAt = new Date(invite.expires_at)

  if (invite.status === 'expired' || now > expiresAt) {
    // Mark as expired if not already updated
    if (invite.status !== 'expired') {
      await serviceClient
        .from('team_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
    }
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  return NextResponse.json({
    account_name: invite.accounts?.name ?? 'Unknown Account',
    role: invite.role,
    email: invite.email,
  })
}