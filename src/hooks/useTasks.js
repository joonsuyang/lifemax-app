import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTasks(userId) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTasks = useCallback(async () => {
    if (!userId) { setTasks([]); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('date_created', { ascending: false })
    if (err) setError(err.message)
    else setTasks(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  return { tasks, loading, error, refreshTasks: fetchTasks, setTasks }
}
