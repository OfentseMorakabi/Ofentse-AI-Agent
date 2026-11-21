import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  Mail,
  Mic,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  AppTab,
  DashboardWidgetId,
  WorkspaceState,
} from '../types';

interface OverviewDashboardProps {
  workspace: WorkspaceState;
  widgets: DashboardWidgetId[];
  onUpdateWidgets: (next: DashboardWidgetId[]) => void;
  onNavigate: (tab: AppTab) => void;
  onOpenVoice: (prefillPrompt?: string) => void;
  onToggleReminder: (id: string) => void;
  onMarkNotificationRead: (id: string) => void;
}

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  calendar_timeline: 'Calendar & Conflicts',
  urgent_inbox: 'Urgent Email Triage',
  task_pipeline: 'Task Pipeline',
  reminders_queue: 'Priority Reminders',
  team_activity: 'Team Sync & Docs',
};

const ALL_WIDGETS: DashboardWidgetId[] = [
  'calendar_timeline',
  'urgent_inbox',
  'task_pipeline',
  'reminders_queue',
  'team_activity',
];

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  workspace,
  widgets,
  onUpdateWidgets,
  onNavigate,
  onOpenVoice,
  onToggleReminder,
  onMarkNotificationRead,
}) => {
  const [customizing, setCustomizing] = useState(false);

  const sortedEvents = useMemo(
    () => [...workspace.events].sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()),
    [workspace.events]
  );

  const conflictCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      if (new Date(sortedEvents[i].endIso).getTime() > new Date(sortedEvents[i + 1].startIso).getTime()) {
        count++;
      }
    }
    return count;
  }, [sortedEvents]);

  const urgentUnreadEmails = useMemo(
    () => workspace.emails.filter((m) => m.folder === 'inbox' && (m.unread || m.priority === 'urgent')),
    [workspace.emails]
  );

  const activeTasks = useMemo(
    () => workspace.tasks.filter((t) => t.column !== 'done'),
    [workspace.tasks]
  );

  const activeReminders = useMemo(
    () => workspace.reminders.filter((r) => !r.completed),
    [workspace.reminders]
  );

  const toggleWidget = (id: DashboardWidgetId) => {
    if (widgets.includes(id)) {
      if (widgets.length <= 1) return;
      onUpdateWidgets(widgets.filter((w) => w !== id));
    } else {
      onUpdateWidgets([...widgets, id]);
    }
  };

  const moveWidget = (id: DashboardWidgetId, dir: -1 | 1) => {
    const idx = widgets.indexOf(id);
    if (idx === -1) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= widgets.length) return;
    const copy = [...widgets];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    onUpdateWidgets(copy);
  };

  const applyPreset = (preset: 'executive' | 'comms' | 'sprint') => {
    if (preset === 'executive') {
      onUpdateWidgets(['calendar_timeline', 'urgent_inbox', 'task_pipeline', 'reminders_queue', 'team_activity']);
    } else if (preset === 'comms') {
      onUpdateWidgets(['urgent_inbox', 'reminders_queue', 'calendar_timeline', 'team_activity']);
    } else {
      onUpdateWidgets(['task_pipeline', 'calendar_timeline', 'team_activity', 'reminders_queue']);
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Header & Workflow Customizer */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              Executive Command Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Voice-activated calendar, priority email triage, and encrypted task synchronization
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setCustomizing((v) => !v)}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                customizing
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Customize Dashboard
            </button>
            <button
              onClick={() => onOpenVoice()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Mic className="w-4 h-4" />
              Speak Command
            </button>
          </div>
        </div>

        {/* 4-Column Tabular KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={() => onNavigate('calendar')}
            className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A0C10] border border-slate-200/80 dark:border-white/5 hover:border-indigo-500/40 transition-colors"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Meetings &amp; Conflicts</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                {sortedEvents.length}
              </span>
              {conflictCount > 0 && (
                <span className="text-xs font-medium text-amber-500">· {conflictCount} conflict</span>
              )}
            </div>
          </button>

          <button
            onClick={() => onNavigate('inbox')}
            className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A0C10] border border-slate-200/80 dark:border-white/5 hover:border-indigo-500/40 transition-colors"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Priority Inbox</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                {urgentUnreadEmails.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">urgent / unread</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('projects')}
            className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A0C10] border border-slate-200/80 dark:border-white/5 hover:border-indigo-500/40 transition-colors"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Active Tasks</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                {activeTasks.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                in {workspace.tasks.filter((t) => t.column === 'in_progress').length} progress
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('calendar')}
            className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A0C10] border border-slate-200/80 dark:border-white/5 hover:border-indigo-500/40 transition-colors"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Active Reminders</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                {activeReminders.length}
              </span>
              <span className="text-xs text-rose-500 font-medium">
                {activeReminders.filter((r) => r.priority === 'urgent').length} urgent
              </span>
            </div>
          </button>
        </div>

        {/* Interactive Dashboard Layout Customizer Drawer */}
        {customizing && (
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Workflow Presets &amp; Priority Order
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyPreset('executive')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Executive Overview
                </button>
                <button
                  onClick={() => applyPreset('comms')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Inbox &amp; Calendar First
                </button>
                <button
                  onClick={() => applyPreset('sprint')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Project Sprint Focus
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {ALL_WIDGETS.map((id) => {
                const enabled = widgets.includes(id);
                const idx = widgets.indexOf(id);
                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                      enabled
                        ? 'border-indigo-500/40 bg-indigo-500/5'
                        : 'border-slate-200 dark:border-white/10 opacity-60'
                    }`}
                  >
                    <button
                      onClick={() => toggleWidget(id)}
                      className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                    >
                      {enabled ? (
                        <Eye className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{WIDGET_LABELS[id]}</span>
                    </button>
                    {enabled && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => moveWidget(id, -1)}
                          disabled={idx === 0}
                          aria-label={`Move ${WIDGET_LABELS[id]} earlier`}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveWidget(id, 1)}
                          disabled={idx === widgets.length - 1}
                          aria-label={`Move ${WIDGET_LABELS[id]} later`}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Customizable Grid of Priority Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {widgets.map((widgetId) => {
          if (widgetId === 'calendar_timeline') {
            return (
              <section
                key={widgetId}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Upcoming Schedule
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {conflictCount > 0 && (
                      <button
                        onClick={() => onOpenVoice('Check and resolve any calendar conflicts today')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Resolve Conflict
                      </button>
                    )}
                    <button
                      onClick={() => onNavigate('calendar')}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Open Calendar
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/5">
                  {sortedEvents.slice(0, 4).map((evt) => (
                    <div key={evt.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {evt.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {evt.location} · {evt.priority} priority
                        </div>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                        {new Date(evt.startIso).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (widgetId === 'urgent_inbox') {
            return (
              <section
                key={widgetId}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Urgent Email Triage
                    </h2>
                  </div>
                  <button
                    onClick={() => onNavigate('inbox')}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Open Inbox
                  </button>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/5">
                  {workspace.emails.slice(0, 3).map((mail) => (
                    <div key={mail.id} className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {mail.subject}
                        </span>
                        {mail.priority === 'urgent' && (
                          <span className="text-xs font-medium text-rose-500 shrink-0">Urgent</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {mail.from} · {mail.body}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (widgetId === 'task_pipeline') {
            return (
              <section
                key={widgetId}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Active Project Tasks
                    </h2>
                  </div>
                  <button
                    onClick={() => onNavigate('projects')}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Drag &amp; Drop Board
                  </button>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/5">
                  {activeTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {task.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                          {task.column.replace('_', ' ')} · {task.priority}
                        </div>
                      </div>
                      <button
                        onClick={() => onOpenVoice(`Move ${task.title} to done`)}
                        aria-label={`Voice update ${task.title}`}
                        className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 shrink-0 inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        Update
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (widgetId === 'reminders_queue') {
            return (
              <section
                key={widgetId}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Priority Reminders &amp; Alerts
                    </h2>
                  </div>
                  <button
                    onClick={() => onOpenVoice('Remind me in 20 minutes to check team updates')}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Voice Reminder
                  </button>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/5">
                  {workspace.reminders.slice(0, 4).map((rem) => (
                    <button
                      key={rem.id}
                      onClick={() => onToggleReminder(rem.id)}
                      className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            rem.completed ? 'text-emerald-500' : 'text-slate-400'
                          }`}
                        />
                        <span
                          className={`text-sm truncate ${
                            rem.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-white font-medium'
                          }`}
                        >
                          {rem.title}
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                        {new Date(rem.triggerAtIso).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          }

          return (
            <section
              key={widgetId}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Team Updates &amp; Sync
                  </h2>
                </div>
                <button
                  onClick={() => onNavigate('team')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Permissions &amp; Vault
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-white/5">
                {workspace.notifications.slice(0, 4).map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => onMarkNotificationRead(notif.id)}
                    className="w-full text-left px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            notif.read
                              ? 'text-slate-600 dark:text-slate-300'
                              : 'font-semibold text-slate-900 dark:text-white'
                          }`}
                        >
                          {notif.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {notif.actorName} · {notif.detail}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                      {new Date(notif.timestampIso).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
