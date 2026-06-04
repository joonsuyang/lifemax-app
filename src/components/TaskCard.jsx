const PRIORITY_BADGE = {
  low:      'bg-slate-100 text-slate-500 border-slate-200',
  medium:   'bg-amber-50 text-amber-600 border-amber-100',
  high:     'bg-orange-50 text-orange-500 border-orange-200',
  critical: 'bg-red-50 text-red-500 border-red-200',
}

const PRIORITY_DOT = {
  low:      'bg-slate-400',
  medium:   'bg-amber-400',
  high:     'bg-orange-400',
  critical: 'bg-red-500',
}

export default function TaskCard({ task, onClick }) {
  const badge = PRIORITY_BADGE[task.priority] ?? 'bg-slate-100 text-slate-500 border-slate-200'
  const dot   = PRIORITY_DOT[task.priority]   ?? 'bg-slate-400'

  return (
    <div
      onClick={() => onClick?.(task)}
      className="
        bg-white rounded-xl px-3.5 py-4 cursor-pointer select-none
        shadow-[0_1px_2px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.12)]
        active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
        transition-transform duration-150
      "
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.(task)}
    >
      {/* Task name */}
      <p className="text-sm font-medium text-slate-800 leading-snug mb-3 line-clamp-2">
        {task.name}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border capitalize tracking-wide ${badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
          {task.priority ?? '—'}
        </span>

        {task.estimated_time && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 tracking-wide">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {task.estimated_time}
          </span>
        )}
      </div>
    </div>
  )
}
