import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, TIME_OPTIONS, ENERGY_OPTIONS, PRIORITY_OPTIONS } from '../lib/filters'
import useBreakpoint from '../hooks/useBreakpoint'

// ── Desktop table column definitions ────────────────────────────────────────

const COLUMNS = [
  { key: 'name',               label: 'Task name',       required: true, type: 'text',   placeholder: 'Task name',           width: 'min-w-[220px] w-[220px]' },
  { key: 'category',           label: 'Category',                        type: 'select', options: CATEGORIES,                width: 'min-w-[130px] w-[130px]' },
  { key: 'estimated_time',     label: 'Est. time',                       type: 'select', options: TIME_OPTIONS,               width: 'min-w-[110px] w-[110px]' },
  { key: 'energy',             label: 'Energy',                          type: 'select', options: ENERGY_OPTIONS,             width: 'min-w-[100px] w-[100px]' },
  { key: 'priority',           label: 'Priority',                        type: 'select', options: PRIORITY_OPTIONS,           width: 'min-w-[100px] w-[100px]' },
  { key: 'minimum_completion', label: 'Min. completion',                 type: 'text',   placeholder: 'What counts as done', width: 'min-w-[200px] w-[200px]' },
  { key: 'next_action',        label: 'Next action',                     type: 'text',   placeholder: 'First concrete step', width: 'min-w-[200px] w-[200px]' },
]

const EMPTY_ROW = {
  name: '', category: '', estimated_time: '', energy: '',
  priority: '', minimum_completion: '', next_action: '',
}

const makeRows = (n) => Array.from({ length: n }, () => ({ ...EMPTY_ROW }))

function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1) }

// ── Mobile sub-components ────────────────────────────────────────────────────

function MobileLabel({ children, required }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </p>
  )
}

const INPUT_CLS = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const SELECT_CLS = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

// ── Main component ────────────────────────────────────────────────────────────

export default function NewTaskModal({ isOpen, onClose, userId, onSuccess }) {
  const { isMobile } = useBreakpoint()

  // Desktop state
  const [rows, setRows]           = useState(makeRows(5))
  // Mobile state
  const [mobileForm, setMobileForm] = useState({ ...EMPTY_ROW })
  // Shared
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const setMobileField = (field, value) =>
    setMobileForm(prev => ({ ...prev, [field]: value }))

  const update = (i, field, value) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const handleClose = () => {
    setRows(makeRows(5))
    setMobileForm({ ...EMPTY_ROW })
    setError('')
    onClose()
  }

  // ── Shared insert helper ──────────────────────────────────────────────────
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

  // ── Desktop: batch submit ─────────────────────────────────────────────────
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

  // ── Mobile: single submit ─────────────────────────────────────────────────
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
  // MOBILE — bottom sheet (always in DOM so transition plays)
  // ════════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
        )}

        {/* Sheet */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
            flex flex-col max-h-[90vh]
            transition-transform duration-300 ease-out
            ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-9 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
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

          {/* Scrollable form */}
          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            {/* Name */}
            <div>
              <MobileLabel required>Task name</MobileLabel>
              <input
                type="text"
                value={mobileForm.name}
                onChange={e => setMobileField('name', e.target.value)}
                placeholder="What do you need to do?"
                className={INPUT_CLS}
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
                <select value={mobileForm.estimated_time} onChange={e => setMobileField('estimated_time', e.target.value)} className={SELECT_CLS}>
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

            {/* Min completion */}
            <div>
              <MobileLabel>Minimum completion</MobileLabel>
              <textarea
                value={mobileForm.minimum_completion}
                onChange={e => setMobileField('minimum_completion', e.target.value)}
                placeholder="What counts as done"
                rows={2}
                className={`${INPUT_CLS} resize-none`}
              />
            </div>

            {/* Next action */}
            <div>
              <MobileLabel>Next action</MobileLabel>
              <textarea
                value={mobileForm.next_action}
                onChange={e => setMobileField('next_action', e.target.value)}
                placeholder="First concrete step"
                rows={2}
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 pb-8 border-t border-slate-100 flex-shrink-0">
            {error
              ? <p className="text-xs text-red-500">{error}</p>
              : <span />}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
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
  // DESKTOP — centered modal (unchanged)
  // ════════════════════════════════════════════════════════════════════════════
  if (!isOpen) return null

  const validCount = rows.filter(r => r.name.trim()).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Tasks</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Fill in as many rows as you need. Empty rows are skipped on save.
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable table */}
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="w-8 px-3 py-2.5" />
                {COLUMNS.map(col => (
                  <th key={col.key} className={`px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.width}`}>
                    {col.label}
                    {col.required && <span className="text-red-400 ml-0.5">*</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const hasName = Boolean(row.name.trim())
                return (
                  <tr key={i} className={`border-b border-gray-50 transition-colors ${hasName ? 'bg-indigo-50/40' : 'hover:bg-gray-50/60'}`}>
                    <td className="px-3 py-2 text-xs text-gray-300 text-right select-none">{i + 1}</td>
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-2 py-1.5">
                        {col.type === 'select' ? (
                          <select
                            value={row[col.key]}
                            onChange={e => update(i, col.key, e.target.value)}
                            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                          >
                            <option value="">—</option>
                            {col.options.map(opt => <option key={opt} value={opt}>{cap(opt)}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={row[col.key]}
                            onChange={e => update(i, col.key, e.target.value)}
                            placeholder={col.placeholder}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && col.key === 'next_action' && i === rows.length - 1) handleDesktopSubmit()
                            }}
                            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* More tasks */}
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

        {/* Footer */}
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
