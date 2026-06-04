export const TIME_OPTIONS     = ['10 min', '30 min', '45 min', '60 min', '>60 min']
export const ENERGY_OPTIONS   = ['low', 'medium', 'high']
export const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical']

export const CATEGORIES = [
  'fitness',
  'social',
  'errand',
  'side project',
  'admin',
  'personal',
  'other',
]

export const DEFAULT_FILTERS = {
  time: false,
  energy: false,
  priority: false,
  category: '',
  created: '',
}

const SHORT_TIMES = ['10 min', '30 min']

export function applyFilters(tasks, filters) {
  return tasks.filter(task => {
    if (filters.time && !SHORT_TIMES.includes(task.estimated_time)) return false
    if (filters.energy && task.energy?.toLowerCase() !== 'low') return false
    if (filters.priority && task.priority?.toLowerCase() !== 'critical') return false
    if (filters.category && task.category !== filters.category) return false
    if (filters.created) {
      const created = new Date(task.date_created)
      const now = new Date()
      if (filters.created === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        if (created < startOfDay) return false
      } else if (filters.created === 'this_week') {
        const dow = now.getDay()
        const daysToMonday = dow === 0 ? 6 : dow - 1
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday)
        if (created < startOfWeek) return false
      }
    }
    return true
  })
}
