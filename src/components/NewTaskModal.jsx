import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, TIME_OPTIONS, ENERGY_OPTIONS, PRIORITY_OPTIONS } from '../lib/filters'

const COLUMNS = [
  {
    key: 'name',
    label: 'Task name',
    required: true,
    type: 'text',
    placeholder: 'Task name',
    width: 'min-w-[220px] w-[220px]',
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: CATEGORIES,
    width: 'min-w-[130px] w-[130px]',
  },
  {
    key: 'estimated_time',
    label: 'Est. time',
    type: 'select',
    options: TIME_OPTIONS,
    width: 'min-w-[110px] w-[110px]',
  },
  {
    key: 'energy_required',
    label: 'Energy',
    type: 'select',
    options: ENERGY_OPTIONS,
    width: 'min-w-[100px] w-[100px]',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: PRIORITY_OPTIONS,
    width: 'min-w-[100px] w-[100px]',
  },
  {
    key: 'min_completion',
    label: 'Min. completion',
    type: 'text',
    placeholder: 'What counts as done',
    width: 'min-w-[200px] w-[200px]',
  },
  {
    key: 'next_action',
    label: 'Next action',
    type: 'text',
    placeholder: 'First concrete step',
    width: 'min-w-[200px] w-[200px]',
  },
]

const EMPTY_ROW = {
  name: '',
  category: '',
  estimated_time: '',
  energy_required: '',
  priority: '',
  min_completion: '',
  next_action: '',
}

const makeRows = (n) => Array.from({ length: n }, () => ({ ...EMPTY_ROW }))

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default function NewTaskModal({ isOpen, onClose, userId, onSuccess }) {
  const [rows, setRows] = useState(makeRows(5))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const update = (i, field, value) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const handleClose = () => {
    setRows(makeRows(5))
    setError('')
    onClose()
  }

  const handleSubmit = async () => {
    const valid = rows.filter(r => r.name.trim())
    if (!valid.length) { setError('Enter at least one task name.'); return }
    setSubmitting(true)
    setError('')
    try {
      const { error: err } = await supabase.from('tasks').insert(
        valid.map(r => ({
          user_id: userId,
          status: 'backlog',
          name: r.name.trim(),
          category: r.category || null,
          estimated_time: r.estimated_time || null,
          energy_required: r.energy_required || null,
          priority: r.priority || 'medium',
          min_completion: r.min_completion.trim() || null,
          next_action: r.next_action.trim() || null,
        }))
      )
      if (err) throw err
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message ?? 'Failed to save tasks.')
    } finally {
      setSubmitting(false)
    }
  }

  const validCount = rows.filter(r => r.name.trim()).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Tasks</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Fill in as many rows as you need. Empty rows are skipped on save.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable table area */}
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-200">
                {/* row number gutter */}
                <th className="w-8 px-3 py-2.5" />
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.width}`}
                  >
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
                  <tr
                    key={i}
                    className={`border-b border-gray-50 transition-colors ${hasName ? 'bg-indigo-50/40' : 'hover:bg-gray-50/60'}`}
                  >
                    {/* Row number */}
                    <td className="px-3 py-2 text-xs text-gray-300 text-right select-none">
                      {i + 1}
                    </td>

                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-2 py-1.5">
                        {col.type === 'select' ? (
                          <select
                            value={row[col.key]}
                            onChange={e => update(i, col.key, e.target.value)}
                            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                          >
                            <option value="">—</option>
                            {col.options.map(opt => (
                              <option key={opt} value={opt}>{cap(opt)}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={row[col.key]}
                            onChange={e => update(i, col.key, e.target.value)}
                            placeholder={col.placeholder}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && col.key === 'next_action' && i === rows.length - 1) {
                                handleSubmit()
                              }
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

          {/* More tasks button */}
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
              {validCount > 0
                ? `${validCount} task${validCount > 1 ? 's' : ''} ready to save`
                : 'No tasks yet — add a name to get started'}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || validCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? 'Saving…'
                : `Save ${validCount > 0 ? validCount : ''} task${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
