import { useState, useEffect, useRef, useCallback } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { supabase } from '../lib/supabase'
import { CATEGORIES, TIME_OPTIONS, ENERGY_OPTIONS, PRIORITY_OPTIONS } from '../lib/filters'
import useBreakpoint from '../hooks/useBreakpoint'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_TO_SECONDS = {
  '10 min':  600,
  '30 min':  1800,
  '45 min':  2700,
  '60 min':  3600,
  '>60 min': 5400,
}

// Status picker — all four options, always shown in this order
const STATUS_PICKER_OPTIONS = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'today',       label: 'To-Do Today' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

// Desktop segmented control active styles
const STATUS_PICKER_ACTIVE = {
  backlog:     'bg-white text-gray-700 shadow-sm',
  today:       'bg-blue-100 text-blue-700 shadow-sm',
  in_progress: 'bg-amber-100 text-amber-700 shadow-sm',
  done:        'bg-green-100 text-green-700 shadow-sm',
}

// Mobile segmented control active styles
const STATUS_PICKER_ACTIVE_DARK = {
  backlog:     'bg-slate-600 text-slate-200',
  today:       'bg-blue-900/70 text-blue-300',
  in_progress: 'bg-amber-900/60 text-amber-300',
  done:        'bg-emerald-900/60 text-emerald-300',
}

const DARK_INPUT  = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const DARK_SELECT = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatElapsed(secs) {
  if (secs <= 0) return '0s'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── Desktop sub-components ────────────────────────────────────────────────────

function Label({ children }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{children}</p>
}

function FieldSelect({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
    >
      <option value="">—</option>
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? cap(opt) : opt.label
        return <option key={val} value={val}>{label}</option>
      })}
    </select>
  )
}

