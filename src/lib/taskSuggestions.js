// ── Workout series for pattern-based "next in series" detection ───────────────
// Longer entries first so "chest day" is matched before bare "chest"

const WORKOUT_SERIES = [
  ['push day',    'pull day',    'leg day'],
  ['chest day',   'back day',    'shoulder day', 'arm day',   'leg day',  'core day'],
  ['upper body',  'lower body'],
  ['push',        'pull',        'legs'],
  ['chest',       'back',        'shoulders',    'legs',      'arms',     'core'],
  ['upper',       'lower'],
  ['cardio',      'strength',    'mobility'],
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectNextInSeries(name) {
  if (!name) return null
  const lower = name.toLowerCase()

  for (const series of WORKOUT_SERIES) {
    const matchIdx = series.findIndex(term => lower.includes(term))
    if (matchIdx === -1) continue

    const matchedTerm  = series[matchIdx]
    const nextTerm     = series[(matchIdx + 1) % series.length]
    const pos          = lower.indexOf(matchedTerm)
    const isCapitalized = name[pos] === name[pos].toUpperCase()
    const formatted    = isCapitalized
      ? nextTerm.charAt(0).toUpperCase() + nextTerm.slice(1)
      : nextTerm

    const result = name.slice(0, pos) + formatted + name.slice(pos + matchedTerm.length)
    // Only return if the replacement actually changed something meaningful
    return result !== name ? result : formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }

  return null
}

function mostCommonValue(tasks, field) {
  const counts = {}
  tasks.forEach(t => { if (t[field]) counts[t[field]] = (counts[t[field]] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

function formatDaysAgo(dateStr) {
  if (!dateStr) return 'a while ago'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Given an array of recent tasks (ordered by date_created desc),
 * returns up to 5 row suggestion objects:
 *   { category, name, estimated_time, energy, placeholder }
 *
 * - Fitness: detects workout series and suggests the next entry.
 * - Other categories: leaves name blank, provides a placeholder hint.
 */
export function computeSuggestions(tasks) {
  // Group by category, preserving recency order within each group
  const byCategory = {}
  tasks.forEach(task => {
    const cat = task.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(task)
  })

  const suggestions = []

  for (const [category, catTasks] of Object.entries(byCategory)) {
    if (suggestions.length >= 5) break

    const recent      = catTasks[0]
    const commonTime  = mostCommonValue(catTasks, 'estimated_time')
    const commonEnergy = mostCommonValue(catTasks, 'energy')
    const lastWhen    = formatDaysAgo(recent.date_created)

    if (category === 'fitness') {
      const nextName = detectNextInSeries(recent.name)
      suggestions.push({
        category,
        name:           nextName ?? '',
        estimated_time: commonTime  || recent.estimated_time || '',
        energy:         commonEnergy || recent.energy        || '',
        placeholder:    nextName
          ? ''
          : `e.g. ${recent.name || 'workout'} (last: ${lastWhen})`,
      })
    } else {
      suggestions.push({
        category,
        name:           '',
        estimated_time: commonTime  || recent.estimated_time || '',
        energy:         commonEnergy || recent.energy        || '',
        placeholder:    `e.g. ${recent.name || 'task'} (last in ${category}: ${lastWhen})`,
      })
    }
  }

  return suggestions
}
