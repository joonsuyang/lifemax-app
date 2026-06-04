import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error) setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const createUser = async (name) => {
    const { data, error } = await supabase
      .from('users')
      .insert({ name })
      .select()
      .single()
    if (error) throw error
    setUsers(prev => [...prev, data])
    return data
  }

  return { users, loading, createUser, refreshUsers: fetchUsers }
}
