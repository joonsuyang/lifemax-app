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

  const sbHeaders = {
    apikey:        serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }

  try {
    // ── 1a. Fetch recent activity (last 7 days) ───────────────────────────────
    const recentUrl =
      `${supabaseUrl}/rest/v1/tasks` +
      `?select=name,category,status,estimated_time,actual_time_spent_seconds,date_completed` +
      `&user_id=eq.${user_id}` +
      `&or=(date_created.gte.${cutoffISO},date_completed.gte.${cutoffISO})`

    const recentRes = await fetch(recentUrl, { headers: sbHeaders })
    if (!recentRes.ok) {
      const err = await recentRes.json().catch(() => ({}))
      throw new Error(err.message ?? `Supabase error ${recentRes.status}`)
    }
    const recentTasks = await recentRes.json()

    // ── 1b. Fetch ALL incomplete tasks (for suggestion matching) ──────────────
    const incompleteUrl =
      `${supabaseUrl}/rest/v1/tasks` +
      `?select=id,name,category,status` +
      `&user_id=eq.${user_id}` +
      `&status=neq.done`

    const incompleteRes = await fetch(incompleteUrl, { headers: sbHeaders })
    if (!incompleteRes.ok) {
      const err = await incompleteRes.json().catch(() => ({}))
      throw new Error(err.message ?? `Supabase error ${incompleteRes.status}`)
    }
    const incompleteTasks = await incompleteRes.json()

    // ── 2. Empty-state shortcut ───────────────────────────────────────────────
    if (!recentTasks?.length) {
      return res.status(200).json({
        summary:     'No tasks yet this week — add a few to get started.',
        suggestions: [],
      })
    }

    // Build a Map (id → task) for O(1) lookup and a Set for ID validation
    const incompleteTaskMap = new Map((incompleteTasks ?? []).map(t => [t.id, t]))
    const incompleteTaskIds = new Set(incompleteTaskMap.keys())

    // ── 3. Build compact payloads ─────────────────────────────────────────────
    const recentActivityJson = JSON.stringify(
      recentTasks.map(t => ({
        name:                      t.name,
        category:                  t.category,
        status:                    t.status,
        estimated_time:            t.estimated_time,
        actual_time_spent_seconds: t.actual_time_spent_seconds,
        date_completed:            t.date_completed,
      })),
      null, 2
    )

    const incompleteTasksJson = JSON.stringify(
      (incompleteTasks ?? []).map(t => ({
        id:       t.id,
        name:     t.name,
        category: t.category,
        status:   t.status,
      })),
      null, 2
    )

    // ── 4. Call Anthropic ─────────────────────────────────────────────────────
    const prompt =
      `You are a thoughtful assistant looking at a user's last 7 days of personal tasks.\n\n` +
      `RECENT ACTIVITY (last 7 days):\n${recentActivityJson}\n\n` +
      `INCOMPLETE TASKS (all open work — use for suggestion matching):\n${incompleteTasksJson}\n\n` +
      `Generate a response in this EXACT JSON format:\n` +
      `{\n` +
      `  "summary": "<25 words or less, warm and personal, second-person ('you'). Observe what they invested time in, what categories they skipped, and what's left incomplete. Nudge them toward a balanced next step. Avoid generic motivational filler like 'great job' or 'keep crushing it' — instead be specific about what they actually did.>",\n` +
      `  "suggestions": [\n` +
      `    { "text": "<short suggestion, max 8 words>", "existing_task_id": "<uuid or null>" },\n` +
      `    { "text": "<short suggestion, max 8 words>", "existing_task_id": "<uuid or null>" },\n` +
      `    { "text": "<short suggestion, max 8 words>", "existing_task_id": "<uuid or null>" }\n` +
      `  ]\n` +
      `}\n\n` +
      `For each suggestion you generate, check the incomplete_tasks list. ` +
      `If the suggestion would essentially be the same as an existing incomplete task ` +
      `(same intent, even if worded differently), set existing_task_id to that task's id ` +
      `and phrase the suggestion to reference reopening it ` +
      `(e.g., "Finish reply to mom" if there's an incomplete "Reply to mom email"). ` +
      `If the suggestion is genuinely new (no related existing incomplete task), set existing_task_id to null.\n\n` +
      `Prefer reopening over creating new — if a relevant incomplete task exists, ` +
      `always tag it as a reopen rather than suggesting a duplicate.\n\n` +
      `Respond with ONLY the JSON, no preamble.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiRes.ok) throw new Error(aiData.error?.message ?? `Anthropic error ${aiRes.status}`)

    // ── 5. Parse, validate, and return ───────────────────────────────────────
    const text  = aiData.content?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in model response')

    const { summary, suggestions: rawSuggestions } = JSON.parse(match[0])
    if (!summary || !Array.isArray(rawSuggestions)) throw new Error('Unexpected response shape')

    const suggestions = rawSuggestions.slice(0, 3).map(s => {
      // Accept both old string format and new object format gracefully
      if (typeof s === 'string') return { text: s, existing_task_id: null, existing_task_name: null }

      const taskId      = s.existing_task_id ?? null
      // Validate: if LLM hallucinated an ID not in our incomplete list, null it
      const matchedTask = taskId ? incompleteTaskMap.get(taskId) : null
      const validId     = matchedTask ? taskId : null

      return {
        text:               s.text ?? '',
        existing_task_id:   validId,
        // Enrich with the real task name from our data so the client can show a tooltip
        existing_task_name: matchedTask ? matchedTask.name : null,
      }
    })

    return res.status(200).json({ summary, suggestions })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
