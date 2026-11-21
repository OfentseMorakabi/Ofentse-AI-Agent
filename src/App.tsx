import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckSquare,
  LayoutDashboard,
  Lock,
  Mail,
  Mic,
  Moon,
  Search,
  Shield,
  Sun,
} from 'lucide-react';
import type {
  AppTab,
  CalendarEvent,
  DashboardWidgetId,
  EncryptedBackupRecord,
  ReminderItem,
  TaskColumn,
  TaskItem,
  TeamMember,
  TeamPermissions,
  UserTier,
  WorkspaceState,
} from './types';
import { getOrCreateDeviceId } from './lib/crypto';
import { isBiometricLockEnabled } from './lib/biometrics';
import {
  clearOfflineQueue,
  enqueueOfflineMutation,
  getPendingOfflineMutations,
  loadDashboardLayout,
  loadOfflineWorkspace,
  saveDashboardLayout,
  saveOfflineWorkspace,
} from './lib/offlineDb';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BiometricLockModal } from './components/BiometricLockModal';
import { SearchModal } from './components/SearchModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { OverviewDashboard } from './components/OverviewDashboard';
import { CalendarView } from './components/CalendarView';
import { EmailView } from './components/EmailView';
import { TasksBoard } from './components/TasksBoard';
import { TeamSecurityView } from './components/TeamSecurityView';

const DEFAULT_WIDGETS: DashboardWidgetId[] = [
  'calendar_timeline',
  'urgent_inbox',
  'task_pipeline',
  'reminders_queue',
  'team_activity',
];

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'inbox', label: 'Inbox', icon: Mail },
  { id: 'projects', label: 'Projects', icon: CheckSquare },
  { id: 'team', label: 'Team', icon: Shield },
];

