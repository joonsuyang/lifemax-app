import TaskCard from './TaskCard'

const COLUMNS = [
  {
    key: 'backlog',
    label: 'Backlog',
    labelColor: 'text-slate-400',
    countStyle: 'bg-slate-700/80 text-slate-400',
    dot: 'bg-slate-500',
    bg: 'bg-slate-800/50',
  },
  {
    key: 'today',
    label: 'Today',
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
    key: 'done',
    label: 'Done',
    labelColor: 'text-emerald-400',
    countStyle: 'bg-emerald-950/80 text-emerald-400',
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-950/30',
  },
]

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
  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => (t.status ?? 'backlog') === col.key)
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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const columnTasks = byStatus[col.key]
        return (
          <div key={col.key} className="flex-none w-72 flex flex-col">

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

            {/* Column body */}
            <div className={`flex-1 rounded-2xl p-3 flex flex-col gap-2.5 min-h-[520px] ${col.bg}`}>
              {loading ? (
                <ColumnSkeleton />
              ) : columnTasks.length === 0 ? (
                <p className="text-xs text-slate-600 text-center pt-8 tracking-wide">
                  No tasks
                </p>
              ) : (
                columnTasks.map(task => (
                  <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
