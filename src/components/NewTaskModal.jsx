import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, TIME_OPTIONS, ENERGY_OPTIONS, PRIORITY_OPTIONS } from '../lib/filters'
import useBreakpoint from '../hooks/useBreakpoint'
import { computeSuggestions } from '../lib/taskSuggestions'

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'name',               label: 'Task name',       required: true, type: 'text',   placeholder: 'Task name',           width: 'min-w-[220px] w-[220px]' },
  { key: 'category',           label: 'Category',                        type: 'select', options: CATEGORIES,                width: 'min-w-[130px] w-[130px]' },
  { key: 'estimated_time',     label: 'Est. time',                       type: 'select', options: TIME_OPTIONS,               width: 'min-w-[110px] w-[110px]' },
  { key: 'energy',             label: 'Energy',                          type: 'select', options: ENERGY_OPTIONS,             width: 'min-w-[100px] w-[100px]' },
  { key: 'priority',           label: 'Priority',                        type: 'select', options: PRIORITY_OPTIONS,           width: 'min-w-[100px] w-[100px]' },
  { key: 'minimum_completion', label: 'Min. completion',                 type: 'text',   placeholder: 'What counts as done', width: 'min-w-[200px] w-[200px]' },
  { key: 'next_action',        label: 'Next action',                     type: 'text',   placeholder: 'First concrete step', width: 'min-w-[200px] w-[200px]' },
]

const EMPTY_ROW = { name: '', category: '', estimated_time: '', energy: '', priority: '', minimum_completion: '', next_action: '' }
const makeRows = (n) => Array.from({ length: n }, () => ({ ...EMPTY_ROW }))
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── Mobile helpers ────────────────────────────────────────────────────────────

function MobileLabel({ children, required }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </p>
  )
}

const SELECT_CLS = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

// ── Ghost text input (text + textarea) ───────────────────────────────────────
// Renders an overlay of gray suggestion text behind a transparent input.
// Tab or → (right arrow) on empty input accepts the suggestion.
// On mobile, tapping the wrapper accepts it.

function GhostTextCell({
  value, onChange, suggestion, onAccept, placeholder,
  onKeyDown: externalKeyDown,
  isMobile = false, isTextarea = false, textareaRows = 2,
  wrapperCls = 'rounded-md border',
  inputCls   = 'w-full px-2 py-1.5 text-sm text-gray-700',
}) {
  const showGhost = !value && Boolean(suggestion)
  const Tag = isTextarea ? 'textarea' : 'input'

  const handleKeyDown = (e) => {
    if (showGhost) {
      if (e.key === 'Tab') {
        // Accept; don't preventDefault so Tab still moves focus naturally
        onAccept(suggestion)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onAccept(suggestion)
        return
      }
    }
    externalKeyDown?.(e)
  }

  return (
    <div
      className={`relative bg-white transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 ${wrapperCls} ${showGhost ? 'border-indigo-200' : 'border-gray-200'}`}
      onClick={isMobile && showGhost ? () => onAccept(suggestion) : undefined}
    >
      {/* Ghost text layer */}
      {showGhost && (
        <div
          aria-hidden
          className={`absolute left-0 right-0 pointer-events-none overflow-hidden ${
            isTextarea ? 'top-0 px-3 pt-2.5' : 'inset-0 flex items-center px-2'
          }`}
        >
          <span className="text-sm text-gray-300 block truncate leading-snug pr-14">{suggestion}</span>
        </div>
      )}

      <Tag
        {...(!isTextarea && { type: 'text' })}
        {...(isTextarea && { rows: textareaRows })}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={showGhost ? '' : placeholder}
        className={`${inputCls} bg-transparent outline-none border-0 w-full`}
        style={isTextarea ? undefined : undefined}
      />

      {/* Hint badge */}
      {showGhost && (
        <div className={`absolute pointer-events-none z-10 ${isTextarea ? 'top-1.5 right-1.5' : 'right-1.5 top-1/2 -translate-y-1/2'}`}>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap border ${
            isMobile
              ? 'bg-indigo-50 text-indigo-500 border-indigo-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            {isMobile ? 'Tap' : 'Tab ↹'}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Ghost select (native <select> with hint in the placeholder option) ────────
// Empty option shows "↹ Fitness" when there's a ghost suggestion.
// Tab while empty + suggestion → accepts.

function GhostSelectCell({ value, onChange, ghostSuggestion, onAcceptGhost, options }) {
  const showGhost = !value && Boolean(ghostSuggestion)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (showGhost && e.key === 'Tab') onAcceptGhost(ghostSuggestion)
      }}
      className={`w-full rounded-md border px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-colors ${
        showGhost ? 'border-indigo-200 text-indigo-400 italic' : 'border-gray-200 text-gray-700'
      }`}
    >
      <option value="">{showGhost ? `↹ ${cap(ghostSuggestion)}` : '—'}</option>
      {options.map(opt => <option key={opt} value={opt}>{cap(opt)}</option>)}
    </select>
  )
}

// ── Spinner cell (shown while AI is fetching) ─────────────────────────────────

function SpinnerCell() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-indigo-400 italic">
      <svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
      </svg>
      Suggesting…
    </div>
  )
}

