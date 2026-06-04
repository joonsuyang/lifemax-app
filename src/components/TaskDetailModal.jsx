import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, TIME_OPTIONS, ENERGY_OPTIONS, PRIORITY_OPTIONS } from '../lib/filters'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_TO_SECONDS = {
  '10 min':  600,
  '30 min':  1800,
  '45 min':  2700,
  '60 min':  3600,
  '>60 min': 5400,
}

const STATUS_OPTIONS = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'today',       label: 'Today' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

const STATUS_ACTIVE = {
  backlog:     'bg-gray-200 text-gray-700 border-gray-300',
  today:       'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-300',
  done:        'bg-green-100 text-green-700 border-green-300',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
      {children}
    </p>
  )
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
        const label = typeof opt === 'string' ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt.label
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

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskDetailModal({ task, onClose, onSaved, onDeleted }) {
  const [form, setForm]               = useState(null)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]             = useState('')

  // Timer state
  const [timeLeft, setTimeLeft]         = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const initialSecondsRef               = useRef(0)

  // ── Timer tick (recursive setTimeout — avoids stale-closure issues) ─────────
  useEffect(() => {
    if (!timerRunning) return
    if (timeLeft <= 0) {
      setTimerRunning(false)
      setTimerExpired(true)
      return
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timerRunning, timeLeft])

  // ── Timer controls ───────────────────────────────────────────────────────────
  const startTimer = useCallback((estimatedTime) => {
    const secs = TIME_TO_SECONDS[estimatedTime]
    if (!secs) return
    initialSecondsRef.current = secs
    setTimeLeft(secs)
    setTimerExpired(false)
    setTimerRunning(true)
  }, [])

  const resetTimer = useCallback(() => {
    setTimerRunning(false)
    setTimerExpired(false)
    setTimeLeft(0)
    initialSecondsRef.current = 0
  }, [])

  // ── Load task into form ──────────────────────────────────────────────────────
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

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  // ── Status change ────────────────────────────────────────────────────────────
  const handleStatusChange = (newStatus) => {
    const patch = { status: newStatus }
    if (newStatus === 'in_progress') {
      if (!form.started_at) patch.started_at = new Date().toISOString()
      startTimer(form.estimated_time)
    } else {
      resetTimer()
    }
    if (newStatus === 'done') {
      patch.completed_at = new Date().toISOString()
      if (!form.started_at) patch.started_at = new Date().toISOString()
    }
    setForm(prev => ({ ...prev, ...patch }))
  }

  // ── Save (shared by Save button and Mark Complete) ───────────────────────────
  const saveTask = async (overrides = {}) => {
    const data = { ...form, ...overrides }
    if (!data.name?.trim()) { setError('Task name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('tasks')
        .update({
          name:            data.name.trim(),
          category:        data.category || null,
          estimated_time:  data.estimated_time || null,
          energy_required: data.energy_required || null,
          priority:        data.priority || 'medium',
          min_completion:  data.min_completion?.trim() || null,
          next_action:     data.next_action?.trim() || null,
          status:          data.status,
          started_at:      data.started_at ?? null,
          completed_at:    data.completed_at ?? null,
        })
        .eq('id', data.id)
      if (err) throw err
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ── Timer expiry actions ─────────────────────────────────────────────────────
  const handleMarkComplete = () => {
    const now = new Date().toISOString()
    saveTask({
      status:       'done',
      completed_at: now,
      started_at:   form.started_at ?? now,
    })
  }

  const handleRollover = () => {
    setTimerExpired(false)
    setTimeLeft(initialSecondsRef.current)
    setTimerRunning(true)
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
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
  const showTimer   = form.status === 'in_progress' && initialSecondsRef.current > 0
  const pct         = initialSecondsRef.current > 0 ? (timeLeft / initialSecondsRef.current) * 100 : 0
  const timerColor  = pct > 50 ? 'text-indigo-600' : pct > 25 ? 'text-amber-500' : 'text-red-500'
  const barColor    = pct > 50 ? 'bg-indigo-500'   : pct > 25 ? 'bg-amber-400'   : 'bg-red-400'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* ── Header: name + status pills ── */}
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

          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {STATUS_OPTIONS.map(s => (
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

        {/* ── Focus timer ── */}
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
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkComplete}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm"
                  >
                    {saving ? 'Saving…' : 'Mark Complete'}
                  </button>
                  <button
                    onClick={handleRollover}
                    className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    Rollover
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Focus timer
                  </span>
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

        {/* ── Body: fields ── */}
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
              <FieldSelect value={form.energy_required} onChange={v => set('energy_required', v)} options={ENERGY_OPTIONS} />
            </div>
            <div>
              <Label>Priority</Label>
              <FieldSelect value={form.priority} onChange={v => set('priority', v)} options={PRIORITY_OPTIONS} />
            </div>
          </div>

          <div>
            <Label>Minimum completion</Label>
            <FieldTextarea value={form.min_completion} onChange={v => set('min_completion', v)} placeholder="What counts as done" />
          </div>

          <div>
            <Label>Next action</Label>
            <FieldTextarea value={form.next_action} onChange={v => set('next_action', v)} placeholder="First concrete step" />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 pt-1 border-t border-gray-50">
            {form.created_at   && <span>Created {formatDate(form.created_at)}</span>}
            {form.started_at   && <span>Started {formatDate(form.started_at)}</span>}
            {form.completed_at && <span>Completed {formatDate(form.completed_at)}</span>}
          </div>
        </div>

        {/* ── Footer: delete + save ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <div className="flex items-center justify-between">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Delete this task?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon />
                Delete
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveTask()}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
