import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { Priority, TaskColumn, TaskItem, TeamMember } from '../types';

interface TasksBoardProps {
  tasks: TaskItem[];
  team: TeamMember[];
  canManageTasks: boolean;
  onMoveTask: (taskId: string, targetColumn: TaskColumn) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'updatedAt' | 'order'>) => void;
  onDeleteTask: (taskId: string) => void;
}

const COLUMNS: Array<{ id: TaskColumn; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export const TasksBoard: React.FC<TasksBoardProps> = ({
  tasks,
  team,
  canManageTasks,
  onMoveTask,
  onAddTask,
  onDeleteTask,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskColumn | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newColumn, setNewColumn] = useState<TaskColumn>('backlog');

  // Touch swipe tracking for mobile touchscreen gesture controls
  const touchStartXRef = useRef<number | null>(null);

  const filteredTasks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [tasks, filterQuery, priorityFilter]);

  const handleDrop = (col: TaskColumn) => {
    if (draggingId && canManageTasks) {
      onMoveTask(draggingId, col);
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  const stepColumn = (task: TaskItem, dir: -1 | 1) => {
    if (!canManageTasks) return;
    const idx = COLUMNS.findIndex((c) => c.id === task.column);
    const nextIdx = Math.max(0, Math.min(COLUMNS.length - 1, idx + dir));
    if (nextIdx !== idx) {
      onMoveTask(task.id, COLUMNS[nextIdx].id);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !canManageTasks) return;
    onAddTask({
      title: newTitle.trim(),
      description: newDesc.trim() || 'Scheduled in Aether workspace.',
      column: newColumn,
      priority: newPriority,
      projectId: 'proj-core',
      assigneeId: team[0]?.id ?? 'usr-1',
      dueDateIso: new Date(Date.now() + 86400000).toISOString(),
    });
    setNewTitle('');
    setNewDesc('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Projects &amp; Drag-and-Drop Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Drag cards across stages on desktop or swipe left/right on touchscreens
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="min-h-[44px] w-44 sm:w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] pl-9 pr-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] px-3 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {canManageTasks && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-medium text-white whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {showAddForm && canManageTasks && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <input
            required
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            className="md:col-span-2 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Details (optional)"
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm text-slate-900 dark:text-white"
          />
          <div className="flex gap-2">
            <select
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value as TaskColumn)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2.5 text-xs text-slate-900 dark:text-white"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2.5 text-xs text-slate-900 dark:text-white"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
          >
            Create Task
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col, colIdx) => {
          const colTasks = filteredTasks.filter((t) => t.column === col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.id);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
              className={`rounded-2xl border p-4 min-h-[300px] transition-colors ${
                isOver
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B]'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-white/10">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{col.label}</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {colTasks.map((task) => {
                  const assignee = team.find((m) => m.id === task.assigneeId);
                  return (
                    <div
                      key={task.id}
                      draggable={canManageTasks}
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverCol(null);
                      }}
                      onTouchStart={(e) => {
                        touchStartXRef.current = e.touches[0]?.clientX ?? null;
                      }}
                      onTouchEnd={(e) => {
                        const startX = touchStartXRef.current;
                        const endX = e.changedTouches[0]?.clientX ?? null;
                        touchStartXRef.current = null;
                        if (startX !== null && endX !== null) {
                          const delta = endX - startX;
                          if (delta > 60) stepColumn(task, 1);
                          else if (delta < -60) stepColumn(task, -1);
                        }
                      }}
                      className={`rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] p-3.5 space-y-2.5 transition-opacity ${
                        draggingId === task.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          {canManageTasks && (
                            <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 shrink-0 cursor-grab hidden sm:block" />
                          )}
                          <h3 className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                            {task.title}
                          </h3>
                        </div>
                        {canManageTasks && (
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            aria-label={`Delete ${task.title}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          <span
                            className={`capitalize font-medium ${
                              task.priority === 'urgent'
                                ? 'text-rose-500'
                                : task.priority === 'high'
                                ? 'text-amber-500'
                                : 'text-slate-400'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(task.dueDateIso).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {assignee && (
                          <img
                            src={assignee.avatar}
                            alt={assignee.name}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-white/10"
                          />
                        )}
                      </div>

                      {canManageTasks && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/5 md:hidden">
                          <button
                            disabled={colIdx === 0}
                            onClick={() => stepColumn(task, -1)}
                            className="min-h-[36px] px-2.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 disabled:opacity-30 inline-flex items-center gap-1"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back
                          </button>
                          <button
                            disabled={colIdx === COLUMNS.length - 1}
                            onClick={() => stepColumn(task, 1)}
                            className="min-h-[36px] px-2.5 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 disabled:opacity-30 inline-flex items-center gap-1"
                          >
                            Advance
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
