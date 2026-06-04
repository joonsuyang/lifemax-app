import { useState, useEffect, useRef, useCallback } from 'react'
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

// in_progress is no longer a selectable pill — managed by the Start button
const SELECTABLE_STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'today',   label: 'To-Do Today' },
  { value: 'done',    label: 'Done' },
]

// All four statuses available as "Move to…" targets — current status is filtered out at render time
const STATUS_MOVE_OPTIONS = [
  { value: 'today',       label: 'To-Do Today' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'backlog',     label: 'Backlog' },
  { value: 'done',        label: 'Done' },
]

// Desktop (light modal)
const STATUS_ACTIVE = {
  backlog:     'bg-gray-200 text-gray-700 border-gray-300',
  today:       'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-300',
  done:        'bg-green-100 text-green-700 border-green-300',
}

// Mobile (dark overlay)
const STATUS_ACTIVE_DARK = {
  backlog:     'bg-slate-700 text-slate-300 border-slate-600',
  today:       'bg-blue-900/60 text-blue-300 border-blue-700/50',
  in_progress: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  done:        'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
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
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
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

  const [form, setForm]                   = useState(null)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]                 = useState('')

  // Countdown state
  const [timeLeft, setTimeLeft]           = useState(0)
  const [timerRunning, setTimerRunning]   = useState(false)
  const [timerExpired, setTimerExpired]   = useState(false)
  const initialSecondsRef                 = useRef(0)

  // Elapsed time for current session (increments each tick)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // ── Timer tick — decrements countdown, increments elapsed ────────────────────
  useEffect(() => {
    if (!timerRunning) return
    if (timeLeft <= 0) {
      setTimerRunning(false)
      setTimerExpired(true)
      return
    }
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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  // Status pill click — in_progress no longer appears here; managed by Start/timer buttons
  const handleStatusChange = (newStatus) => {
    const patch = { status: newStatus }
    if (form.status === 'in_progress') resetTimer()   // stop timer when leaving in_progress
    if (newStatus === 'done') {
      patch.date_completed = new Date().toISOString()
      if (!form.date_started) patch.date_started = new Date().toISOString()
    }
    setForm(prev => ({ ...prev, ...patch }))
  }

  // Core save — always persists actual_time_spent_seconds when provided
  const saveTask = async (overrides = {}) => {
    const data = { ...form, ...overrides }
    if (!data.name?.trim()) { setError('Task name is required.'); return }
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
      if (overrides.actual_time_spent_seconds !== undefined) {
        updatePayload.actual_time_spent_seconds = overrides.actual_time_spent_seconds
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

  // Accumulated seconds = previous sessions + current session
  const accumulatedTime = (form.actual_time_spent_seconds ?? 0) + elapsedSeconds

  // Start button: sets in_progress + begins countdown
  const handleStart = () => {
    const patch = { status: 'in_progress' }
    if (!form.date_started) patch.date_started = new Date().toISOString()
    setForm(prev => ({ ...prev, ...patch }))
    startTimer(form.estimated_time)
  }

  // Complete: mark done, persist elapsed time
  const handleComplete = () => {
    const now = new Date().toISOString()
    saveTask({
      status:                    'done',
      date_completed:            now,
      date_started:              form.date_started ?? now,
      actual_time_spent_seconds: accumulatedTime,
    })
  }

  // Rollover: save elapsed time, keep in_progress, close modal — does NOT restart timer
  const handleRollover = () => {
    saveTask({
      status:                    'in_progress',
      actual_time_spent_seconds: accumulatedTime,
    })
  }

  // Extend Time: adds 10 minutes to countdown, continues accumulating elapsed
  const handleExtendTime = () => {
    setTimeLeft(t => t + 600)
    setTimerExpired(false)
    setTimerRunning(true)
  }

  // Backlog: save elapsed time, revert to backlog, close
  const handleBacklog = () => {
    saveTask({
      status:                    'backlog',
      actual_time_spent_seconds: accumulatedTime,
    })
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

  // ── Manual status move (power-user correction, outside timer flow) ───────────
  const handleStatusMove = (newStatus) => {
    const now = new Date().toISOString()
    const overrides = { status: newStatus }

    if (newStatus === 'in_progress' && !form.date_started) {
      overrides.date_started = now
    }
    if (newStatus === 'done') {
      overrides.date_completed = now
      if (!form.date_started) overrides.date_started = now
    }
    // Reverting a completed task — clear the date so it exits the pie chart
    if (form.status === 'done' && newStatus !== 'done') {
      overrides.date_completed = null
    }
    // Stop the countdown when manually leaving in_progress
    if (form.status === 'in_progress' && newStatus !== 'in_progress') {
      resetTimer()
    }

    saveTask({
      ...overrides,
      // Preserve accumulated time — it's a historical fact, never reset it
      ...(elapsedSeconds > 0 && { actual_time_spent_seconds: accumulatedTime }),
    })
  }

  // ── Timer derivations ────────────────────────────────────────────────────────
  const showTimer        = form.status === 'in_progress' && initialSecondsRef.current > 0
  const pct              = initialSecondsRef.current > 0 ? (timeLeft / initialSecondsRef.current) * 100 : 0
  const barColor         = pct > 50 ? 'bg-indigo-500' : pct > 25 ? 'bg-amber-400' : 'bg-red-400'
  const timerColor       = pct > 50 ? 'text-indigo-600' : pct > 25 ? 'text-amber-500' : 'text-red-500'
  const mobileTimerColor = pct > 50 ? 'text-indigo-300' : pct > 25 ? 'text-amber-300' : 'text-red-400'
  const canStart         = (form.status === 'backlog' || form.status === 'today') && !showTimer

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE — full-screen overlay
  // ════════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">

        {/* Header: back + name + status */}
        <div className="flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Task name"
              className="flex-1 text-base font-semibold text-slate-100 bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 placeholder-slate-600 transition-colors"
            />
          </div>

          {/* Status indicator + selectable pills */}
          <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto">
            {form.status === 'in_progress' && (
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_ACTIVE_DARK.in_progress}`}>
                In Progress
              </span>
            )}
            {SELECTABLE_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  form.status === s.value
                    ? STATUS_ACTIVE_DARK[s.value]
                    : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {showTimer ? (
          // Focus timer — large centered display + Move To below
          <div className="flex-1 flex flex-col pb-[140px]">
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
                      <div
                        className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 text-center">{form.estimated_time}</p>
                  </div>
                </>
              )}
              {accumulatedTime > 0 && (
                <p className="text-xs text-slate-600">Time spent: {formatElapsed(accumulatedTime)}</p>
              )}
            </div>

            {/* Move to — secondary control */}
            <div className="px-5 py-3 border-t border-slate-800/50">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Move to</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_MOVE_OPTIONS.filter(s => s.value !== form.status).map(s => (
                  <button key={s.value} onClick={() => handleStatusMove(s.value)} disabled={saving}
                    className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 active:scale-95 px-3 py-1.5 rounded-full transition-all disabled:opacity-50">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Regular form — scrollable
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
              <textarea value={form.minimum_completion ?? ''} onChange={e => set('minimum_completion', e.target.value)}
                placeholder="What counts as done" rows={3} className={`${DARK_INPUT} resize-none`} />
            </div>

            <div>
              <DarkLabel>Next action</DarkLabel>
              <textarea value={form.next_action ?? ''} onChange={e => set('next_action', e.target.value)}
                placeholder="First concrete step" rows={3} className={`${DARK_INPUT} resize-none`} />
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

            {/* Move to — secondary control */}
            <div className="pt-3 border-t border-slate-800/50">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Move to</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_MOVE_OPTIONS.filter(s => s.value !== form.status).map(s => (
                  <button key={s.value} onClick={() => handleStatusMove(s.value)} disabled={saving}
                    className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 active:scale-95 px-3 py-1.5 rounded-full transition-all disabled:opacity-50">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fixed bottom action buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 flex flex-col gap-2 bg-slate-900 border-t border-slate-800">
          {error && <p className="text-xs text-red-400 text-center mb-1">{error}</p>}

          {showTimer ? (
            timerExpired ? (
              // Expired: Complete + Extend Time + Backlog
              <>
                <button onClick={handleComplete} disabled={saving}
                  className="w-full py-4 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl transition-colors">
                  {saving ? 'Saving…' : 'Complete'}
                </button>
                <button onClick={handleExtendTime}
                  className="w-full py-4 text-sm font-semibold text-amber-300 border border-amber-700/50 rounded-xl hover:bg-amber-900/20 transition-colors">
                  Extend 10 min
                </button>
                <button onClick={handleBacklog} disabled={saving}
                  className="w-full py-3 text-sm text-slate-600 hover:text-slate-400 transition-colors">
                  Move to Backlog
                </button>
              </>
            ) : (
              // Running: Complete + Rollover
              <>
                <button onClick={handleComplete} disabled={saving}
                  className="w-full py-4 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl transition-colors">
                  {saving ? 'Saving…' : 'Complete'}
                </button>
                <button onClick={handleRollover} disabled={saving}
                  className="w-full py-4 text-sm font-semibold text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving…' : 'Finish Later'}
                </button>
              </>
            )
          ) : canStart ? (
            // Backlog/Today: Start + Save + Delete
            <>
              <button onClick={handleStart}
                className="w-full py-4 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 active:scale-95 rounded-xl transition-all">
                Start Task
              </button>
              <button onClick={() => saveTask()} disabled={saving}
                className="w-full py-3 text-sm text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
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
            </>
          ) : (
            // Done or in_progress without timer: Save + Delete
            <>
              <button onClick={() => saveTask()} disabled={saving}
                className="w-full py-4 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 rounded-xl transition-colors">
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
            </>
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

        {/* Header: name + status */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Task name"
              className="flex-1 text-lg font-semibold text-gray-900 placeholder-gray-300 bg-transparent border-0 border-b-2 border-transparent focus:border-indigo-400 focus:outline-none pb-0.5 transition-colors"
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status pills — in_progress shown as badge, not clickable */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {form.status === 'in_progress' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-100 text-amber-700 border-amber-300">
                In Progress
              </span>
            )}
            {SELECTABLE_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  form.status === s.value
                    ? STATUS_ACTIVE[s.value]
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Focus timer section */}
        {showTimer && (
          <div className={`px-6 py-4 border-b border-gray-100 flex-shrink-0 transition-colors ${
            timerExpired ? 'bg-red-50' : 'bg-indigo-50/40'
          }`}>
            {timerExpired ? (
              <div className="flex flex-col items-center gap-2 py-0.5 text-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <p className="text-sm font-semibold text-red-600">Time's up!</p>
                </div>
                {accumulatedTime > 0 && (
                  <p className="text-xs text-gray-400">Time spent: {formatElapsed(accumulatedTime)}</p>
                )}
              </div>
            ) : (
              <div>
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
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body: fields */}
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

        {/* Footer */}
        <div className="px-6 pt-4 pb-3 border-t border-gray-100 flex-shrink-0">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          {showTimer ? (
            // Timer footer — replaces normal save/delete
            <div className="flex items-center justify-end gap-2">
              {timerExpired ? (
                <>
                  <button onClick={handleBacklog} disabled={saving}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                    {saving ? '…' : 'Backlog'}
                  </button>
                  <button onClick={handleExtendTime}
                    className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors">
                    Extend 10 min
                  </button>
                  <button onClick={handleComplete} disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Complete'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleRollover} disabled={saving}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                    {saving ? 'Saving…' : 'Finish Later'}
                  </button>
                  <button onClick={handleComplete} disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Complete'}
                  </button>
                </>
              )}
            </div>
          ) : (
            // Normal footer
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

              {/* Right: Cancel + (Start?) + Save */}
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
                {canStart && (
                  <button onClick={handleStart}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 active:scale-95 transition-all">
                    Start
                  </button>
                )}
                {!canStart && (
                  <button onClick={() => saveTask()} disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Move to — secondary power-user control, always visible */}
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap pt-3 mt-2 border-t border-gray-100">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Move to</span>
            {STATUS_MOVE_OPTIONS.filter(s => s.value !== form.status).map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusMove(s.value)}
                disabled={saving}
                className="text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
