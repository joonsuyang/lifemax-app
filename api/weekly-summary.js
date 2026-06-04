export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id } = req.body ?? {}
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anthropicKey   = process.env.ANTHROPIC_API_KEY

  if (!supabaseUrl)    return res.status(500).json({ error: 'Supabase URL not configured' })
  if (!serviceRoleKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
  if (!anthropicKey)   return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffISO = cutoff.toISOString()

  try {
    // ── 1. Fetch tasks from Supabase ──────────────────────────────────────────
    const select = 'name,category,status,estimated_time,actual_time_spent_seconds,date_completed'
    const supabaseUrl_ = `${supabaseUrl}/rest/v1/tasks` +
      `?select=${select}` +
      `&user_id=eq.${user_id}` +
      `&or=(date_created.gte.${cutoffISO},date_completed.gte.${cutoffISO})`

    const sbRes = await fetch(supabaseUrl_, {
      headers: {
        apikey:        serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    })

    if (!sbRes.ok) {
      const err = await sbRes.json().catch(() => ({}))
      throw new Error(err.message ?? `Supabase error ${sbRes.status}`)
    }

    const tasks = await sbRes.json()

    // ── 2. Empty-state shortcut ───────────────────────────────────────────────
    if (!tasks?.length) {
      return res.status(200).json({
        summary:     'No tasks yet this week — add a few to get started.',
        suggestions: [],
      })
    }

    // ── 3. Build compact payload (only fields the model needs) ────────────────
    const tasksJson = JSON.stringify(
      tasks.map(t => ({
        name:                      t.name,
        category:                  t.category,
        status:                    t.status,
        estimated_time:            t.estimated_time,
        actual_time_spent_seconds: t.actual_time_spent_seconds,
        date_completed:            t.date_completed,
      })),
      null,
      2
    )

    // ── 4. Call Anthropic ─────────────────────────────────────────────────────
    const prompt =
      `You are summarizing a user's last 7 days of personal tasks in a to-do tracker. Here is their task data:\n\n` +
      `${tasksJson}\n\n` +
      `Generate a response in this EXACT JSON format:\n` +
      `{\n` +
      `  "summary": "<25 words or less, factual, second-person. Mention top categories, total hours spent, and completion patterns. No fluff or motivational language.>",\n` +
      `  "suggestions": [\n` +
      `    "<short task suggestion 1, max 8 words>",\n` +
      `    "<short task suggestion 2, max 8 words>",\n` +
      `    "<short task suggestion 3, max 8 words>"\n` +
      `  ]\n` +
      `}\n\n` +
      `Suggestions should be tasks the user might want to add based on gaps in their recent activity ` +
      `(e.g., if they did chest day but not back day; if they did errands but no social tasks). Be concrete.\n\n` +
      `Respond with ONLY the JSON, no preamble.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiRes.ok) throw new Error(aiData.error?.message ?? `Anthropic error ${aiRes.status}`)

    // ── 5. Parse and return ───────────────────────────────────────────────────
    const text  = aiData.content?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in model response')

    const { summary, suggestions } = JSON.parse(match[0])
    if (!summary || !Array.isArray(suggestions)) throw new Error('Unexpected response shape')

    return res.status(200).json({ summary, suggestions: suggestions.slice(0, 3) })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
