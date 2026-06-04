import { CATEGORIES, DEFAULT_FILTERS } from '../lib/filters'

function TogglePill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-full text-xs font-medium border transition-all active:scale-95 ${
        active
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

export default function FilterBar({ filters, onChange, totalCount, filteredCount }) {
  const isAnyActive =
    filters.time || filters.energy || filters.priority || filters.category || filters.created

  const toggle = (key) => onChange({ ...filters, [key]: !filters[key] })
  const set = (key, value) => onChange({ ...filters, [key]: value })
  const clear = () => onChange({ ...DEFAULT_FILTERS })

  const isFiltered = isAnyActive && filteredCount !== totalCount

  return (
    /* Sticky wrapper — bleeds edge-to-edge past parent px-6 */
    <div className="sticky top-0 z-10 backdrop-blur-sm bg-slate-900/90 -mx-6 px-6 py-3 mb-4">

      {/* Horizontally scrollable rail on mobile; wraps on md+ */}
      <div className="flex overflow-x-auto gap-2 pb-2 snap-x items-center md:flex-wrap md:pb-0">

        <span className="shrink-0 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.18em]">
          Filter
        </span>

        <div className="shrink-0 w-px h-3.5 bg-slate-700 mx-1" />

        <TogglePill active={filters.time} onClick={() => toggle('time')}>
          <ClockIcon />
          30 min or less
        </TogglePill>

        <TogglePill active={filters.energy} onClick={() => toggle('energy')}>
          <BoltIcon />
          Low energy
        </TogglePill>

        <TogglePill active={filters.priority} onClick={() => toggle('priority')}>
          <FlagIcon />
          Critical
        </TogglePill>

        {/* Category select */}
        <div className="relative shrink-0">
          <select
            value={filters.category}
            onChange={e => set('category', e.target.value)}
            className={`appearance-none pl-3 pr-7 py-2.5 min-h-[44px] rounded-full text-xs font-medium border transition-all cursor-pointer focus:outline-none active:scale-95 ${
              filters.category
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            <option value="">Category</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat} className="text-slate-900 bg-white">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <svg
            className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 ${
              filters.category ? 'text-indigo-300' : 'text-slate-500'
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="shrink-0 w-px h-3.5 bg-slate-700 mx-1" />

        <TogglePill
          active={filters.created === 'today'}
          onClick={() => set('created', filters.created === 'today' ? '' : 'today')}
        >
          <CalendarIcon />
          Today
        </TogglePill>

        <TogglePill
          active={filters.created === 'this_week'}
          onClick={() => set('created', filters.created === 'this_week' ? '' : 'this_week')}
        >
          <CalendarIcon />
          This week
        </TogglePill>

        {isAnyActive && (
          <>
            {isFiltered && (
              <span className="shrink-0 text-xs text-slate-600 ml-1 tabular-nums">
                {filteredCount} / {totalCount}
              </span>
            )}
            <button
              onClick={clear}
              className="shrink-0 ml-1 inline-flex items-center gap-1 min-h-[44px] px-2 text-xs text-slate-600 hover:text-slate-400 active:text-slate-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  )
}
