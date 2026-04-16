import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { Resend } from 'resend'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

const MEMBER_SOFT_CAP = 25

/**
 * POST /api/team/invite
 *
 * Admin only. Creates a team invite with a 32-byte random token.
 * Sends invite email via Resend. Returns warning if member count >= 25.
 *
 * Body: { email: string, role: 'admin' | 'editor' | 'viewer' }
 */
export async function POST(req) {
  // Early check for Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error('[team/invite] RESEND_API_KEY is not configured')
    return NextResponse.json(
      { error: 'Email service is not configured — invite functionality unavailable' },
      { status: 503 }
    )
  }

  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, role } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, editor, or viewer' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Check for existing pending invite for same email+account
  const { data: existingInvite } = await serviceClient
    .from('team_invites')
    .select('id, status, expires_at')
    .eq('account_id', authContext.accountId)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    const now = new Date()
    const expiresAt = new Date(existingInvite.expires_at)
    if (now < expiresAt) {
      return NextResponse.json(
        { error: 'A pending invite already exists for this email address' },
        { status: 409 }
      )
    }
  }

  // Count current members (users + pending invites)
  const { count: memberCount } = await serviceClient
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)

  const { count: pendingInviteCount } = await serviceClient
    .from('team_invites')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)
    .eq('status', 'pending')

  const totalCount = (memberCount || 0) + (pendingInviteCount || 0)
  const softCapWarning = totalCount >= MEMBER_SOFT_CAP

  // Generate 32-byte cryptographically random hex token
  const token = crypto.randomBytes(32).toString('hex')

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Insert invite
  const { data: invite, error: insertError } = await serviceClient
    .from('team_invites')
    .insert({
      account_id: authContext.accountId,
      invited_by: authContext.userId,
      email: email.toLowerCase(),
      role,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id, email, role, expires_at')
    .single()

  if (insertError || !invite) {
    console.error('[team/invite] Insert failed:', insertError?.message)
    return NextResponse.json(
      { error: 'Failed to create invite', details: insertError?.message },
      { status: 500 }
    )
  }

  // Send invite email via Resend
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${token}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'RelevantSee <noreply@relevantsee.com>',
      to: email.toLowerCase(),
      subject: `You've been invited to join RelevantSee`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 8px;">You've been invited</h1>
          <p style="color: #6b7280; font-size: 16px; margin-bottom: 24px;">
            You've been invited to join RelevantSee as a <strong>${role}</strong>.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Accept Invitation
          </a>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
            This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 8px;">
            Or copy this link: ${inviteUrl}
          </p>
        </div>
      `,
    })

    if (emailError) {
      console.error('[team/invite] Resend email error:', emailError?.message)
      return NextResponse.json({
        invite: { id: invite.id, email: invite.email, role: invite.role, expires_at: invite.expires_at },
        soft_cap_warning: softCapWarning,
        email_sent: false,
        email_error: 'Failed to send invite email — invite was created but email delivery failed',
      })
    }
  } catch (emailException) {
    console.error('[team/invite] Resend email exception:', emailException?.message)
    // Non-fatal — invite is created, email failure is logged
    return NextResponse.json({
      invite: { id: invite.id, email: invite.email, role: invite.role, expires_at: invite.expires_at },
      soft_cap_warning: softCapWarning,
      email_sent: false,
      email_error: 'Failed to send invite email — invite was created but email delivery failed',
    })
  }

  return NextResponse.json({
    invite: { id: invite.id, email: invite.email, role: invite.role, expires_at: invite.expires_at },
    soft_cap_warning: softCapWarning,
    email_sent: true,
  })
}