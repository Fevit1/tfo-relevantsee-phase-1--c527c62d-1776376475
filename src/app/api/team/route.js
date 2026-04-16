import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/team
 *
 * Admin only. Returns current team members and pending invites for the account.
 * Includes member count for soft-cap logic.
 */
export async function GET(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  // Fetch team members filtered by account_id
  const { data: members, error: membersError } = await serviceClient
    .from('users')
    .select('id, email, role, full_name, created_at')
    .eq('account_id', authContext.accountId)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('[team] Members fetch failed:', membersError?.message)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }

  // Fetch pending invites filtered by account_id and status='pending'
  const { data: pendingInvites, error: invitesError } = await serviceClient
    .from('team_invites')
    .select('id, email, role, status, created_at, expires_at, invited_by')
    .eq('account_id', authContext.accountId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (invitesError) {
    console.error('[team] Invites fetch failed:', invitesError?.message)
    return NextResponse.json({ error: 'Failed to fetch pending invites' }, { status: 500 })
  }

  const memberCount = members?.length ?? 0
  const pendingInviteCount = pendingInvites?.length ?? 0
  const totalCount = memberCount + pendingInviteCount

  return NextResponse.json({
    members: members ?? [],
    pending_invites: pendingInvites ?? [],
    member_count: memberCount,
    pending_invite_count: pendingInviteCount,
    total_count: totalCount,
    soft_cap_warning: totalCount >= 25,
  })
}