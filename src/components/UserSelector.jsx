import { useState, useRef, useEffect } from 'react'
import { useUser } from '../context/UserContext'
import { useUsers } from '../hooks/useUsers'

export default function UserSelector() {
  const { selectedUser, setSelectedUser } = useUser()
  const { users, loading, createUser } = useUsers()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (modalOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [modalOpen])

  const handleSelect = (user) => { setSelectedUser(user); setDropdownOpen(false) }

  const closeModal = () => { setModalOpen(false); setName(''); setError('') }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    setCreating(true)
    setError('')
    try {
      const user = await createUser(trimmed)
      setSelectedUser(user)
      closeModal()
    } catch (err) {
      setError(err.message ?? 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') closeModal()
  }

  return (
    <>
      <div className="flex items-center gap-2" ref={dropdownRef}>

        {/* Dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors min-w-[160px]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            <span className="flex-1 text-left truncate text-sm">
              {loading ? 'Loading…' : selectedUser ? selectedUser.name : 'Select user'}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
              {users.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500 italic">No users yet</p>
              ) : (
                users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                      selectedUser?.id === user.id
                        ? 'text-indigo-300 bg-slate-700'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      selectedUser?.id === user.id ? 'bg-indigo-400' : 'bg-slate-600'
                    }`} />
                    {user.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* New User button */}
        <button
          onClick={() => { setModalOpen(true); setDropdownOpen(false) }}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-500 hover:border-indigo-500/60 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New User
        </button>
      </div>

      {/* New User modal — stays white for legibility */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">New User</h2>
            <p className="text-sm text-slate-500 mb-4">Enter a name to create a separate task list.</p>

            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Alex"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-60 transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
