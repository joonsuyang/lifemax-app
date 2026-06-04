import { useState, useEffect, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import useBreakpoint from '../hooks/useBreakpoint'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  'fitness':      '#818cf8',
  'social':       '#f472b6',
  'errand':       '#fbbf24',
  'side project': '#34d399',
  'admin':        '#94a3b8',
  'personal':     '#a78bfa',
  'other':        '#475569',
}
const FALLBACK_COLOR = '#334155'

const TIME_TO_HOURS = {
  '10 min':  1 / 6,
  '30 min':  0.5,
  '45 min':  0.75,
  '60 min':  1,
  '>60 min': 1.5,
}

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: '7 days' },
  { value: '30d',   label: '30 days' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCutoff(range) {
  const now = new Date()
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(now)
  d.setDate(d.getDate() - (range === '7d' ? 7 : 30))
  return d
}

function taskHours(task) {
  if ((task.actual_time_spent_seconds ?? 0) > 0) return task.actual_time_spent_seconds / 3600
  return TIME_TO_HOURS[task.estimated_time] ?? 0
}

function processData(tasks, range) {
  const cutoff = getCutoff(range)
  const completed = tasks.filter(
    t => t.status === 'done' && t.date_completed && new Date(t.date_completed) >= cutoff
  )
  const byCategory = {}
  completed.forEach(task => {
    const cat = task.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = { count: 0, hours: 0 }
    byCategory[cat].count++
    byCategory[cat].hours += taskHours(task)
  })
  return Object.entries(byCategory)
    .map(([category, { count, hours }]) => ({ category, count, hours }))
    .sort((a, b) => b.hours - a.hours)
}

function fmtHours(h) { return `${h.toFixed(1)}h` }

// ── AI Summary sub-components ─────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  )
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform ${spinning ? 'animate-spin' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function SummarySkeleton() {
  return (
    <div className="bg-slate-700/40 rounded-xl p-4 mb-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3.5 h-3.5 bg-slate-600 rounded-full" />
        <div className="h-2.5 bg-slate-600 rounded w-16" />
        <div className="h-2.5 bg-slate-700 rounded w-24 ml-1" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-slate-600 rounded w-full" />
        <div className="h-3 bg-slate-600 rounded w-4/5" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-slate-600 rounded-full w-28" />
        <div className="h-6 bg-slate-600 rounded-full w-24" />
        <div className="h-6 bg-slate-600 rounded-full w-32" />
      </div>
    </div>
  )
}

function SummaryCard({ summary, onNewTask, onRefresh, refreshing }) {
  return (
    <div className="bg-slate-700/40 rounded-xl p-4 mb-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SparkleIcon />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
            AI Summary
          </span>
          <span className="text-[10px] text-slate-600">· Based on last 7 days</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Regenerate summary"
          className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40 flex-shrink-0 mt-0.5"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </div>

      {/* Summary text */}
      <p className="text-sm text-slate-300 leading-relaxed mb-3">
        {summary.summary}
      </p>

      {/* Suggestion pills */}
      {summary.suggestions?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {summary.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onNewTask(s)}
              className="shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 rounded-full hover:bg-indigo-500/25 hover:border-indigo-500/40 active:scale-95 transition-all"
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-3 py-2 text-sm">
      <p className="font-medium text-slate-200 capitalize mb-0.5">{d.category}</p>
      <p className="text-slate-400 text-xs">
        {d.count} task{d.count !== 1 ? 's' : ''}, {d.hours.toFixed(1)} hrs
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskOverview({ tasks, userId, onNewTask }) {
  const [range, setRange] = useState('7d')
  const { isMobile } = useBreakpoint()

  // Weekly AI summary — independent of the range filter
  const [weeklySummary, setWeeklySummary]   = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const fetchSummary = useCallback(async () => {
    if (!userId) return
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/weekly-summary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setWeeklySummary(data)
    } catch { /* silently fail — chart still renders */ }
    finally { setSummaryLoading(false) }
  }, [userId])

  // Fetch on mount and when user changes
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const data = useMemo(() => processData(tasks, range), [tasks, range])

  const totalTasks = data.reduce((s, d) => s + d.count, 0)
  const totalHours = data.reduce((s, d) => s + d.hours, 0)
  const isEmpty    = data.length === 0

  const innerRadius = isMobile ? 38 : 52
  const outerRadius = isMobile ? 62 : 82

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl mt-6 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/50 md:px-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            Completed Tasks
          </h2>
          {!isEmpty && (
            <p className="text-xs text-slate-600 mt-0.5">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''} · {fmtHours(totalHours)} tracked
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 bg-slate-900/60 rounded-lg p-0.5">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                range === r.value
                  ? 'bg-slate-700 text-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto max-h-[70vh]">

        {/* ── AI weekly summary card ── */}
        <div className="px-4 pt-4 md:px-6">
          {summaryLoading && !weeklySummary ? (
            <SummarySkeleton />
          ) : weeklySummary ? (
            <SummaryCard
              summary={weeklySummary}
              onNewTask={onNewTask}
              onRefresh={fetchSummary}
              refreshing={summaryLoading}
            />
          ) : null}
        </div>

        {/* ── Chart + breakdown ── */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-600">
            <svg className="w-7 h-7 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm tracking-wide">No completed tasks for this period.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 px-4 py-4 md:flex-row md:items-center md:gap-10 md:px-6 md:py-6">

            {/* Donut */}
            <div className="relative flex-shrink-0 w-40 h-40 md:w-48 md:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%" cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={data.length > 1 ? 2 : 0}
                    dataKey="hours"
                    strokeWidth={0}
                  >
                    {data.map(entry => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? FALLBACK_COLOR} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-light text-slate-100 leading-none tracking-tight md:text-2xl">
                  {fmtHours(totalHours)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1.5 tracking-wide">
                  {totalTasks} done
                </span>
              </div>
            </div>

            {/* Category legend */}
            <div className="w-full flex flex-col gap-2.5 md:flex-1 md:min-w-0 md:gap-3">
              {data.map(d => {
                const color = CATEGORY_COLORS[d.category] ?? FALLBACK_COLOR
                const pct   = totalHours > 0 ? (d.hours / totalHours) * 100 : 0
                return (
                  <div key={d.category}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-sm text-slate-300 capitalize flex-1 min-w-0 truncate">{d.category}</span>
                      <span className="text-xs text-slate-500 flex-shrink-0 tabular-nums whitespace-nowrap">
                        {d.count} task{d.count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs font-medium text-slate-300 flex-shrink-0 tabular-nums w-14 text-right">
                        {d.hours.toFixed(1)} hrs
                      </span>
                    </div>
                    <div className="ml-5 h-0.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color, opacity: 0.7 }}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-700/50">
                <span className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex-1">Total</span>
                <span className="text-xs text-slate-500 flex-shrink-0 tabular-nums whitespace-nowrap">
                  {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-semibold text-slate-200 flex-shrink-0 tabular-nums w-14 text-right">
                  {totalHours.toFixed(1)} hrs
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
