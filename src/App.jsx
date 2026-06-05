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
  const [newTaskInitialName, setNewTaskInitialName] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)

  const filteredTasks = applyFilters(tasks, filters)

  const handleOpenNewTask = (initialName = '') => {
    setNewTaskInitialName(initialName)
    setModalOpen(true)
  }

  const handleCloseNewTask = () => {
    setModalOpen(false)
    setNewTaskInitialName('')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center relative">

          <UserSelector />

          {selectedUser && (
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2">
              <button
                onClick={() => handleOpenNewTask()}
                className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-400 active:scale-95 rounded-xl shadow-md transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New Task
              </button>
            </div>
          )}

          <div className="ml-auto">
            <span className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100 select-none">
              LifeMax
            </span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
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
              <TaskOverview
                tasks={tasks}
                userId={selectedUser.id}
                onNewTask={handleOpenNewTask}
                onOpenTask={setSelectedTask}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-600">
              <p className="text-sm tracking-wide">Select or create a user to get started.</p>
            </div>
          )}
        </div>
      </main>

      {/* FAB — mobile only */}
      {selectedUser && (
        <button
          onClick={() => handleOpenNewTask()}
          aria-label="New Task"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white shadow-lg flex items-center justify-center md:hidden transition-all"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <NewTaskModal
        isOpen={modalOpen}
        onClose={handleCloseNewTask}
        userId={selectedUser?.id}
        onSuccess={refreshTasks}
        initialName={newTaskInitialName}
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
