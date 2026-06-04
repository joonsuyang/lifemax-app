import { CATEGORIES, DEFAULT_FILTERS } from '../lib/filters'

// ── Filter-specific select options ────────────────────────────────────────────

const TIME_FILTER_OPTIONS = [
  { value: 'short', label: '30 min or less' },
]

const ENERGY_FILTER_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

const PRIORITY_FILTER_OPTIONS = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const CREATED_FILTER_OPTIONS = [
  { value: 'today',     label: 'Today' },
  { value: 'this_week', label: 'This Week' },
]

const CATEGORY_FILTER_OPTIONS = CATEGORIES.map(c => ({
  value: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
}))

// ── Shared select component ───────────────────────────────────────────────────

function FilterSelect({ value, onChange, allLabel, options }) {
  const isActive = Boolean(value)
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-7 py-2.5 min-h-[44px] rounded-full text-xs font-medium border transition-all cursor-pointer focus:outline-none active:scale-95 ${
          isActive
            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map(o => (
          <option key={o.value} value={o.value} className="text-slate-900 bg-white">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 ${
          isActive ? 'text-indigo-300' : 'text-slate-500'
        }`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

export default function FilterBar({ filters, onChange, totalCount, filteredCount }) {
  const isAnyActive =
    filters.time || filters.energy || filters.priority || filters.category || filters.created

  const set = (key, value) => onChange({ ...filters, [key]: value })
  const clear = () => onChange({ ...DEFAULT_FILTERS })

  const isFiltered = isAnyActive && filteredCount !== totalCount

  return (
    <div className="sticky top-0 z-10 backdrop-blur-sm bg-slate-900/90 -mx-4 px-4 py-3 mb-4">
      <div className="flex overflow-x-auto gap-2 pb-2 snap-x items-center md:flex-wrap md:pb-0">

        <span className="shrink-0 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.18em]">
          Filter
        </span>

        <div className="shrink-0 w-px h-3.5 bg-slate-700 mx-1" />

        <FilterSelect
          value={filters.time}
          onChange={v => set('time', v)}
          allLabel="All Time Buckets"
          options={TIME_FILTER_OPTIONS}
        />

        <FilterSelect
          value={filters.energy}
          onChange={v => set('energy', v)}
          allLabel="All Energy Levels"
          options={ENERGY_FILTER_OPTIONS}
        />

        <FilterSelect
          value={filters.priority}
          onChange={v => set('priority', v)}
          allLabel="All Priorities"
          options={PRIORITY_FILTER_OPTIONS}
        />

        <FilterSelect
          value={filters.category}
          onChange={v => set('category', v)}
          allLabel="All Categories"
          options={CATEGORY_FILTER_OPTIONS}
        />

        <div className="shrink-0 w-px h-3.5 bg-slate-700 mx-1" />

        <FilterSelect
          value={filters.created}
          onChange={v => set('created', v)}
          allLabel="All Time"
          options={CREATED_FILTER_OPTIONS}
        />

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
