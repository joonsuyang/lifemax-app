import useBreakpoint from '../hooks/useBreakpoint'
import TaskCard from './TaskCard'

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

function sortColumn(tasks, colKey) {
  return [...tasks].sort((a, b) => {
    // Primary: priority descending (critical → low)
    const pa = PRIORITY_ORDER[a.priority] ?? 4
    const pb = PRIORITY_ORDER[b.priority] ?? 4
    if (pa !== pb) return pa - pb

    // Secondary: date-based tiebreak
    if (colKey === 'done') {
      // Most recently completed first
      return new Date(b.date_completed ?? 0) - new Date(a.date_completed ?? 0)
    }
    // Oldest created first (surfaces long-standing tasks)
    return new Date(a.date_created ?? 0) - new Date(b.date_created ?? 0)
  })
}

const COLUMNS = [
  {
    key: 'today',
    label: 'To-Do Today',
    labelColor: 'text-blue-400',
    countStyle: 'bg-blue-950/80 text-blue-400',
    dot: 'bg-blue-400',
    bg: 'bg-blue-950/40',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    labelColor: 'text-amber-400',
    countStyle: 'bg-amber-950/80 text-amber-400',
    dot: 'bg-amber-400',
    bg: 'bg-amber-950/30',
  },
  {
    key: 'backlog',
    label: 'Backlog',
    labelColor: 'text-slate-400',
    countStyle: 'bg-slate-700/80 text-slate-400',
    dot: 'bg-slate-500',
    bg: 'bg-slate-800/50',
  },
  {
    key: 'done',
    label: 'Done',
    labelColor: 'text-emerald-400',
    countStyle: 'bg-emerald-950/80 text-emerald-400',
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-950/30',
  },
]

const MOBILE_ORDER = ['today', 'in_progress', 'backlog', 'done']

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-slate-700/40 rounded-xl p-4">
          <div className="h-3 bg-slate-700 rounded-full w-3/4 mb-3" />
          <div className="h-3 bg-slate-700 rounded-full w-1/2" />
        </div>
      ))}
    </div>
  )
}

export default function TaskBoard({ tasks = [], loading = false, error = null, onTaskClick }) {
  const { isMobile } = useBreakpoint()

  const orderedColumns = isMobile
    ? MOBILE_ORDER.map(key => COLUMNS.find(c => c.key === key))
    : COLUMNS

  const byStatus = COLUMNS.reduce((acc, col) => {
    const filtered = tasks.filter(t => (t.status ?? 'backlog') === col.key)
    acc[col.key] = sortColumn(filtered, col.key)
    return acc
  }, {})

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load tasks: {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4">
      {orderedColumns.map(col => {
        const columnTasks = byStatus[col.key]
        return (
          <div key={col.key} className="flex flex-col">

            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.dot}`} />
              <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${col.labelColor}`}>
                {col.label}
              </span>
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full tabular-nums ${col.countStyle}`}>
                {loading ? '·' : columnTasks.length}
              </span>
            </div>

            {/* Column body — outer shell keeps bg/rounding; inner div is the scroll viewport */}
            <div className={`rounded-2xl ${col.bg}`}>
              <div
                className={[
                  'p-3 flex flex-col gap-2.5',
                  // Desktop: cap at 600px (~5–6 tiles), scroll within column
                  'md:max-h-[600px] md:overflow-y-auto md:pr-1',
                  // Mobile: only add internal scroll when the list is long
                  isMobile && columnTasks.length > 8
                    ? 'max-h-[500px] overflow-y-auto pr-1'
                    : '',
                ].filter(Boolean).join(' ')}
              >
                {loading ? (
                  <ColumnSkeleton />
                ) : columnTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-8 tracking-wide">
                    No tasks
                  </p>
                ) : (
                  columnTasks.map(task => (
                    <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
