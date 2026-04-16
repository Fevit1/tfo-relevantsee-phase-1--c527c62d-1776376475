'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBrandModel, updateBrandModel } from '@/lib/api'
import { TagInput } from '@/components/ui/TagInput'
import Layout from '@/components/Layout'
import { useToast } from '@/components/ui/Toast'

const BRAND_VOICE_MAX = 1000
const TONE_KEYWORDS_MAX = 20
const BANNED_PHRASES_MAX = 50

const inputBase =
  'w-full rounded-lg border bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900'

const inputBorder = (hasError, readOnly) =>
  [
    hasError ? 'border-red-600' : 'border-gray-700 hover:border-gray-600',
    readOnly ? 'cursor-not-allowed opacity-70' : '',
  ]
    .filter(Boolean)
    .join(' ')

export default function SettingsPage() {
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [firstRun, setFirstRun] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)

  const [name, setName] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [toneKeywords, setToneKeywords] = useState([])
  const [bannedPhrases, setBannedPhrases] = useState([])
  const [exampleContent, setExampleContent] = useState(['', '', ''])
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6366f1')

  // Validation errors
  const [logoUrlError, setLogoUrlError] = useState(null)
  const [brandVoiceError, setBrandVoiceError] = useState(null)
  const [nameError, setNameError] = useState(null)

  useEffect(() => {
    async function loadBrandModel() {
      try {
        setLoading(true)
        setError(null)
        const data = await getBrandModel()
        const account = data.account
        setFirstRun(data.first_run)
        setName(account.name || '')
        setBrandVoice(account.brand_voice || '')
        setToneKeywords(account.tone_keywords || [])
        setBannedPhrases(account.banned_phrases || [])
        const examples = account.example_content || []
        const filled = [...examples.map(e => (typeof e === 'string' ? e : JSON.stringify(e))), '', '', ''].slice(0, 3)
        setExampleContent(filled)
        setLogoUrl(account.logo_url || '')
        setPrimaryColor(account.primary_color || '#6366f1')
      } catch (err) {
        if (err.status === 403 || err.status === 401) {
          setIsReadOnly(true)
          setError('Admin access required to edit brand settings. You can view settings in read-only mode.')
        } else if (err.status === 429) {
          setError('Too many requests. Please wait a moment and try again.')
        } else {
          setError(err.message || 'Failed to load brand settings. Please refresh the page.')
        }
      } finally {
        setLoading(false)
      }
    }
    loadBrandModel()
  }, [])

  function validateLogoUrl(url) {
    if (!url) return true
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  function handleLogoUrlChange(val) {
    setLogoUrl(val)
    if (val && !validateLogoUrl(val)) {
      setLogoUrlError('Logo URL must be a valid HTTPS URL')
    } else {
      setLogoUrlError(null)
    }
  }

  function handleBrandVoiceChange(val) {
    setBrandVoice(val)
    if (val.length > BRAND_VOICE_MAX) {
      setBrandVoiceError(`Brand voice description must be ${BRAND_VOICE_MAX} characters or fewer (currently ${val.length})`)
    } else {
      setBrandVoiceError(null)
    }
  }

  function handleNameChange(val) {
    setName(val)
    if (!val.trim()) {
      setNameError('Brand name is required')
    } else {
      setNameError(null)
    }
  }

  function validateForm() {
    let valid = true
    if (!name.trim()) {
      setNameError('Brand name is required')
      valid = false
    }
    if (logoUrl && !validateLogoUrl(logoUrl)) {
      setLogoUrlError('Logo URL must be a valid HTTPS URL')
      valid = false
    }
    if (brandVoice.length > BRAND_VOICE_MAX) {
      setBrandVoiceError(`Brand voice description must be ${BRAND_VOICE_MAX} characters or fewer`)
      valid = false
    }
    return valid
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (isReadOnly) return
    if (!validateForm()) {
      toast.error('Please fix the errors before saving.', { title: 'Validation Error' })
      return
    }

    const filteredExamples = exampleContent.filter(s => s.trim() !== '')
    setSaving(true)
    try {
      const data = await updateBrandModel({
        name,
        brand_voice: brandVoice,
        tone_keywords: toneKeywords,
        banned_phrases: bannedPhrases,
        example_content: filteredExamples,
        logo_url: logoUrl || null,
        primary_color: primaryColor || null,
      })
      setFirstRun(data.first_run)
      toast.success('Brand settings saved successfully.', { title: 'Settings Saved' })
    } catch (err) {
      if (err.status === 403 || err.status === 401) {
        setIsReadOnly(true)
        toast.error('You do not have permission to update brand settings. Admin access required.', { title: 'Access Denied' })
      } else if (err.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.', { title: 'Rate Limited' })
      } else {
        toast.error(err.message || 'Failed to save brand settings. Please try again.', { title: 'Save Failed' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
          <p className="text-sm text-gray-500">Loading brand settings…</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-10">
        {/* Page header */}
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Brand Settings</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure your brand model to guide AI content generation and scoring.
          </p>
        </header>

        {/* Read-only banner */}
        {isReadOnly && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-yellow-700 bg-yellow-950/50 p-4 flex items-start gap-3"
          >
            <svg
              className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-200">Read-Only Mode</p>
              <p className="text-sm text-yellow-300 mt-0.5">
                Admin access required to edit brand settings. Contact your account administrator.
              </p>
            </div>
          </div>
        )}

        {/* Generic error banner (non read-only errors) */}
        {error && !isReadOnly && (
          <div role="alert" className="mb-5 rounded-lg border border-red-700 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* First run welcome */}
        {firstRun && !isReadOnly && (
          <div className="mb-6 rounded-xl border border-indigo-700 bg-indigo-950/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">🚀</span>
              <div>
                <h2 className="text-base font-semibold text-indigo-200">Welcome! Set up your Brand Model</h2>
                <p className="text-sm text-indigo-300 mt-1">
                  You haven't configured your brand voice yet. Fill in the fields below to teach the AI how to write
                  for your brand. Your brand voice, tone keywords, and banned phrases will shape every campaign
                  generated in your account.
                </p>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 sm:space-y-8"
          noValidate
          aria-label="Brand settings form"
        >
          {/* ── Brand Identity ─────────────────────────────── */}
          <fieldset
            className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-6 space-y-5"
            aria-label="Brand identity settings"
          >
            <legend className="sr-only">Brand Identity</legend>
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider" aria-hidden="true">
              Brand Identity
            </h2>

            {/* Brand Name */}
            <div>
              <label htmlFor="brand-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                Brand Name{!isReadOnly && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
              </label>
              <input
                id="brand-name"
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                required={!isReadOnly}
                readOnly={isReadOnly}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'name-error' : undefined}
                aria-required={!isReadOnly}
                className={`${inputBase} ${inputBorder(!!nameError, isReadOnly)}`}
                placeholder="Your company or brand name"
              />
              {nameError && (
                <p id="name-error" role="alert" className="mt-1 text-xs text-red-400">
                  {nameError}
                </p>
              )}
            </div>

            {/* Logo URL */}
            <div>
              <label htmlFor="logo-url" className="block text-sm font-medium text-gray-300 mb-1.5">
                Logo URL
              </label>
              <input
                id="logo-url"
                type="url"
                value={logoUrl}
                onChange={e => handleLogoUrlChange(e.target.value)}
                readOnly={isReadOnly}
                aria-invalid={!!logoUrlError}
                aria-describedby={logoUrlError ? 'logo-error' : 'logo-hint'}
                className={`${inputBase} ${inputBorder(!!logoUrlError, isReadOnly)}`}
                placeholder="https://example.com/logo.png"
              />
              {logoUrlError ? (
                <p id="logo-error" role="alert" className="mt-1 text-xs text-red-400">
                  {logoUrlError}
                </p>
              ) : (
                <p id="logo-hint" className="mt-1 text-xs text-gray-500">
                  Must be an HTTPS URL. Used for brand assets in generated content.
                </p>
              )}
            </div>

            {/* Primary Color */}
            <div>
              <p className="block text-sm font-medium text-gray-300 mb-1.5" id="primary-color-label">
                Primary Color
              </p>
              <div className="flex items-center gap-3" role="group" aria-labelledby="primary-color-label">
                <label htmlFor="color-picker" className="sr-only">
                  Pick primary color
                </label>
                <input
                  id="color-picker"
                  type="color"
                  value={primaryColor || '#6366f1'}
                  onChange={e => setPrimaryColor(e.target.value)}
                  disabled={isReadOnly}
                  aria-label="Primary color picker"
                  className={[
                    'h-9 w-14 rounded-md border border-gray-700 bg-gray-800 p-0.5 transition-colors duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900',
                    isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-gray-600',
                  ].join(' ')}
                />
                <label htmlFor="color-hex" className="sr-only">
                  Primary color hex value
                </label>
                <input
                  id="color-hex"
                  type="text"
                  value={primaryColor || ''}
                  onChange={e => setPrimaryColor(e.target.value)}
                  readOnly={isReadOnly}
                  aria-label="Primary color hex code"
                  aria-describedby="color-hint"
                  className={`w-32 ${inputBase} ${inputBorder(false, isReadOnly)}`}
                  placeholder="#6366f1"
                  pattern="^#[0-9A-Fa-f]{3,8}$"
                />
              </div>
              <p id="color-hint" className="mt-1 text-xs text-gray-500">
                Hex color code (e.g. #FF5733)
              </p>
            </div>
          </fieldset>

          {/* ── Brand Voice ───────────────────────────────── */}
          <fieldset
            className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-6 space-y-5"
            aria-label="Brand voice settings"
          >
            <legend className="sr-only">Brand Voice</legend>
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider" aria-hidden="true">
              Brand Voice
            </h2>

            {/* Brand Voice Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="brand-voice" className="block text-sm font-medium text-gray-300">
                  Brand Voice Description
                </label>
                <span
                  className={`text-xs tabular-nums ${
                    brandVoice.length > BRAND_VOICE_MAX
                      ? 'text-red-400 font-semibold'
                      : brandVoice.length > BRAND_VOICE_MAX * 0.9
                      ? 'text-yellow-400'
                      : 'text-gray-500'
                  }`}
                  aria-live="polite"
                  aria-label={`${brandVoice.length} of ${BRAND_VOICE_MAX} characters used`}
                >
                  {brandVoice.length} / {BRAND_VOICE_MAX}
                </span>
              </div>
              <textarea
                id="brand-voice"
                value={brandVoice}
                onChange={e => handleBrandVoiceChange(e.target.value)}
                readOnly={isReadOnly}
                rows={4}
                aria-invalid={!!brandVoiceError}
                aria-describedby={brandVoiceError ? 'brand-voice-error' : 'brand-voice-hint'}
                className={`${inputBase} resize-y ${inputBorder(!!brandVoiceError, isReadOnly)}`}
                placeholder="Describe your brand's voice, personality, and communication style. For example: 'We are professional yet approachable, use clear and concise language, avoid jargon, and always lead with value for the customer.'"
              />
              {brandVoiceError ? (
                <p id="brand-voice-error" role="alert" className="mt-1 text-xs text-red-400">
                  {brandVoiceError}
                </p>
              ) : (
                <p id="brand-voice-hint" className="mt-1 text-xs text-gray-500">
                  This description guides the AI when generating campaign content. Be as specific as possible. Max{' '}
                  {BRAND_VOICE_MAX} characters.
                </p>
              )}
            </div>

            {/* Tone Keywords */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tone-keywords-input" className="block text-sm font-medium text-gray-300">
                  Tone Keywords
                </label>
                <span
                  className={`text-xs tabular-nums ${
                    toneKeywords.length >= TONE_KEYWORDS_MAX ? 'text-yellow-400 font-semibold' : 'text-gray-500'
                  }`}
                  aria-live="polite"
                  aria-label={`${toneKeywords.length} of ${TONE_KEYWORDS_MAX} tone keywords added`}
                >
                  {toneKeywords.length} / {TONE_KEYWORDS_MAX}
                </span>
              </div>
              {isReadOnly ? (
                <div
                  className="flex flex-wrap gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 min-h-[42px]"
                  aria-label="Tone keywords (read only)"
                >
                  {toneKeywords.length === 0 ? (
                    <span className="text-sm text-gray-500">No tone keywords set</span>
                  ) : (
                    toneKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-indigo-900/60 px-2.5 py-0.5 text-xs font-medium text-indigo-200 border border-indigo-700"
                      >
                        {kw}
                      </span>
                    ))
                  )}
                </div>
              ) : (
                <TagInput
                  value={toneKeywords}
                  onChange={setToneKeywords}
                  placeholder="Type a keyword and press Enter"
                  maxItems={TONE_KEYWORDS_MAX}
                  aria-label="Tone keywords"
                  aria-describedby="tone-keywords-hint"
                />
              )}
              <p id="tone-keywords-hint" className="mt-1 text-xs text-gray-500">
                Words that describe your brand tone (e.g. "innovative", "trustworthy", "playful"). Press Enter or
                comma to add.
              </p>
            </div>

            {/* Banned Phrases */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="banned-phrases-input" className="block text-sm font-medium text-gray-300">
                  Banned Phrases
                </label>
                <span
                  className={`text-xs tabular-nums ${
                    bannedPhrases.length >= BANNED_PHRASES_MAX ? 'text-yellow-400 font-semibold' : 'text-gray-500'
                  }`}
                  aria-live="polite"
                  aria-label={`${bannedPhrases.length} of ${BANNED_PHRASES_MAX} banned phrases added`}
                >
                  {bannedPhrases.length} / {BANNED_PHRASES_MAX}
                </span>
              </div>
              {isReadOnly ? (
                <div
                  className="flex flex-wrap gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 min-h-[42px]"
                  aria-label="Banned phrases (read only)"
                >
                  {bannedPhrases.length === 0 ? (
                    <span className="text-sm text-gray-500">No banned phrases set</span>
                  ) : (
                    bannedPhrases.map((phrase, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-red-900/60 px-2.5 py-0.5 text-xs font-medium text-red-200 border border-red-700"
                      >
                        {phrase}
                      </span>
                    ))
                  )}
                </div>
              ) : (
                <TagInput
                  value={bannedPhrases}
                  onChange={setBannedPhrases}
                  placeholder="Type a phrase and press Enter"
                  maxItems={BANNED_PHRASES_MAX}
                  aria-label="Banned phrases"
                  aria-describedby="banned-phrases-hint"
                />
              )}
              <p id="banned-phrases-hint" className="mt-1 text-xs text-gray-500">
                Words or phrases that must never appear in your content. These are checked during brand scoring.
              </p>
            </div>
          </fieldset>

          {/* ── Example Content ───────────────────────────── */}
          <fieldset
            className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-6 space-y-5"
            aria-label="Example approved content"
          >
            <legend className="sr-only">Example Approved Content</legend>
            <div>
              <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider" aria-hidden="true">
                Example Approved Content
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Provide up to 3 examples of approved, on-brand content. The AI uses these as reference when
                generating campaigns.
              </p>
            </div>

            {[0, 1, 2].map((idx) => {
              const exampleId = `example-content-${idx}`
              const exampleLabels = ['email', 'social post', 'ad copy']
              return (
                <div key={idx}>
                  <label htmlFor={exampleId} className="block text-sm font-medium text-gray-400 mb-1.5">
                    Example {idx + 1}
                    <span className="ml-2 text-xs text-gray-600 font-normal">optional</span>
                  </label>
                  <textarea
                    id={exampleId}
                    value={exampleContent[idx] || ''}
                    onChange={e => {
                      if (isReadOnly) return
                      const updated = [...exampleContent]
                      updated[idx] = e.target.value
                      setExampleContent(updated)
                    }}
                    readOnly={isReadOnly}
                    rows={3}
                    aria-label={`Example ${idx + 1}: approved ${exampleLabels[idx]} content`}
                    className={`${inputBase} resize-y ${inputBorder(false, isReadOnly)}`}
                    placeholder={`Paste an example of approved ${exampleLabels[idx]} content here…`}
                  />
                </div>
              )
            })}
          </fieldset>

          {/* ── Save button ───────────────────────────────── */}
          {!isReadOnly && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-xs text-gray-500 order-2 sm:order-1">
                Changes take effect immediately for new campaign generation runs.
              </p>
              <button
                type="submit"
                disabled={saving || !!logoUrlError || !!brandVoiceError}
                aria-disabled={saving || !!logoUrlError || !!brandVoiceError}
                aria-label={saving ? 'Saving brand settings…' : 'Save brand settings'}
                className={[
                  'order-1 sm:order-2 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium',
                  'transition-all duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
                  saving || !!logoUrlError || !!brandVoiceError
                    ? 'bg-indigo-800 text-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 active:scale-[0.98]',
                  '@media (prefers-reduced-motion: reduce) { transition: none; }',
                ].join(' ')}
              >
                {saving ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                    <span>Saving…</span>
                  </>
                ) : (
                  'Save Brand Settings'
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </Layout>
  )
}