function FieldTextarea({ value, onChange, placeholder }) {
  return (
    <TextareaAutosize
      minRows={1}
      maxRows={6}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
    />
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function DarkLabel({ children }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{children}</p>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskDetailModal({ task, onClose, onSaved, onDeleted }) {
  const { isMobile } = useBreakpoint()

  const [form, setForm]                       = useState(null)
  const [saving, setSaving]                   = useState(false)
  const [deleting, setDeleting]               = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState(false)
  const [error, setError]                     = useState('')

  const [timeLeft, setTimeLeft]               = useState(0)
  const [timerRunning, setTimerRunning]       = useState(false)
  const [timerExpired, setTimerExpired]       = useState(false)
  const initialSecondsRef                     = useRef(0)
  const [elapsedSeconds, setElapsedSeconds]   = useState(0)

  // ── Timer tick ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) return
    if (timeLeft <= 0) { setTimerRunning(false); setTimerExpired(true); return }
    const id = setTimeout(() => {
      setTimeLeft(t => t - 1)
      setElapsedSeconds(e => e + 1)
    }, 1000)
    return () => clearTimeout(id)
  }, [timerRunning, timeLeft])

  const startTimer = useCallback((estimatedTime) => {
    const secs = TIME_TO_SECONDS[estimatedTime]
    if (!secs) return
    initialSecondsRef.current = secs
    setTimeLeft(secs)
    setTimerExpired(false)
    setTimerRunning(true)
    setElapsedSeconds(0)
  }, [])

  const resetTimer = useCallback(() => {
    setTimerRunning(false)
    setTimerExpired(false)
    setTimeLeft(0)
    initialSecondsRef.current = 0
    setElapsedSeconds(0)
  }, [])

  useEffect(() => {
    if (!task) return
    setForm({ ...task })
    setConfirmDelete(false)
    setError('')
    resetTimer()
    if (task.status === 'in_progress' && task.estimated_time) {
      startTimer(task.estimated_time)
    }
  }, [task, startTimer, resetTimer])

  if (!task || !form) return null

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const accumulatedTime = (form.actual_time_spent_seconds ?? 0) + elapsedSeconds

  // Status picker change — updates draft state only; also manages the timer
  const handleStatusPickerChange = (newStatus) => {
    setForm(prev => ({ ...prev, status: newStatus }))
    if (newStatus === 'in_progress') {
      startTimer(form.estimated_time)
    } else if (form.status === 'in_progress') {
      resetTimer()
    }
  }

  // Core save — applies status-transition side effects, then persists
  const saveTask = async (overrides = {}) => {
    const data = { ...form, ...overrides }
    if (!data.name?.trim()) { setError('Task name is required.'); return }

    const now = new Date().toISOString()

    // Side effects based on status transition
    if (data.status === 'in_progress' && !data.date_started) {
      data.date_started = now
    }
    if (data.status === 'done') {
      if (!data.date_started) data.date_started = now
      // Only set date_completed if not already passed via overrides
      if (!overrides.date_completed) data.date_completed = now
    }
    // Reverting a completed task — clear date_completed so it exits the pie chart
    if (task.status === 'done' && data.status !== 'done' && !('date_completed' in overrides)) {
      data.date_completed = null
    }

    // If marking done with zero tracked time, fall back to estimated_time so the
    // task still contributes to the TaskOverview pie chart.
    // actual_time_spent_seconds > 0 means the user ran the timer at some point —
    // don't overwrite real tracked time with an estimate.
    // ">60 min" uses 3600s (60 min) as the conservative default.
    let timeToSave = overrides.actual_time_spent_seconds   // undefined unless a timer quick-action set it
    if (data.status === 'done' && !((data.actual_time_spent_seconds ?? 0) > 0) && timeToSave === undefined) {
      timeToSave = TIME_TO_SECONDS[data.estimated_time]    // undefined if no estimate — no change
    }

    setSaving(true)
    setError('')
    try {
      const updatePayload = {
        name:               data.name.trim(),
        category:           data.category || null,
        estimated_time:     data.estimated_time || null,
        energy:             data.energy || null,
        priority:           data.priority || 'medium',
        minimum_completion: data.minimum_completion?.trim() || null,
        next_action:        data.next_action?.trim() || null,
        status:             data.status,
        date_started:       data.date_started ?? null,
        date_completed:     data.date_completed ?? null,
      }
      if (timeToSave !== undefined) {
        updatePayload.actual_time_spent_seconds = timeToSave
      }
      const { error: err } = await supabase.from('tasks').update(updatePayload).eq('id', data.id)
      if (err) throw err
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ── Timer quick actions (bypass Save, commit immediately) ─────────────────────

  const handleComplete = () => {
    const now = new Date().toISOString()
    saveTask({
      status:                    'done',
      date_completed:            now,
      date_started:              form.date_started ?? now,
      actual_time_spent_seconds: accumulatedTime,
    })
  }

  const handleRollover = () => {
    saveTask({ status: 'in_progress', actual_time_spent_seconds: accumulatedTime })
  }

  const handleExtendTime = () => {
    setTimeLeft(t => t + 600)
    setTimerExpired(false)
    setTimerRunning(true)
  }

  const handleBacklog = () => {
    saveTask({ status: 'backlog', actual_time_spent_seconds: accumulatedTime })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error: err } = await supabase.from('tasks').delete().eq('id', form.id)
      if (err) throw err
      onDeleted?.()
      onClose()
    } catch (e) {
      setError(e.message ?? 'Failed to delete.')
      setDeleting(false)
    }
  }

  // ── Timer display derivations ────────────────────────────────────────────────
  const showTimer        = form.status === 'in_progress' && initialSecondsRef.current > 0
  const pct              = initialSecondsRef.current > 0 ? (timeLeft / initialSecondsRef.current) * 100 : 0
  const barColor         = pct > 50 ? 'bg-indigo-500' : pct > 25 ? 'bg-amber-400' : 'bg-red-400'
  const timerColor       = pct > 50 ? 'text-indigo-600' : pct > 25 ? 'text-amber-500' : 'text-red-500'
  const mobileTimerColor = pct > 50 ? 'text-indigo-300' : pct > 25 ? 'text-amber-300' : 'text-red-400'

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE — full-screen overlay
  // ════════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">

        {/* ── Header: back + name + status picker ── */}
        <div className="flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <TextareaAutosize
              minRows={1}
              maxRows={3}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Task name"
              className="flex-1 text-base font-semibold text-slate-100 bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 placeholder-slate-600 transition-colors resize-none"
            />
          </div>

          {/* Status picker — segmented control */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 mx-5 mb-3">
            {STATUS_PICKER_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusPickerChange(s.value)}
                className={`flex-1 text-[10px] font-semibold py-1.5 px-1 rounded-md transition-all ${
                  form.status === s.value
                    ? STATUS_PICKER_ACTIVE_DARK[s.value]
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {s.value === 'today' ? 'Today' : s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        {showTimer ? (
          // Focus timer view
          <div className="flex-1 flex flex-col pb-[140px]">
            {/* Large countdown */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
              {timerExpired ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                    <p className="text-xl font-semibold text-red-400">Time's up!</p>
                  </div>
                  <p className="text-sm text-slate-500">How did it go?</p>
                </div>
              ) : (
                <>
                  <span className={`text-7xl font-bold font-mono tabular-nums leading-none ${mobileTimerColor}`}>
                    {formatTime(timeLeft)}
                  </span>
                  <div className="w-full max-w-xs flex flex-col gap-2">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-600 text-center">{form.estimated_time}</p>
                  </div>
                </>
              )}
              {accumulatedTime > 0 && (
                <p className="text-xs text-slate-600">Time spent: {formatElapsed(accumulatedTime)}</p>
              )}
            </div>

            {/* Timer quick-action buttons — only in active timer mode */}
            <div className="px-4 pb-3 flex flex-col gap-2">
              {timerExpired ? (
                <>
                  <button onClick={handleComplete} disabled={saving}
                    className="w-full py-3.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl transition-colors">
                    {saving ? 'Saving…' : 'Complete'}
                  </button>
                  <button onClick={handleExtendTime}
                    className="w-full py-3.5 text-sm font-semibold text-amber-300 border border-amber-700/50 rounded-xl hover:bg-amber-900/20 transition-colors">
                    Extend 10 min
                  </button>
                  <button onClick={handleBacklog} disabled={saving}
                    className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    {saving ? 'Saving…' : 'Move to Backlog'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleComplete} disabled={saving}
                    className="w-full py-3.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl transition-colors">
                    {saving ? 'Saving…' : 'Complete'}
                  </button>
                  <button onClick={handleRollover} disabled={saving}
                    className="w-full py-3.5 text-sm font-semibold text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Finish Later'}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          // Regular form
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[140px] flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <DarkLabel>Category</DarkLabel>
                <select value={form.category ?? ''} onChange={e => set('category', e.target.value)} className={DARK_SELECT}>
                  <option value="">—</option>
                  {CATEGORIES.map(o => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              </div>
              <div>
                <DarkLabel>Est. time</DarkLabel>
                <select value={form.estimated_time ?? ''} onChange={e => set('estimated_time', e.target.value)} className={DARK_SELECT}>
                  <option value="">—</option>
                  {TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <DarkLabel>Energy</DarkLabel>
                <select value={form.energy ?? ''} onChange={e => set('energy', e.target.value)} className={DARK_SELECT}>
                  <option value="">—</option>
                  {ENERGY_OPTIONS.map(o => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              </div>
              <div>
                <DarkLabel>Priority</DarkLabel>
                <select value={form.priority ?? ''} onChange={e => set('priority', e.target.value)} className={DARK_SELECT}>
                  <option value="">—</option>
                  {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <DarkLabel>Minimum completion</DarkLabel>
              <TextareaAutosize minRows={1} maxRows={6} value={form.minimum_completion ?? ''} onChange={e => set('minimum_completion', e.target.value)}
                placeholder="What counts as done" className={`${DARK_INPUT} resize-none`} />
            </div>

            <div>
              <DarkLabel>Next action</DarkLabel>
              <TextareaAutosize minRows={1} maxRows={6} value={form.next_action ?? ''} onChange={e => set('next_action', e.target.value)}
                placeholder="First concrete step" className={`${DARK_INPUT} resize-none`} />
            </div>

            <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
              {accumulatedTime > 0 && (
                <p className="text-xs text-slate-500">Time spent: {formatElapsed(accumulatedTime)}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {form.date_created   && <span>Created {formatDate(form.date_created)}</span>}
                {form.date_started   && <span>Started {formatDate(form.date_started)}</span>}
                {form.date_completed && <span>Completed {formatDate(form.date_completed)}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Fixed bottom: Save + Delete (always visible) ── */}
        <div className="fixed bottom-0 left-0 right-0 p-4 flex flex-col gap-2 bg-slate-900 border-t border-slate-800">
          {error && <p className="text-xs text-red-400 text-center mb-1">{error}</p>}

          <button onClick={() => saveTask()} disabled={saving}
            className="w-full py-4 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 active:scale-95 disabled:opacity-60 rounded-xl transition-all">
            {saving ? 'Saving…' : 'Save'}
          </button>

          {confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 text-sm text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-3 text-sm font-medium text-red-400 border border-red-500/40 rounded-xl hover:bg-red-900/20 disabled:opacity-60 transition-colors">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full py-3 text-sm text-slate-600 hover:text-red-400 transition-colors">
              Delete task
            </button>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DESKTOP — centered modal
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* ── Header: name + status picker ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <TextareaAutosize
              minRows={1}
              maxRows={4}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Task name"
              className="flex-1 text-lg font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 border-b-2 border-transparent focus:border-indigo-400 focus:outline-none pb-0.5 transition-colors resize-none"
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status segmented control */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 mt-3">
            {STATUS_PICKER_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusPickerChange(s.value)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                  form.status === s.value
                    ? STATUS_PICKER_ACTIVE[s.value]
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Focus timer section (only when timer is active) ── */}
        {showTimer && (
          <div className={`px-6 py-4 border-b border-gray-100 flex-shrink-0 transition-colors ${
            timerExpired ? 'bg-red-50' : 'bg-indigo-50/40'
          }`}>
            {timerExpired ? (
              <div className="flex flex-col items-center gap-3 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <p className="text-sm font-semibold text-red-600">Time's up!</p>
                </div>
                {accumulatedTime > 0 && (
                  <p className="text-xs text-gray-400">Time spent: {formatElapsed(accumulatedTime)}</p>
                )}
                {/* Timer quick actions */}
                <div className="flex gap-2 mt-1">
                  <button onClick={handleBacklog} disabled={saving}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                    {saving ? '…' : 'Backlog'}
                  </button>
                  <button onClick={handleExtendTime}
                    className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors">
                    Extend 10 min
                  </button>
                  <button onClick={handleComplete} disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm">
                    {saving ? 'Saving…' : 'Complete'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Focus timer</span>
                    {accumulatedTime > 0 && (
                      <span className="text-[11px] text-gray-400">Spent: {formatElapsed(accumulatedTime)}</span>
                    )}
                  </div>
                  <span className={`text-2xl font-mono font-bold tabular-nums leading-none ${timerColor}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                {/* Timer quick actions */}
                <div className="flex gap-2 justify-end">
                  <button onClick={handleRollover} disabled={saving}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                    {saving ? 'Saving…' : 'Finish Later'}
                  </button>
                  <button onClick={handleComplete} disabled={saving}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Complete'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Body: form fields ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <FieldSelect value={form.category} onChange={v => set('category', v)} options={CATEGORIES} />
            </div>
            <div>
              <Label>Est. time</Label>
              <FieldSelect value={form.estimated_time} onChange={v => set('estimated_time', v)} options={TIME_OPTIONS} />
            </div>
            <div>
              <Label>Energy</Label>
              <FieldSelect value={form.energy} onChange={v => set('energy', v)} options={ENERGY_OPTIONS} />
            </div>
            <div>
              <Label>Priority</Label>
              <FieldSelect value={form.priority} onChange={v => set('priority', v)} options={PRIORITY_OPTIONS} />
            </div>
          </div>

          <div>
            <Label>Minimum completion</Label>
            <FieldTextarea value={form.minimum_completion} onChange={v => set('minimum_completion', v)} placeholder="What counts as done" />
          </div>

          <div>
            <Label>Next action</Label>
            <FieldTextarea value={form.next_action} onChange={v => set('next_action', v)} placeholder="First concrete step" />
          </div>

          <div className="flex flex-col gap-1 pt-1 border-t border-gray-50">
            {accumulatedTime > 0 && (
              <p className="text-xs text-gray-500">Time spent: {formatElapsed(accumulatedTime)}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              {form.date_created   && <span>Created {formatDate(form.date_created)}</span>}
              {form.date_started   && <span>Started {formatDate(form.date_started)}</span>}
              {form.date_completed && <span>Completed {formatDate(form.date_completed)}</span>}
            </div>
          </div>
        </div>

        {/* ── Footer: Delete + Cancel + Save (always) ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <div className="flex items-center justify-between">
            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Delete this task?</span>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60 transition-colors">
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors">
                <TrashIcon />
                Delete
              </button>
            )}

            {/* Cancel + Save */}
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => saveTask()} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
