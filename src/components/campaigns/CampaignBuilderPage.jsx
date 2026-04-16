'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { createCampaign, generateCampaignContent, scoreCampaign, submitCampaign } from '@/lib/api'
import { EmailContentPanel } from '@/components/campaigns/EmailContentPanel'
import { SocialContentPanel } from '@/components/campaigns/SocialContentPanel'
import { AdsContentPanel } from '@/components/campaigns/AdsContentPanel'
import { BrandScoreWidget } from '@/components/campaigns/BrandScoreWidget'

const BRIEF_MAX = 2000
const GENERATE_TIMEOUT_MS = 90000

const CHANNELS = [
  { value: 'email', label: 'Email', description: '3 subject variants, HTML body, send time' },
  { value: 'social', label: 'Social', description: 'Instagram, Twitter/X, LinkedIn' },
  { value: 'ads', label: 'Ads', description: 'Google & Meta ad copy, clipboard-ready' },
]

const briefSchema = z.object({
  name: z.string().min(2, 'Campaign name must be at least 2 characters').max(200, 'Name too long'),
  brief: z
    .string()
    .min(10, 'Brief must be at least 10 characters')
    .max(BRIEF_MAX, `Brief cannot exceed ${BRIEF_MAX} characters`),
  channels: z.array(z.string()).min(1, 'Select at least one channel'),
})

// ============================================================
// Toast component
// ============================================================
function Toast({ toasts, removeToast }) {
  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none"
      aria-live="assertive"
      aria-atomic="false"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role="alert"
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-sm transition-all duration-200 ${
            t.type === 'error'
              ? 'bg-red-950 border-red-700 text-red-300'
              : t.type === 'warning'
              ? 'bg-amber-950 border-amber-700 text-amber-300'
              : 'bg-emerald-950 border-emerald-700 text-emerald-300'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss notification"
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const timerRefs = useRef({})

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timerRefs.current[id]) {
      clearTimeout(timerRefs.current[id])
      delete timerRefs.current[id]
    }
  }, [])

  const addToast = useCallback((message, type = 'success', duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
    timerRefs.current[id] = setTimeout(() => removeToast(id), duration)
    return id
  }, [removeToast])

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearTimeout)
    }
  }, [])

  return { toasts, addToast, removeToast }
}

// ============================================================
// Error message helpers
// ============================================================
function getErrorMessage(err) {
  if (err?.status === 403) return 'You do not have permission to perform this action.'
  if (err?.status === 429) return 'Too many requests, please wait a moment and try again.'
  if (err?.status === 401) return 'Your session has expired. Please log in again.'
  return err?.message || 'An unexpected error occurred. Please try again.'
}

// ============================================================
// Section label helper
// ============================================================
function SectionLabel({ children, htmlFor, required }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wide text-gray-400"
    >
      {children}
      {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
      {required && <span className="sr-only">(required)</span>}
    </label>
  )
}