export default function App() {
  const isOnline = useOnlineStatus();
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_theme');
    return saved ? saved === 'dark' : true;
  });
  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [userTier, setUserTier] = useState<UserTier>('pro');
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [backups, setBackups] = useState<EncryptedBackupRecord[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidgetId[]>(DEFAULT_WIDGETS);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceInitialPrompt, setVoiceInitialPrompt] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [biometricModal, setBiometricModal] = useState<'unlock' | 'configure' | null>(() =>
    isBiometricLockEnabled() ? 'unlock' : null
  );
  const [urgentToast, setUrgentToast] = useState<string | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('aether_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('aether_theme', 'light');
    }
  }, [darkMode]);

  // Keyboard shortcut Cmd+K / Ctrl+K for Search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const savedLayout = await loadDashboardLayout();
      if (savedLayout && savedLayout.length > 0) {
        setWidgets(savedLayout);
      }
      const queued = await getPendingOfflineMutations();
      setPendingSyncCount(queued.length);

      if (navigator.onLine) {
        const [wsRes, bkpRes] = await Promise.all([
          fetch('/api/workspace'),
          fetch('/api/backup/list'),
        ]);
        if (!wsRes.ok) throw new Error('Failed to load synced workspace');
        const wsData = (await wsRes.json()) as WorkspaceState;
        setWorkspace(wsData);
        await saveOfflineWorkspace(wsData);

        if (bkpRes.ok) {
          const bkpData = (await bkpRes.json()) as { backups: EncryptedBackupRecord[] };
          setBackups(bkpData.backups || []);
        }
      } else {
        const cached = await loadOfflineWorkspace();
        if (cached) {
          setWorkspace(cached);
        } else {
          throw new Error('Offline and no cached workspace available yet.');
        }
      }
    } catch (err) {
      const cached = await loadOfflineWorkspace();
      if (cached) {
        setWorkspace(cached);
      } else {
        setLoadError(err instanceof Error ? err.message : 'Unable to initialize workspace.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Real-time Server-Sent Events subscription for cross-device & team sync
  useEffect(() => {
    if (!isOnline) return;
    const es = new EventSource('/api/stream');
    es.addEventListener('sync', async (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { sourceDeviceId?: string };
        if (parsed.sourceDeviceId === deviceId) return;
        const res = await fetch('/api/workspace');
        if (res.ok) {
          const fresh = (await res.json()) as WorkspaceState;
          setWorkspace(fresh);
          await saveOfflineWorkspace(fresh);
        }
      } catch {
        // ignore transient SSE parse errors
      }
    });
    return () => es.close();
  }, [isOnline, deviceId]);

  const flushOfflineQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queued = await getPendingOfflineMutations();
    if (queued.length === 0) return;
    const latest = queued[queued.length - 1];
    try {
      const res = await fetch('/api/workspace/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: latest.state, deviceId }),
      });
      if (res.ok) {
        const synced = (await res.json()) as WorkspaceState;
        setWorkspace(synced);
        await saveOfflineWorkspace(synced);
        await clearOfflineQueue();
        setPendingSyncCount(0);
        setUrgentToast('Offline changes synchronized across devices.');
      }
    } catch {
      // keep queued for next reconnect
    }
  }, [deviceId]);

  useEffect(() => {
    if (isOnline) {
      flushOfflineQueue();
    }
  }, [isOnline, flushOfflineQueue]);

  // Real-time reminder alert monitor
  useEffect(() => {
    if (!workspace) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const due = workspace.reminders.find(
        (r) => !r.completed && !r.notified && new Date(r.triggerAtIso).getTime() <= now
      );
      if (due) {
        setUrgentToast(`Reminder: ${due.title}`);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Aether Reminder', { body: due.title });
        }
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                reminders: prev.reminders.map((r) => (r.id === due.id ? { ...r, notified: true } : r)),
              }
            : prev
        );
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [workspace]);

  const persistWorkspace = useCallback(
    async (nextState: WorkspaceState, description: string) => {
      setWorkspace(nextState);
      await saveOfflineWorkspace(nextState);

      if (!navigator.onLine) {
        await enqueueOfflineMutation(description, nextState);
        const q = await getPendingOfflineMutations();
        setPendingSyncCount(q.length);
        return;
      }

      try {
        const res = await fetch('/api/workspace/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: nextState, deviceId }),
        });
        if (res.ok) {
          const saved = (await res.json()) as WorkspaceState;
          setWorkspace(saved);
          await saveOfflineWorkspace(saved);
        }
      } catch {
        await enqueueOfflineMutation(description, nextState);
        const q = await getPendingOfflineMutations();
        setPendingSyncCount(q.length);
      }
    },
    [deviceId]
  );

  const handleUpdateWidgets = async (next: DashboardWidgetId[]) => {
    setWidgets(next);
    await saveDashboardLayout(next);
  };

  const handleAddEvent = (evt: Omit<CalendarEvent, 'id' | 'updatedAt'>) => {
    if (!workspace) return;
    const created: CalendarEvent = {
      ...evt,
      id: `evt-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    persistWorkspace(
      { ...workspace, events: [...workspace.events, created] },
      `Added event ${created.title}`
    );
  };

  const handleDeleteEvent = (id: string) => {
    if (!workspace) return;
    persistWorkspace(
      { ...workspace, events: workspace.events.filter((e) => e.id !== id) },
      'Deleted event'
    );
  };

  const handleAutoResolveConflicts = async () => {
    if (!workspace) return;
    const res = await fetch('/api/agent/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'Automatically resolve any calendar conflicts by moving overlapping meetings to the next open slot.',
        currentLocalIso: new Date().toISOString(),
        deviceId,
      }),
    });
    const data = (await res.json()) as { workspace?: WorkspaceState; replyText?: string };
    if (data.workspace) {
      setWorkspace(data.workspace);
      await saveOfflineWorkspace(data.workspace);
    }
    if (data.replyText) setUrgentToast(data.replyText);
  };

  const handleAddReminder = (rem: Omit<ReminderItem, 'id'>) => {
    if (!workspace) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const created: ReminderItem = { ...rem, id: `rem-${Date.now()}` };
    persistWorkspace(
      { ...workspace, reminders: [created, ...workspace.reminders] },
      `Added reminder ${created.title}`
    );
  };

  const handleToggleReminder = (id: string) => {
    if (!workspace) return;
    persistWorkspace(
      {
        ...workspace,
        reminders: workspace.reminders.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)),
      },
      'Toggled reminder'
    );
  };

  const handleSendEmail = async (draft: {
    to: string;
    subject: string;
    body: string;
    priority: 'urgent' | 'normal';
  }) => {
    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, deviceId }),
    });
    const data = (await res.json()) as { workspace?: WorkspaceState; error?: string };
    if (!res.ok) throw new Error(data.error || 'Email send failed.');
    if (data.workspace) {
      setWorkspace(data.workspace);
      await saveOfflineWorkspace(data.workspace);
    }
    setUrgentToast(`Email dispatched to ${draft.to}`);
  };

  const handleMarkEmailRead = (id: string) => {
    if (!workspace) return;
    persistWorkspace(
      {
        ...workspace,
        emails: workspace.emails.map((m) => (m.id === id ? { ...m, unread: false } : m)),
      },
      'Marked email read'
    );
  };

  const handleMoveTask = (taskId: string, targetColumn: TaskColumn) => {
    if (!workspace) return;
    persistWorkspace(
      {
        ...workspace,
        tasks: workspace.tasks.map((t) =>
          t.id === taskId ? { ...t, column: targetColumn, updatedAt: new Date().toISOString() } : t
        ),
      },
      `Moved task to ${targetColumn}`
    );
  };

  const handleAddTask = (task: Omit<TaskItem, 'id' | 'updatedAt' | 'order'>) => {
    if (!workspace) return;
    const created: TaskItem = {
      ...task,
      id: `task-${Date.now()}`,
      order: workspace.tasks.length,
      updatedAt: new Date().toISOString(),
    };
    persistWorkspace({ ...workspace, tasks: [created, ...workspace.tasks] }, `Added task ${created.title}`);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!workspace) return;
    persistWorkspace(
      { ...workspace, tasks: workspace.tasks.filter((t) => t.id !== taskId) },
      'Deleted task'
    );
  };

  const handleUpdatePermissions = async (
    memberId: string,
    role: TeamMember['role'],
    permissions: TeamPermissions
  ) => {
    const res = await fetch('/api/team/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role, permissions, deviceId }),
    });
    if (res.ok) {
      const updated = (await res.json()) as WorkspaceState;
      setWorkspace(updated);
      await saveOfflineWorkspace(updated);
    }
  };

  const handleOfflineVoiceCommand = async (text: string): Promise<string> => {
    if (!workspace) return 'Workspace not loaded.';
    const lower = text.toLowerCase();
    if (lower.includes('remind')) {
      const rem: ReminderItem = {
        id: `rem-${Date.now()}`,
        title: text,
        triggerAtIso: new Date(Date.now() + 30 * 60000).toISOString(),
        priority: lower.includes('urgent') ? 'urgent' : 'normal',
        completed: false,
        category: 'Offline Voice',
      };
      await persistWorkspace({ ...workspace, reminders: [rem, ...workspace.reminders] }, 'Offline voice reminder');
      return 'Saved reminder offline. It will sync automatically when you reconnect.';
    }
    const task: TaskItem = {
      id: `task-${Date.now()}`,
      title: text,
      description: 'Captured offline via Aether voice queue.',
      column: 'backlog',
      priority: lower.includes('urgent') ? 'urgent' : 'medium',
      projectId: 'proj-core',
      assigneeId: 'usr-1',
      dueDateIso: new Date(Date.now() + 86400000).toISOString(),
      order: 0,
      updatedAt: new Date().toISOString(),
    };
    await persistWorkspace({ ...workspace, tasks: [task, ...workspace.tasks] }, 'Offline voice task');
    return 'Added task to your offline board. It will sync when connectivity returns.';
  };

  const currentPermissions = workspace?.team[0]?.permissions ?? {
    canEditCalendar: true,
    canSendEmail: true,
    canManageTasks: true,
    canExportData: true,
    canManageBackups: true,
  };

  const unreadNotifCount = workspace?.notifications.filter((n) => !n.read).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0C10] text-slate-900 dark:text-slate-100 pb-20 md:pb-8">
      {/* 3-Zone Top Bar Contract (Desktop & Tablet) + Compact Mobile Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0A0C10]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            onClick={() => setActiveTab('overview')}
            className="text-lg font-bold tracking-tight font-display text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Aether
          </button>

          {/* Zone 2: 5 Clean Single-Line Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-indigo-500 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Ask Aether Voice Agent) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
            <button
              onClick={() => setVoiceOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Mic className="w-4 h-4" />
              Ask Aether
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Workspace Utility Bar (Prominent Dark Mode Toggle, Search, Lock, PWA Install) */}
      <div className="border-b border-slate-200/80 dark:border-white/5 bg-slate-100/70 dark:bg-[#0D1017]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {workspace?.team[0]?.email ?? 'OFENTSEALSTON19@gmail.com'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {isOnline ? 'Synced' : 'Offline Vault'}
            </span>
            {unreadNotifCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {unreadNotifCount} urgent alerts
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Prominent Dark / Light Mode Toggle */}
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="min-h-[38px] inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#11141B] px-3 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  Dark Mode
                </>
              )}
            </button>

            <button
              onClick={() => setSearchOpen(true)}
              className="min-h-[38px] inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              Search Docs
            </button>

            <button
              onClick={() => setBiometricModal('configure')}
              className="min-h-[38px] inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              Vault Lock
            </button>

            <PWAInstallButton />
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {urgentToast && (
          <div className="mb-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 flex items-center justify-between gap-4 text-xs text-indigo-700 dark:text-indigo-200">
            <span>{urgentToast}</span>
            <button
              onClick={() => setUrgentToast(null)}
              className="font-medium underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading && !workspace && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-52 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] animate-pulse" />
            <div className="h-52 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] animate-pulse" />
          </div>
        )}

        {loadError && !workspace && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-600 dark:text-rose-300">
            {loadError}
          </div>
        )}

        {workspace && activeTab === 'overview' && (
          <OverviewDashboard
            workspace={workspace}
            widgets={widgets}
            onUpdateWidgets={handleUpdateWidgets}
            onNavigate={setActiveTab}
            onOpenVoice={(prompt) => {
              setVoiceInitialPrompt(prompt ?? null);
              setVoiceOpen(true);
            }}
            onToggleReminder={handleToggleReminder}
            onMarkNotificationRead={(id) =>
              persistWorkspace(
                {
                  ...workspace,
                  notifications: workspace.notifications.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                  ),
                },
                'Marked notification read'
              )
            }
          />
        )}

        {workspace && activeTab === 'calendar' && (
          <CalendarView
            events={workspace.events}
            reminders={workspace.reminders}
            canEditCalendar={currentPermissions.canEditCalendar}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
            onAutoResolveConflicts={handleAutoResolveConflicts}
            onAddReminder={handleAddReminder}
            onToggleReminder={handleToggleReminder}
          />
        )}

        {workspace && activeTab === 'inbox' && (
          <EmailView
            emails={workspace.emails}
            canSendEmail={currentPermissions.canSendEmail}
            onSendEmail={handleSendEmail}
            onMarkRead={handleMarkEmailRead}
            onDraftWithVoice={(prompt) => {
              setVoiceInitialPrompt(prompt);
              setVoiceOpen(true);
            }}
          />
        )}

        {workspace && activeTab === 'projects' && (
          <TasksBoard
            tasks={workspace.tasks}
            team={workspace.team}
            canManageTasks={currentPermissions.canManageTasks}
            onMoveTask={handleMoveTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {workspace && activeTab === 'team' && (
          <TeamSecurityView
            workspace={workspace}
            backups={backups}
            userTier={userTier}
            deviceId={deviceId}
            onTierChange={setUserTier}
            onUpdateMemberPermissions={handleUpdatePermissions}
            onBackupCreated={(_rec, all) => setBackups(all)}
            onRestoreWorkspace={async (restored) => {
              await persistWorkspace(restored, 'Restored encrypted cloud snapshot');
            }}
            onOpenBiometricConfig={() => setBiometricModal('configure')}
          />
        )}
      </main>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar (< 60px high, 44px+ hitboxes) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0A0C10]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-15">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Offline Indicator */}
      <OfflineIndicator pendingCount={pendingSyncCount} onSyncNow={flushOfflineQueue} />

      <VoiceAssistantModal
        isOpen={voiceOpen}
        isOnline={isOnline}
        initialPrompt={voiceInitialPrompt}
        onClose={() => {
          setVoiceOpen(false);
          setVoiceInitialPrompt(null);
        }}
        onWorkspaceUpdated={async (next) => {
          setWorkspace(next);
          await saveOfflineWorkspace(next);
        }}
        onConfirmSendEmail={handleSendEmail}
        onBookEvent={async (evt) => {
          handleAddEvent({
            title: evt.title,
            startIso: evt.startIso,
            endIso: evt.endIso,
            attendees: evt.attendees,
            location: evt.location,
            priority: (['urgent', 'high', 'medium', 'low'].includes(evt.priority)
              ? evt.priority
              : 'medium') as CalendarEvent['priority'],
            notes: evt.notes,
            category: 'meeting',
          });
        }}
        onOfflineCommand={handleOfflineVoiceCommand}
      />

      {searchOpen && workspace && (
        <SearchModal
          workspace={workspace}
          onClose={() => setSearchOpen(false)}
          onNavigate={setActiveTab}
        />
      )}

      {biometricModal && (
        <BiometricLockModal
          mode={biometricModal}
          userEmail={workspace?.team[0]?.email ?? 'OFENTSEALSTON19@gmail.com'}
          onUnlock={() => setBiometricModal(null)}
          onClose={() => setBiometricModal(null)}
        />
      )}
    </div>
  );
}
