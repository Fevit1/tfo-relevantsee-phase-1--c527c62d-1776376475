'use client'

import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

const ROLE_OPTIONS = ['admin', 'editor', 'viewer']

function RoleBadge({ role }) {
  const colors = {
    admin: 'bg-purple-900 text-purple-200 border border-purple-700',
    editor: 'bg-blue-900 text-blue-200 border border-blue-700',
    viewer: 'bg-gray-800 text-gray-300 border border-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[role] || colors.viewer}`}>
      {role}
    </span>
  )
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export default function TeamSettings() {
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [teamData, setTeamData] = useState(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteEmailError, setInviteEmailError] = useState(null)

  // Role update state: { [userId]: 'loading' | string | null }
  const [roleUpdateStatus, setRoleUpdateStatus] = useState({})

  // Remove state: { [userId]: 'loading' | string | null }
  const [removeStatus, setRemoveStatus] = useState({})

  // Confirmation modal state
  const [removeConfirm, setRemoveConfirm] = useState(null) // { userId, email, fullName }

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAccessDenied(false)
    try {
      const res = await fetch('/api/team')
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (res.status === 403) {
        setAccessDenied(true)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load team')
      setTeamData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const validateInviteEmail = (email) => {
    if (!email.trim()) {
      return 'Email address is required.'
    }
    if (!isValidEmail(email)) {
      return 'Please enter a valid email address.'
    }
    const members = teamData?.members || []
    const pendingInvites = teamData?.pending_invites || []
    if (members.some(m => m.email?.toLowerCase() === email.trim().toLowerCase())) {
      return 'This person is already a team member.'
    }
    if (pendingInvites.some(i => i.email?.toLowerCase() === email.trim().toLowerCase())) {
      return 'An invite has already been sent to this email address.'
    }
    return null
  }

  const handleInviteEmailBlur = () => {
    if (inviteEmail) {
      const err = validateInviteEmail(inviteEmail)
      setInviteEmailError(err)
    }
  }

  const handleRoleChange = async (userId, newRole, memberEmail, memberName) => {
    setRoleUpdateStatus(prev => ({ ...prev, [userId]: 'loading' }))
    try {
      const res = await fetch(`/api/team/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (res.status === 403) {
        setRoleUpdateStatus(prev => ({ ...prev, [userId]: null }))
        toast.error('You do not have permission to change roles.', { title: 'Access Denied' })
        return
      }
      if (res.status === 429) {
        setRoleUpdateStatus(prev => ({ ...prev, [userId]: null }))
        toast.warning('Too many requests. Please wait before trying again.', { title: 'Rate Limited' })
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to update role')
      setRoleUpdateStatus(prev => ({ ...prev, [userId]: null }))
      setTeamData(prev => ({
        ...prev,
        members: prev.members.map(m =>
          m.id === userId ? { ...m, role: data.user.role } : m
        ),
      }))
      toast.success(`Role updated to "${newRole}" for ${memberEmail}.`, { title: 'Role Updated' })
    } catch (err) {
      setRoleUpdateStatus(prev => ({ ...prev, [userId]: err.message || 'error' }))
      toast.error(err.message || 'Failed to update role. Please try again.', { title: 'Error' })
    }
  }

  const handleRemoveConfirm = async () => {
    if (!removeConfirm) return
    const { userId, email } = removeConfirm
    setRemoveConfirm(null)
    setRemoveStatus(prev => ({ ...prev, [userId]: 'loading' }))
    try {
      const res = await fetch(`/api/team/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (res.status === 403) {
        setRemoveStatus(prev => ({ ...prev, [userId]: null }))
        toast.error('You do not have permission to remove team members.', { title: 'Access Denied' })
        return
      }
      if (res.status === 429) {
        setRemoveStatus(prev => ({ ...prev, [userId]: null }))
        toast.warning('Too many requests. Please wait before trying again.', { title: 'Rate Limited' })
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to remove user')
      setRemoveStatus(prev => ({ ...prev, [userId]: null }))
      setTeamData(prev => ({
        ...prev,
        members: prev.members.filter(m => m.id !== userId),
        member_count: Math.max(0, (prev.member_count || 1) - 1),
        total_count: Math.max(0, (prev.total_count || 1) - 1),
        soft_cap_warning: (Math.max(0, (prev.total_count || 1) - 1)) >= 25,
      }))
      toast.success(`${email} has been removed from the team.`, { title: 'Member Removed' })
    } catch (err) {
      setRemoveStatus(prev => ({ ...prev, [userId]: err.message || 'error' }))
      toast.error(err.message || 'Failed to remove member. Please try again.', { title: 'Error' })
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    const validationError = validateInviteEmail(inviteEmail)
    if (validationError) {
      setInviteEmailError(validationError)
      return
    }
    setInviteEmailError(null)
    setInviteLoading(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (res.status === 403) {
        toast.error('You do not have permission to send invites.', { title: 'Access Denied' })
        return
      }
      if (res.status === 429) {
        toast.warning('Too many requests. Please wait before trying again.', { title: 'Rate Limited' })
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to send invite')

      if (data.email_sent) {
        toast.success(`Invite sent to ${data.invite.email}.`, { title: 'Invite Sent' })
      } else {
        toast.warning(
          `Invite created for ${data.invite.email}, but email delivery failed. Share the invite link manually.`,
          { title: 'Invite Created' }
        )
      }

      setInviteEmail('')
      setInviteRole('editor')
      setInviteEmailError(null)
      fetchTeam()
    } catch (err) {
      toast.error(err.message || 'Failed to send invite. Please try again.', { title: 'Invite Failed' })
    } finally {
      setInviteLoading(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
          </div>

          {/* Desktop skeleton table */}
          <div className="hidden sm:block rounded-lg border border-gray-800 overflow-hidden">
            <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex gap-4">
              <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-12 bg-gray-800 rounded animate-pulse ml-auto" />
              <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-800/60 last:border-0">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-gray-800 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-800 rounded-full animate-pulse" />
                <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
                <div className="h-7 w-20 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Mobile skeleton cards */}
          <div className="sm:hidden space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
                    <div className="h-3 w-44 bg-gray-800 rounded animate-pulse" />
                  </div>
                  <div className="h-6 w-16 bg-gray-800 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-800/60">
                  <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-7 w-24 bg-gray-800 rounded animate-pulse" />
                    <div className="h-7 w-16 bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  // ── Access denied state ───────────────────────────────────
  if (accessDenied) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-lg bg-red-900/30 border border-red-700 p-6 text-center">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-red-200 font-semibold text-lg mb-1">Admin Access Required</p>
            <p className="text-red-400 text-sm">Team management is only available to administrators.</p>
          </div>
        </div>
      </Layout>
    )
  }

  // ── Error state ───────────────────────────────────────────
  if (error) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-lg bg-red-900/30 border border-red-700 p-4 text-red-300">
            <p className="font-medium">Error loading team</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchTeam}
              className="mt-3 text-sm text-red-300 underline hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded transition-colors duration-150"
            >
              Try again
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const members = teamData?.members || []
  const pendingInvites = teamData?.pending_invites || []
  const softCapWarning = teamData?.soft_cap_warning || false

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {teamData?.member_count || 0} member{(teamData?.member_count || 0) !== 1 ? 's' : ''}
            {teamData?.pending_invite_count > 0 && ` · ${teamData.pending_invite_count} pending invite${teamData.pending_invite_count !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Soft-cap warning */}
        {softCapWarning && (
          <div className="rounded-lg bg-yellow-900/30 border border-yellow-700 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-yellow-300 font-medium text-sm">Team size limit approaching</p>
                <p className="text-yellow-400/80 text-sm mt-0.5">
                  Your team has reached {teamData?.total_count} members (including pending invites). Contact support to increase your limit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Members */}
        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="text-lg font-semibold text-white mb-4">Members</h2>
          {members.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-8 text-center">
              <svg className="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 text-sm font-medium">No team members yet</p>
              <p className="text-gray-600 text-xs mt-1">Invite your first team member below.</p>
            </div>
          ) : (
            <>
              {/* ── Desktop table (sm and up) ── */}
              <div className="hidden sm:block rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900">
                      <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Member</th>
                      <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
                      <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Joined</th>
                      <th scope="col" className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {members.map((member) => (
                      <tr
                        key={member.id}
                        className="bg-gray-900/50 hover:bg-gray-800 transition-colors duration-150"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{member.full_name || '—'}</p>
                            <p className="text-gray-400">{member.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(member.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value, member.email, member.full_name)}
                              aria-label={`Change role for ${member.full_name || member.email}`}
                              disabled={roleUpdateStatus[member.id] === 'loading'}
                              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            {roleUpdateStatus[member.id] === 'loading' && (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500 flex-shrink-0" aria-hidden="true" />
                            )}
                            <button
                              onClick={() => setRemoveConfirm({ userId: member.id, email: member.email, fullName: member.full_name })}
                              aria-label={`Remove ${member.full_name || member.email} from team`}
                              disabled={removeStatus[member.id] === 'loading'}
                              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 px-2 py-1 rounded hover:bg-red-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
                            >
                              {removeStatus[member.id] === 'loading' ? (
                                <span className="flex items-center gap-1">
                                  <div className="h-3 w-3 animate-spin rounded-full border border-red-400/40 border-t-red-400" aria-hidden="true" />
                                  Removing…
                                </span>
                              ) : 'Remove'}
                            </button>
                          </div>
                          {removeStatus[member.id] && removeStatus[member.id] !== 'loading' && (
                            <p className="text-xs text-red-400 text-right mt-1" role="alert">{removeStatus[member.id]}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile card list (below sm) ── */}
              <div className="sm:hidden space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3"
                  >
                    {/* Top row: identity + badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{member.full_name || '—'}</p>
                        <p className="text-gray-400 text-sm truncate">{member.email}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          Joined {new Date(member.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <RoleBadge role={member.role} />
                    </div>

                    {/* Bottom row: role select + remove */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-800/60">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value, member.email, member.full_name)}
                        aria-label={`Change role for ${member.full_name || member.email}`}
                        disabled={roleUpdateStatus[member.id] === 'loading'}
                        className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {roleUpdateStatus[member.id] === 'loading' && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500 flex-shrink-0" aria-hidden="true" />
                      )}
                      <button
                        onClick={() => setRemoveConfirm({ userId: member.id, email: member.email, fullName: member.full_name })}
                        aria-label={`Remove ${member.full_name || member.email} from team`}
                        disabled={removeStatus[member.id] === 'loading'}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 px-3 py-1.5 rounded hover:bg-red-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 border border-red-900/40 whitespace-nowrap"
                      >
                        {removeStatus[member.id] === 'loading' ? (
                          <span className="flex items-center gap-1">
                            <div className="h-3 w-3 animate-spin rounded-full border border-red-400/40 border-t-red-400" aria-hidden="true" />
                            Removing…
                          </span>
                        ) : 'Remove'}
                      </button>
                    </div>
                    {removeStatus[member.id] && removeStatus[member.id] !== 'loading' && (
                      <p className="text-xs text-red-400 mt-1" role="alert">{removeStatus[member.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <section aria-labelledby="invites-heading">
            <h2 id="invites-heading" className="text-lg font-semibold text-white mb-4">Pending Invites</h2>

            {/* Desktop table */}
            <div className="hidden sm:block rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900">
                    <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                    <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
                    <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Expires</th>
                    <th scope="col" className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {pendingInvites.map((invite) => {
                    const isExpired = new Date(invite.expires_at) < new Date()
                    return (
                      <tr key={invite.id} className="bg-gray-900/50 hover:bg-gray-800 transition-colors duration-150">
                        <td className="px-4 py-3 text-gray-300">{invite.email}</td>
                        <td className="px-4 py-3">
                          <RoleBadge role={invite.role} />
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(invite.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isExpired
                              ? 'bg-red-900/40 text-red-300 border border-red-700/50'
                              : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50'
                          }`}>
                            {isExpired ? 'Expired' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {pendingInvites.map((invite) => {
                const isExpired = new Date(invite.expires_at) < new Date()
                return (
                  <div key={invite.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-gray-300 text-sm truncate">{invite.email}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          Expires {new Date(invite.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <RoleBadge role={invite.role} />
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isExpired
                            ? 'bg-red-900/40 text-red-300 border border-red-700/50'
                            : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50'
                        }`}>
                          {isExpired ? 'Expired' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Invite Form */}
        <section aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="text-lg font-semibold text-white mb-4">Invite Team Member</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:p-6">
            <form onSubmit={handleInvite} noValidate>
              {/* Email field — full width on mobile */}
              <div className="w-full mb-3">
                <label htmlFor="invite-email" className="block text-xs font-medium text-gray-400 mb-1">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    if (inviteEmailError) setInviteEmailError(null)
                  }}
                  onBlur={handleInviteEmailBlur}
                  placeholder="colleague@company.com"
                  required
                  autoComplete="email"
                  className={`w-full bg-gray-800 border text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 focus:border-transparent placeholder-gray-600 transition-colors duration-150 ${
                    inviteEmailError
                      ? 'border-red-600 focus-visible:ring-red-500'
                      : 'border-gray-700 focus-visible:ring-indigo-500'
                  }`}
                />
                {inviteEmailError && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1" role="alert">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    {inviteEmailError}
                  </p>
                )}
              </div>

              {/* Role + button row — stacked on mobile, inline on sm+ */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-auto">
                  <label htmlFor="invite-role" className="block text-xs font-medium text-gray-400 mb-1">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    aria-label="Select role for new team member"
                    className="w-full sm:w-auto bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 focus:border-transparent transition-colors duration-150 h-[38px] cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:flex sm:items-end">
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors duration-150 h-[38px] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 motion-reduce:transition-none"
                  >
                    {inviteLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white flex-shrink-0" aria-hidden="true" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      'Send Invite'
                    )}
                  </button>
                </div>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-4">
              The invited person will receive an email with a link to accept the invitation. Invites expire after 7 days.
            </p>
          </div>
        </section>
      </div>

      {/* Remove Confirmation Modal */}
      <Modal
        open={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        title="Remove team member?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Are you sure you want to remove{' '}
            <span className="text-white font-medium">
              {removeConfirm?.fullName ? `${removeConfirm.fullName} (${removeConfirm.email})` : removeConfirm?.email}
            </span>{' '}
            from the team? They will immediately lose access to all campaigns and settings.
          </p>
          <p className="text-gray-500 text-xs">This action cannot be undone.</p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-1">
            <button
              onClick={() => setRemoveConfirm(null)}
              className="w-full sm:w-auto px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveConfirm}
              className="w-full sm:w-auto px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-lg transition-colors duration-150 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
            >
              Remove Member
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}