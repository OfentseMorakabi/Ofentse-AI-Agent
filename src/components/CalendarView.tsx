import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CalendarEvent, Priority, ReminderItem } from '../types';
import { exportCalendarIcs } from '../lib/exportUtils';

interface CalendarViewProps {
  events: CalendarEvent[];
  reminders: ReminderItem[];
  canEditCalendar: boolean;
  onAddEvent: (evt: Omit<CalendarEvent, 'id' | 'updatedAt'>) => void;
  onDeleteEvent: (id: string) => void;
  onAutoResolveConflicts: () => Promise<void>;
  onAddReminder: (rem: Omit<ReminderItem, 'id'>) => void;
  onToggleReminder: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  reminders,
  canEditCalendar,
  onAddEvent,
  onDeleteEvent,
  onAutoResolveConflicts,
  onAddReminder,
  onToggleReminder,
}) => {
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('2026-11-20');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [location, setLocation] = useState('Encrypted Bridge');
  const [priority, setPriority] = useState<Priority>('medium');

  const [remTitle, setRemTitle] = useState('');
  const [remMinutes, setRemMinutes] = useState('30');
  const [remPriority, setRemPriority] = useState<'urgent' | 'normal'>('urgent');

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()),
    [events]
  );

  const conflicts = useMemo(() => {
    const pairs: Array<{ a: CalendarEvent; b: CalendarEvent }> = [];
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const a = sortedEvents[i];
      const b = sortedEvents[i + 1];
      if (new Date(a.endIso).getTime() > new Date(b.startIso).getTime()) {
        pairs.push({ a, b });
      }
    }
    return pairs;
  }, [sortedEvents]);

  const conflictingIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach(({ a, b }) => {
      ids.add(a.id);
      ids.add(b.id);
    });
    return ids;
  }, [conflicts]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canEditCalendar) return;
    const startIso = new Date(`${dateStr}T${startTime}:00`).toISOString();
    const endIso = new Date(`${dateStr}T${endTime}:00`).toISOString();
    onAddEvent({
      title: title.trim(),
      startIso,
      endIso,
      location: location.trim() || 'Encrypted Bridge',
      attendees: [],
      priority,
      notes: 'Created from calendar timeline.',
      category: 'meeting',
    });
    setTitle('');
    setShowNewEvent(false);
  };

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    const mins = Math.max(1, parseInt(remMinutes, 10) || 15);
    onAddReminder({
      title: remTitle.trim(),
      triggerAtIso: new Date(Date.now() + mins * 60000).toISOString(),
      priority: remPriority,
      completed: false,
      category: 'Schedule',
    });
    setRemTitle('');
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onAutoResolveConflicts();
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Calendar &amp; Conflict Resolution
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time overlap detection, automated rescheduling, and priority reminders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportCalendarIcs(events)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Export .ICS
          </button>
          {canEditCalendar && (
            <button
              onClick={() => setShowNewEvent((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          )}
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {conflicts.length} Scheduling Conflict{conflicts.length === 1 ? '' : 's'} Detected
              </h3>
              <p className="text-xs text-amber-700/90 dark:text-amber-200/80 mt-0.5">
                {conflicts[0].a.title} overlaps with {conflicts[0].b.title}. Let Aether relocate the conflicting slot.
              </p>
            </div>
          </div>
          {canEditCalendar && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 text-xs font-medium whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              {resolving ? 'Resolving...' : 'Auto-Resolve Conflict'}
            </button>
          )}
        </div>
      )}

      {/* New Event Form */}
      {showNewEvent && canEditCalendar && (
        <form
          onSubmit={handleCreateEvent}
          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 grid grid-cols-1 md:grid-cols-6 gap-4"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Meeting Title
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Design & Security Sync"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start / End</label>
            <div className="flex gap-1.5">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2 text-xs font-mono text-slate-900 dark:text-white"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3 text-sm text-slate-900 dark:text-white"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              Save Event
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Timeline */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Scheduled Events</h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {sortedEvents.length} total
            </span>
          </div>

          {sortedEvents.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Your schedule is open. Tap "New Event" or ask Aether via voice to book a meeting.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/5">
              {sortedEvents.map((evt) => {
                const isConflict = conflictingIds.has(evt.id);
                return (
                  <div
                    key={evt.id}
                    className={`p-4 sm:px-5 flex items-start justify-between gap-4 transition-colors ${
                      isConflict ? 'bg-amber-500/[0.04]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {evt.title}
                        </span>
                        {isConflict && (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            · Time Conflict
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span>
                          {new Date(evt.startIso).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {new Date(evt.startIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(evt.endIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{evt.location}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-sans capitalize ${
                            evt.priority === 'urgent'
                              ? 'text-rose-500 font-medium'
                              : evt.priority === 'high'
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {evt.priority} priority
                        </span>
                      </div>
                      {evt.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{evt.notes}</p>
                      )}
                    </div>
                    {canEditCalendar && (
                      <button
                        onClick={() => onDeleteEvent(evt.id)}
                        aria-label={`Remove ${evt.title}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-Time Reminders */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Priority Reminders</h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {reminders.filter((r) => !r.completed).length} active
            </span>
          </div>

          <form onSubmit={handleCreateReminder} className="p-4 border-b border-slate-200 dark:border-white/10 space-y-2.5">
            <input
              type="text"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder="Add real-time reminder..."
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={remMinutes}
                  onChange={(e) => setRemMinutes(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="5">In 5 min</option>
                  <option value="15">In 15 min</option>
                  <option value="30">In 30 min</option>
                  <option value="60">In 1 hour</option>
                </select>
              </div>
              <select
                value={remPriority}
                onChange={(e) => setRemPriority(e.target.value as 'urgent' | 'normal')}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2.5 text-xs text-slate-800 dark:text-slate-200"
              >
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </select>
              <button
                type="submit"
                className="min-h-[40px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shrink-0"
              >
                Set
              </button>
            </div>
          </form>

          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {reminders.map((rem) => (
              <button
                key={rem.id}
                onClick={() => onToggleReminder(rem.id)}
                className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <CheckCircle2
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    rem.completed ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${
                      rem.completed
                        ? 'line-through text-slate-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {rem.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 flex items-center gap-2">
                    <span>
                      {new Date(rem.triggerAtIso).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={rem.priority === 'urgent' ? 'text-rose-500 font-sans font-medium' : 'font-sans'}>
                      {rem.priority}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
