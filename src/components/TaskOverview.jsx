import { useState, useMemo } from 'react'
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
  if ((task.actual_time_spent_seconds ?? 0) > 0) {
    return task.actual_time_spent_seconds / 3600
  }
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

function fmtHours(h) {
  return `${h.toFixed(1)}h`
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

export default function TaskOverview({ tasks }) {
  const [range, setRange] = useState('7d')
  const { isMobile } = useBreakpoint()
  const data = useMemo(() => processData(tasks, range), [tasks, range])

  const totalTasks = data.reduce((s, d) => s + d.count, 0)
  const totalHours = data.reduce((s, d) => s + d.hours, 0)
  const isEmpty = data.length === 0

  // Smaller radii on mobile so the donut fits in a 160px container
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

      {/* Scrollable body — max-h-[70vh] guards against extreme viewport overflow */}
      <div className="overflow-y-auto max-h-[70vh]">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-600">
            <svg className="w-7 h-7 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm tracking-wide">No completed tasks for this period.</p>
          </div>
        ) : (
          /*
           * Mobile:  flex-col — chart centered, legend stacked below
           * Desktop: flex-row — chart left, legend right
           */
          <div className="flex flex-col items-center gap-6 px-4 py-6 md:flex-row md:items-center md:gap-10 md:px-6">

            {/* Donut chart — smaller on mobile */}
            <div className="relative flex-shrink-0 w-40 h-40 md:w-48 md:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={data.length > 1 ? 2 : 0}
                    dataKey="hours"
                    strokeWidth={0}
                  >
                    {data.map(entry => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category] ?? FALLBACK_COLOR}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-light text-slate-100 leading-none tracking-tight md:text-2xl">
                  {fmtHours(totalHours)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1.5 tracking-wide">
                  {totalTasks} done
                </span>
              </div>
            </div>

            {/* Category legend — vertical stack on both mobile and desktop */}
            <div className="w-full flex flex-col gap-2.5 md:flex-1 md:min-w-0 md:gap-3">
              {data.map(d => {
                const color = CATEGORY_COLORS[d.category] ?? FALLBACK_COLOR
                const pct = totalHours > 0 ? (d.hours / totalHours) * 100 : 0
                return (
                  <div key={d.category}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-sm text-slate-300 capitalize flex-1 min-w-0 truncate">
                        {d.category}
                      </span>
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

              {/* Total row */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-700/50">
                <span className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex-1">
                  Total
                </span>
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
