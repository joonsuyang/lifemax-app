export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, category, estimated_time } = req.body ?? {}

  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const prompt =
    `Given a task with name '${name}', category '${category || 'general'}', ` +
    `and estimated time '${estimated_time || 'unspecified'}', suggest:\n` +
    `1. A 'minimum_completion' definition (1 sentence, concrete, measurable)\n` +
    `2. A 'next_action' (1 short sentence, the very first concrete step)\n\n` +
    `Respond ONLY with JSON in this exact format:\n` +
    `{"minimum_completion": "...", "next_action": "..."}`

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      throw new Error(data.error?.message ?? `Anthropic error ${anthropicRes.status}`)
    }

    const text = data.content?.[0]?.text ?? ''

    // Extract the JSON object even if Claude adds surrounding text
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) throw new Error('No JSON found in model response')

    const { minimum_completion, next_action } = JSON.parse(match[0])

    if (!minimum_completion || !next_action) {
      throw new Error('Incomplete fields in model response')
    }

    return res.status(200).json({ minimum_completion, next_action })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