// ============================================================
// Main component
// ============================================================
export function CampaignBuilderPage() {
  const router = useRouter()
  const { toasts, addToast, removeToast } = useToast()

  const [step, setStep] = useState('brief') // 'brief' | 'generating' | 'scoring' | 'review'
  const [campaignId, setCampaignId] = useState(null)
  const [generatedContent, setGeneratedContent] = useState(null)
  const [brandScore, setBrandScore] = useState(null)
  const [scoringData, setScoringData] = useState(null)
  const [activeTab, setActiveTab] = useState('email')
  const [error, setError] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [generatingStatus, setGeneratingStatus] = useState('')

  const generateTimeoutRef = useRef(null)

  const form = useForm({
    resolver: zodResolver(briefSchema),
    defaultValues: { name: '', brief: '', channels: ['email'] },
    mode: 'onTouched',
  })

  const briefValue = form.watch('brief') || ''
  const selectedChannels = form.watch('channels') || []

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current)
    }
  }, [])

  const toggleChannel = (ch) => {
    const cur = form.getValues('channels') || []
    if (cur.includes(ch)) {
      form.setValue('channels', cur.filter(c => c !== ch), { shouldValidate: true })
    } else {
      form.setValue('channels', [...cur, ch], { shouldValidate: true })
    }
  }

  const handleGenerate = async (values) => {
    setError(null)
    setStep('generating')
    setGeneratingStatus('Creating campaign…')

    let timedOut = false
    generateTimeoutRef.current = setTimeout(() => {
      timedOut = true
      setStep('brief')
      setGeneratingStatus('')
      setError('Generation timed out after 90 seconds. Please try again.')
      addToast('Generation timed out after 90 seconds. Please try again.', 'error', 8000)
    }, GENERATE_TIMEOUT_MS)

    try {
      let cid = campaignId
      if (!cid) {
        const { campaign } = await createCampaign({
          name: values.name,
          brief: values.brief,
          channels: values.channels,
        })
        cid = campaign.id
        setCampaignId(cid)
      }

      if (timedOut) return

      setGeneratingStatus('Generating content with AI…')
      setActiveTab(values.channels[0])

      const result = await generateCampaignContent({
        campaign_id: cid,
        channels: values.channels,
      })

      if (timedOut) return

      clearTimeout(generateTimeoutRef.current)

      const content = result.campaign?.generated_content || {}
      setGeneratedContent(content)

      addToast('Content generated successfully!', 'success')

      setStep('scoring')
      setGeneratingStatus('Scoring brand compliance…')
      setScoreLoading(true)

      try {
        const scoreResult = await scoreCampaign({ campaign_id: cid })
        setBrandScore(scoreResult.brand_score)
        setScoringData(scoreResult)
      } catch (scoreErr) {
        console.error('Auto-scoring failed:', scoreErr)
        addToast('Auto-scoring failed. You can score manually below.', 'warning')
      } finally {
        setScoreLoading(false)
      }

      setStep('review')
      setGeneratingStatus('')
    } catch (err) {
      if (timedOut) return
      clearTimeout(generateTimeoutRef.current)

      const msg = getErrorMessage(err)
      setError(msg)
      addToast(msg, 'error', 7000)
      setStep('brief')
      setGeneratingStatus('')
      setScoreLoading(false)
    }
  }

  const handleScore = async () => {
    if (!campaignId) return
    setScoreLoading(true)
    setError(null)
    try {
      const result = await scoreCampaign({ campaign_id: campaignId })
      setBrandScore(result.brand_score)
      setScoringData(result)
      addToast(`Brand score updated: ${result.brand_score}/100`, 'success')
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      addToast(msg, 'error', 7000)
    } finally {
      setScoreLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!campaignId) return
    setSubmitLoading(true)
    setError(null)
    try {
      await submitCampaign(campaignId)
      addToast('Campaign submitted for approval!', 'success')
      router.push(`/campaigns/${campaignId}`)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      addToast(msg, 'error', 7000)
    } finally {
      setSubmitLoading(false)
    }
  }

  const canSubmit = brandScore !== null && brandScore >= 85
  const isGenerating = step === 'generating' || step === 'scoring'

  const briefRemaining = BRIEF_MAX - briefValue.length
  const briefNearLimit = briefValue.length > BRIEF_MAX * 0.9
  const briefOverLimit = briefValue.length > BRIEF_MAX

  return (
    <ProtectedRoute allowedRoles={['admin', 'editor']}>
      <Layout>
        <Toast toasts={toasts} removeToast={removeToast} />

        {/* aria-live region for generation status */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {generatingStatus}
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-6xl mx-auto">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">New Campaign</h1>
            <p className="text-sm text-gray-400 mt-1">
              Build an AI-powered marketing campaign across all your channels
            </p>
          </div>

          {/* Global error */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 flex items-start gap-3"
            >
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Brief form — shown during brief and generating steps */}
          {(step === 'brief' || isGenerating) && (
            <form onSubmit={form.handleSubmit(handleGenerate)} noValidate>
              {/* Two-column layout on lg: form left, help/tips right */}
              <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 space-y-6 lg:space-y-0">
                {/* Left column: form fields */}
                <div className="space-y-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 space-y-6">
                    {/* Campaign name */}
                    <div className="space-y-1.5">
                      <SectionLabel htmlFor="campaign-name" required>Campaign Name</SectionLabel>
                      <input
                        id="campaign-name"
                        type="text"
                        {...form.register('name')}
                        placeholder="e.g. Summer Collection Launch"
                        autoComplete="off"
                        aria-required="true"
                        aria-invalid={!!form.formState.errors.name}
                        aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
                        className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 ${
                          form.formState.errors.name
                            ? 'border-red-700 focus-visible:ring-red-500'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      />
                      {form.formState.errors.name && (
                        <p id="name-error" role="alert" className="text-xs text-red-400 flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    {/* Brief */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <SectionLabel htmlFor="campaign-brief" required>Campaign Brief</SectionLabel>
                        <span
                          aria-live="polite"
                          aria-atomic="true"
                          className={`text-xs tabular-nums font-medium ${
                            briefOverLimit
                              ? 'text-red-400'
                              : briefNearLimit
                              ? 'text-amber-400'
                              : 'text-gray-500'
                          }`}
                        >
                          {briefValue.length.toLocaleString()} / {BRIEF_MAX.toLocaleString()}
                          {briefOverLimit && (
                            <span className="ml-1">({Math.abs(briefRemaining)} over)</span>
                          )}
                        </span>
                      </div>
                      <textarea
                        id="campaign-brief"
                        {...form.register('brief')}
                        rows={7}
                        placeholder="Describe your campaign goals, target audience, key messages, tone of voice, and any specific requirements…"
                        aria-required="true"
                        aria-label="Campaign brief — describe goals, target audience, key messages, tone of voice, and specific requirements"
                        aria-invalid={!!form.formState.errors.brief}
                        aria-describedby={`brief-counter${form.formState.errors.brief ? ' brief-error' : ''}`}
                        className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 resize-none transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 ${
                          form.formState.errors.brief
                            ? 'border-red-700 focus-visible:ring-red-500'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      />
                      {/* Character count progress bar */}
                      <div
                        role="progressbar"
                        aria-valuenow={briefValue.length}
                        aria-valuemin={0}
                        aria-valuemax={BRIEF_MAX}
                        aria-label="Brief character count"
                        className="w-full bg-gray-800 rounded-full h-1 overflow-hidden"
                      >
                        <div
                          className={`h-1 rounded-full transition-all duration-300 ${
                            briefOverLimit
                              ? 'bg-red-500'
                              : briefNearLimit
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min((briefValue.length / BRIEF_MAX) * 100, 100)}%` }}
                        />
                      </div>
                      {form.formState.errors.brief && (
                        <p id="brief-error" role="alert" className="text-xs text-red-400 flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {form.formState.errors.brief.message}
                        </p>
                      )}
                    </div>

                    {/* Channel selection */}
                    <fieldset>
                      <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                        Channels <span className="text-red-400" aria-hidden="true">*</span>
                        <span className="sr-only">(required, select at least one)</span>
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {CHANNELS.map(ch => {
                          const selected = selectedChannels.includes(ch.value)
                          return (
                            <button
                              key={ch.value}
                              type="button"
                              onClick={() => toggleChannel(ch.value)}
                              aria-pressed={selected}
                              aria-label={`${ch.label} channel — ${ch.description}${selected ? ' (selected)' : ''}`}
                              className={`flex flex-col items-start p-4 rounded-lg border text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 ${
                                selected
                                  ? 'border-indigo-500 bg-indigo-950/50 text-white ring-1 ring-indigo-500'
                                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300 hover:bg-gray-750'
                              }`}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <span className="text-sm font-semibold flex-1">{ch.label}</span>
                                {selected && (
                                  <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-xs mt-0.5 opacity-70">{ch.description}</span>
                            </button>
                          )
                        })}
                      </div>
                      {form.formState.errors.channels && (
                        <p role="alert" className="mt-2 text-xs text-red-400 flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {form.formState.errors.channels.message}
                        </p>
                      )}
                    </fieldset>
                  </div>

                  {/* Generation timeout notice */}
                  {isGenerating && (
                    <div
                      role="status"
                      className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3"
                    >
                      <p className="text-xs text-amber-400">
                        AI generation may take up to 90 seconds. Please keep this page open.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isGenerating || form.formState.isSubmitting}
                    aria-busy={isGenerating}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 motion-safe:transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          aria-hidden="true"
                        />
                        <span>{generatingStatus || 'Generating…'}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        Generate with AI
                      </>
                    )}
                  </button>
                </div>

                {/* Right column: tips panel */}
                <aside className="hidden lg:block space-y-4" aria-label="Campaign tips">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Writing Tips
                    </p>
                    <ul className="space-y-3 text-sm text-gray-400">
                      {[
                        { icon: '🎯', text: 'Be specific about your target audience and their pain points.' },
                        { icon: '💬', text: 'Include desired tone: professional, playful, urgent, etc.' },
                        { icon: '📣', text: 'List key messages or features you want highlighted.' },
                        { icon: '🚫', text: 'Note any phrases, claims, or topics to avoid.' },
                        { icon: '🔗', text: 'Mention the call-to-action and desired outcome.' },
                      ].map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span aria-hidden="true" className="text-base mt-0.5">{tip.icon}</span>
                          <span>{tip.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Brand Score Gate
                    </p>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Generated content is automatically scored for brand compliance. A score of{' '}
                      <span className="text-white font-semibold">85 or higher</span> is required before
                      submitting for approval.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      Scoring runs automatically after generation
                    </div>
                  </div>
                </aside>
              </div>
            </form>
          )}

          {/* Content review step */}
          {step === 'review' && generatedContent && (
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 space-y-6 lg:space-y-0">
              {/* Left: generated content */}
              <div className="space-y-5">
                {/* Channel tabs */}
                <div
                  role="tablist"
                  aria-label="Generated content by channel"
                  className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800 w-fit"
                >
                  {selectedChannels.map(ch => (
                    <button
                      key={ch}
                      role="tab"
                      aria-selected={activeTab === ch}
                      aria-controls={`tabpanel-${ch}`}
                      id={`tab-${ch}`}
                      onClick={() => setActiveTab(ch)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        activeTab === ch
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>

                {/* Panel content */}
                <div
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6"
                  role="tabpanel"
                  id={`tabpanel-${activeTab}`}
                  aria-labelledby={`tab-${activeTab}`}
                >
                  {activeTab === 'email' && <EmailContentPanel content={generatedContent?.email} />}
                  {activeTab === 'social' && <SocialContentPanel content={generatedContent?.social} />}
                  {activeTab === 'ads' && <AdsContentPanel content={generatedContent?.ads} />}
                </div>

                {/* Actions (mobile: below panel, desktop: below panel too but score widget is beside) */}
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <button
                    onClick={handleScore}
                    disabled={scoreLoading}
                    aria-busy={scoreLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50 border border-gray-700 hover:border-gray-600 text-sm font-medium text-white rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950"
                  >
                    {scoreLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-white" aria-hidden="true" />
                    ) : (
                      <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    )}
                    {scoreLoading ? 'Scoring…' : 'Re-score Brand Compliance'}
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleSubmit}
                      disabled={submitLoading || !canSubmit}
                      aria-busy={submitLoading}
                      aria-disabled={!canSubmit}
                      title={
                        !canSubmit
                          ? brandScore === null
                            ? 'Score your campaign first'
                            : `Brand score must be ≥ 85 (current: ${brandScore})`
                          : undefined
                      }
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950"
                    >
                      {submitLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                      ) : (
                        <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      )}
                      {submitLoading ? 'Submitting…' : 'Submit for Approval'}
                    </button>

                    {brandScore !== null && brandScore < 85 && (
                      <span role="status" className="text-xs text-amber-400 flex items-center gap-1">
                        <svg className="w-3 h-3 flex-shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        Score must be ≥ 85 (need {85 - brandScore} more points)
                      </span>
                    )}
                    {brandScore === null && !scoreLoading && (
                      <span className="text-xs text-gray-500">Scoring required before submitting</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: brand score widget */}
              <div className="lg:sticky lg:top-6 self-start space-y-4">
                <BrandScoreWidget
                  score={brandScore}
                  scoringData={scoringData}
                  loading={scoreLoading}
                  onScore={handleScore}
                />

                {/* Mobile tips reminder */}
                <div className="lg:hidden bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    Submission Gate
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    A brand score of <span className="text-white font-semibold">85 or higher</span> is required to submit for approval.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}