// ── API helper ────────────────────────────────────────────────────────────────

async function fetchSuggestion(name, category, estimated_time) {
  const res = await fetch('/api/suggest-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category, estimated_time }),
  })
  if (!res.ok) throw new Error('Suggestion request failed')
  return res.json()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewTaskModal({ isOpen, onClose, userId, onSuccess, initialName = '' }) {
  const { isMobile } = useBreakpoint()

  // Desktop
  const [rows, setRows]                           = useState(makeRows(5))
  const [suggestingRows, setSuggestingRows]       = useState(new Set())
  // rowMeta[i] = { suggested, ghost: { name?, category?, estimated_time?, energy? }, placeholder }
  const [rowMeta, setRowMeta]                     = useState({})
  // AI ghost text for minimum_completion / next_action per row
  const [aiGhostSuggestions, setAiGhostSuggestions] = useState({})

  // Mobile
  const [mobileForm, setMobileForm]               = useState({ ...EMPTY_ROW })
  const [suggesting, setSuggesting]               = useState(false)
  const [mobileSuggestion, setMobileSuggestion]   = useState({ minimum_completion: '', next_action: '' })

  // Shared
  const [submitting, setSubmitting]               = useState(false)
  const [error, setError]                         = useState('')

  // ── initialName: pre-fill from a suggestion pill click ──────────────────────
  useEffect(() => {
    if (!isOpen || !initialName) return
    if (isMobile) {
      setMobileForm(prev => ({ ...prev, name: initialName }))
    } else {
      setRows(prev => prev.map((r, i) => i === 0 ? { ...r, name: initialName } : r))
      setRowMeta(prev => { const n = { ...prev }; delete n[0]; return n })
    }
  }, [isOpen, initialName, isMobile])

  // ── History-based ghost suggestions on desktop open ──────────────────────────
  useEffect(() => {
    if (!isOpen || !userId || window.innerWidth < 768) return
    if (initialName) return // skip history prefill when opening with a preset name
    let cancelled = false

    async function load() {
      try {
        const { data } = await supabase
          .from('tasks')
          .select('name, category, estimated_time, energy, date_created')
          .eq('user_id', userId)
          .order('date_created', { ascending: false })
          .limit(30)

        if (cancelled || !data?.length) return
        const suggestions = computeSuggestions(data)
        if (!suggestions.length) return

        const newRows = makeRows(5)
        const newMeta = {}

        suggestions.forEach((s, i) => {
          // Rows stay EMPTY — suggestions live in rowMeta as ghost text
          newRows[i] = { ...EMPTY_ROW }
          newMeta[i] = {
            suggested: true,
            placeholder: s.placeholder || '',
            ghost: {
              ...(s.name           && { name:           s.name }),
              ...(s.category       && { category:       s.category }),
              ...(s.estimated_time && { estimated_time: s.estimated_time }),
              ...(s.energy         && { energy:         s.energy }),
            },
          }
        })

        if (!cancelled) { setRows(newRows); setRowMeta(newMeta) }
      } catch { /* fall back to empty rows */ }
    }

    load()
    return () => { cancelled = true }
  }, [isOpen, userId])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setMobileField = (field, value) =>
    setMobileForm(prev => ({ ...prev, [field]: value }))

  const update = (i, field, value) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
    // Editing the name dismisses the entire "suggested" row status
    if (field === 'name') {
      setRowMeta(prev => { if (!prev[i]?.suggested) return prev; const n = { ...prev }; delete n[i]; return n })
      setAiGhostSuggestions(prev => { if (!prev[i]) return prev; const n = { ...prev }; delete n[i]; return n })
    }
  }

  // Accept a history ghost suggestion (name / category / estimated_time / energy)
  const acceptHistoryGhost = (rowIndex, field, value) => {
    update(rowIndex, field, value)
    setRowMeta(prev => {
      if (!prev[rowIndex]?.ghost) return prev
      const next = { ...prev }
      const ghost = { ...next[rowIndex].ghost }
      delete ghost[field]
      next[rowIndex] = { ...next[rowIndex], ghost }
      return next
    })
  }

  // Accept an AI ghost suggestion (minimum_completion / next_action)
  const acceptAiGhost = (rowIndex, field, value) => {
    update(rowIndex, field, value)
    setAiGhostSuggestions(prev => {
      if (!prev[rowIndex]) return prev
      const next = { ...prev }
      const row = { ...next[rowIndex] }
      delete row[field]
      next[rowIndex] = row
      return next
    })
  }

  const handleClose = () => {
    setRows(makeRows(5))
    setRowMeta({})
    setAiGhostSuggestions({})
    setMobileForm({ ...EMPTY_ROW })
    setMobileSuggestion({ minimum_completion: '', next_action: '' })
    setSuggestingRows(new Set())
    setSuggesting(false)
    setError('')
    onClose()
  }

  // ── AI suggestion: mobile → ghost text (not direct prefill) ──────────────────
  const suggestForMobile = async (formSnap) => {
    if (!formSnap.name.trim() || !formSnap.estimated_time) return
    if (formSnap.minimum_completion.trim() && formSnap.next_action.trim()) return
    setSuggesting(true)
    try {
      const { minimum_completion, next_action } = await fetchSuggestion(
        formSnap.name.trim(), formSnap.category, formSnap.estimated_time
      )
      setMobileSuggestion(prev => ({
        minimum_completion: formSnap.minimum_completion.trim() ? prev.minimum_completion : (minimum_completion ?? ''),
        next_action:        formSnap.next_action.trim()        ? prev.next_action        : (next_action        ?? ''),
      }))
    } catch { }
    finally { setSuggesting(false) }
  }

  // ── AI suggestion: desktop row → ghost text (not direct prefill) ─────────────
  const suggestForRow = async (rowIndex, rowSnap) => {
    if (suggestingRows.has(rowIndex)) return
    if (!rowSnap.name.trim() || !rowSnap.estimated_time) return
    if (rowSnap.minimum_completion.trim() && rowSnap.next_action.trim()) return
    const existing = aiGhostSuggestions[rowIndex]
    if (existing?.minimum_completion && existing?.next_action) return

    setSuggestingRows(prev => new Set([...prev, rowIndex]))
    try {
      const { minimum_completion, next_action } = await fetchSuggestion(
        rowSnap.name.trim(), rowSnap.category, rowSnap.estimated_time
      )
      setAiGhostSuggestions(prev => ({
        ...prev,
        [rowIndex]: {
          minimum_completion: rowSnap.minimum_completion.trim() ? undefined : minimum_completion,
          next_action:        rowSnap.next_action.trim()        ? undefined : next_action,
        },
      }))
    } catch { }
    finally {
      setSuggestingRows(prev => { const s = new Set(prev); s.delete(rowIndex); return s })
    }
  }

  // ── Insert ───────────────────────────────────────────────────────────────────
  const insertTasks = async (records) => {
    setSubmitting(true)
    setError('')
    try {
      const { error: err } = await supabase.from('tasks').insert(records)
      if (err) throw err
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message ?? 'Failed to save.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDesktopSubmit = () => {
    const valid = rows.filter(r => r.name.trim())
    if (!valid.length) { setError('Enter at least one task name.'); return }
    insertTasks(valid.map(r => ({
      user_id: userId, status: 'backlog',
      name: r.name.trim(),
      category: r.category || null,
      estimated_time: r.estimated_time || null,
      energy: r.energy || null,
      priority: r.priority || 'medium',
      minimum_completion: r.minimum_completion.trim() || null,
      next_action: r.next_action.trim() || null,
    })))
  }

  const handleMobileSubmit = () => {
    if (!mobileForm.name.trim()) { setError('Enter a task name.'); return }
    insertTasks([{
      user_id: userId, status: 'backlog',
      name: mobileForm.name.trim(),
      category: mobileForm.category || null,
      estimated_time: mobileForm.estimated_time || null,
      energy: mobileForm.energy || null,
      priority: mobileForm.priority || 'medium',
      minimum_completion: mobileForm.minimum_completion.trim() || null,
      next_action: mobileForm.next_action.trim() || null,
    }])
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE — bottom sheet
  // ════════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        )}

        <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
          flex flex-col max-h-[90vh] transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-9 h-1 bg-slate-300 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-slate-900">New Task</h2>
              <p className="text-xs text-slate-400 mt-0.5">Fill in the details below.</p>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            {/* Name */}
            <div>
              <MobileLabel required>Task name</MobileLabel>
              <input
                type="text"
                value={mobileForm.name}
                onChange={e => setMobileField('name', e.target.value)}
                onBlur={() => suggestForMobile(mobileForm)}
                placeholder="What do you need to do?"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* 2-col selects */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MobileLabel>Category</MobileLabel>
                <select value={mobileForm.category} onChange={e => setMobileField('category', e.target.value)} className={SELECT_CLS}>
                  <option value="">—</option>
                  {CATEGORIES.map(o => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              </div>
              <div>
                <MobileLabel>Est. time</MobileLabel>
                <select
                  value={mobileForm.estimated_time}
                  onChange={e => {
                    const val = e.target.value
                    setMobileField('estimated_time', val)
                    suggestForMobile({ ...mobileForm, estimated_time: val })
                  }}
                  className={SELECT_CLS}
                >
                  <option value="">—</option>
                  {TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <MobileLabel>Energy</MobileLabel>
                <select value={mobileForm.energy} onChange={e => setMobileField('energy', e.target.value)} className={SELECT_CLS}>
                  <option value="">—</option>
                  {ENERGY_OPTIONS.map(o => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              </div>
              <div>
                <MobileLabel>Priority</MobileLabel>
                <select value={mobileForm.priority} onChange={e => setMobileField('priority', e.target.value)} className={SELECT_CLS}>
                  <option value="">—</option>
                  {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              </div>
            </div>

            {/* Suggesting indicator */}
            {suggesting && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-400">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Suggesting…
              </div>
            )}

            {/* Min completion — ghost text */}
            <div>
              <MobileLabel>Minimum completion</MobileLabel>
              <GhostTextCell
                value={mobileForm.minimum_completion}
                onChange={e => {
                  setMobileField('minimum_completion', e.target.value)
                  if (e.target.value) setMobileSuggestion(prev => ({ ...prev, minimum_completion: '' }))
                }}
                suggestion={mobileSuggestion.minimum_completion}
                onAccept={val => {
                  setMobileField('minimum_completion', val)
                  setMobileSuggestion(prev => ({ ...prev, minimum_completion: '' }))
                }}
                placeholder="What counts as done"
                isTextarea
                textareaRows={2}
                isMobile
                wrapperCls="rounded-lg border"
                inputCls="w-full px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            {/* Next action — ghost text */}
            <div>
              <MobileLabel>Next action</MobileLabel>
              <GhostTextCell
                value={mobileForm.next_action}
                onChange={e => {
                  setMobileField('next_action', e.target.value)
                  if (e.target.value) setMobileSuggestion(prev => ({ ...prev, next_action: '' }))
                }}
                suggestion={mobileSuggestion.next_action}
                onAccept={val => {
                  setMobileField('next_action', val)
                  setMobileSuggestion(prev => ({ ...prev, next_action: '' }))
                }}
                placeholder="First concrete step"
                isTextarea
                textareaRows={2}
                isMobile
                wrapperCls="rounded-lg border"
                inputCls="w-full px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4 pb-8 border-t border-slate-100 flex-shrink-0">
            {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
            <div className="flex gap-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleMobileSubmit}
                disabled={submitting || !mobileForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Saving…' : 'Save task'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DESKTOP — centered modal
  // ════════════════════════════════════════════════════════════════════════════
  if (!isOpen) return null

  const validCount = rows.filter(r => r.name.trim()).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 flex flex-col max-h-[85vh]">

        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Tasks</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Suggestions in gray — Tab or → to accept. Empty rows are skipped.
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="w-12 px-3 py-2.5" />
                {COLUMNS.map(col => (
                  <th key={col.key} className={`px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.width}`}>
                    {col.label}{col.required && <span className="text-red-400 ml-0.5">*</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const hasName      = Boolean(row.name.trim())
                const isSuggested  = Boolean(rowMeta[i]?.suggested) && !hasName
                const isSuggesting = suggestingRows.has(i)
                const ghost        = rowMeta[i]?.ghost ?? {}
                const aiGhost      = aiGhostSuggestions[i] ?? {}

                return (
                  <tr
                    key={i}
                    className={`border-b border-gray-50 transition-colors ${
                      hasName     ? 'bg-indigo-50/40' :
                      isSuggested ? 'bg-indigo-50/10' :
                                    'hover:bg-gray-50/60'
                    }`}
                  >
                    {/* Row number + badge */}
                    <td className="px-3 py-2 text-right select-none">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-gray-300">{i + 1}</span>
                        {isSuggested && (
                          <span className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wide leading-none">
                            suggested
                          </span>
                        )}
                      </div>
                    </td>

                    {COLUMNS.map(col => {
                      const historySuggestion = ghost[col.key] ?? null
                      const aiSuggestion      = aiGhost[col.key] ?? null
                      const suggestion        = historySuggestion || aiSuggestion
                      const isAiSpinning      = isSuggesting && (col.key === 'minimum_completion' || col.key === 'next_action')

                      return (
                        <td key={col.key} className="px-2 py-1.5">
                          {isAiSpinning ? (
                            <SpinnerCell />
                          ) : col.type === 'select' ? (
                            <GhostSelectCell
                              value={row[col.key]}
                              onChange={val => {
                                update(i, col.key, val)
                                if (col.key === 'estimated_time') suggestForRow(i, { ...row, estimated_time: val })
                              }}
                              ghostSuggestion={historySuggestion}
                              onAcceptGhost={val => acceptHistoryGhost(i, col.key, val)}
                              options={col.options}
                            />
                          ) : (
                            <GhostTextCell
                              value={row[col.key]}
                              onChange={e => update(i, col.key, e.target.value)}
                              suggestion={suggestion}
                              onAccept={val =>
                                historySuggestion ? acceptHistoryGhost(i, col.key, val) : acceptAiGhost(i, col.key, val)
                              }
                              placeholder={
                                col.key === 'name' && rowMeta[i]?.placeholder && !ghost.name
                                  ? rowMeta[i].placeholder
                                  : col.placeholder
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter' && col.key === 'next_action' && i === rows.length - 1) handleDesktopSubmit()
                              }}
                              wrapperCls="rounded-md border"
                              inputCls="w-full px-2 py-1.5 text-sm text-gray-700"
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="px-5 py-3">
            <button
              onClick={() => setRows(prev => [...prev, ...makeRows(5)])}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              More tasks
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : (
            <p className="text-xs text-gray-400">
              {validCount > 0 ? `${validCount} task${validCount > 1 ? 's' : ''} ready to save` : 'No tasks yet — add a name to get started'}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDesktopSubmit}
              disabled={submitting || validCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving…' : `Save ${validCount > 0 ? validCount : ''} task${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
