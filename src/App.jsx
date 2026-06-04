import { useState } from 'react'
import { UserProvider, useUser } from './context/UserContext'
import { useTasks } from './hooks/useTasks'
import { DEFAULT_FILTERS, applyFilters } from './lib/filters'
import UserSelector from './components/UserSelector'
import FilterBar from './components/FilterBar'
import TaskBoard from './components/TaskBoard'
import NewTaskModal from './components/NewTaskModal'
import TaskDetailModal from './components/TaskDetailModal'
import TaskOverview from './components/TaskOverview'
import './App.css'

function AppShell() {
  const { selectedUser } = useUser()
  const { tasks, loading, error, refreshTasks } = useTasks(selectedUser?.id)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)

  const filteredTasks = applyFilters(tasks, filters)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
        <UserSelector />

        <div className="flex items-center gap-4">
          {selectedUser && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </button>
          )}
          <span className="text-[10px] font-light tracking-[0.35em] text-slate-500 uppercase select-none">
            LifeMax
          </span>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 p-6 overflow-y-auto">
        {selectedUser ? (
          <>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              totalCount={tasks.length}
              filteredCount={filteredTasks.length}
            />
            <TaskBoard
              tasks={filteredTasks}
              loading={loading}
              error={error}
              onTaskClick={setSelectedTask}
            />
            <TaskOverview tasks={tasks} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-600">
            <p className="text-sm tracking-wide">Select or create a user to get started.</p>
          </div>
        )}
      </main>

      <NewTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={selectedUser?.id}
        onSuccess={refreshTasks}
      />

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={refreshTasks}
        onDeleted={refreshTasks}
      />
    </div>
  )
}

export default function App() {
  return (
    <UserProvider>
      <AppShell />
    </UserProvider>
  )
}
