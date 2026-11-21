export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskColumn = 'backlog' | 'in_progress' | 'review' | 'done';
export type AppTab = 'overview' | 'calendar' | 'inbox' | 'projects' | 'team';
export type UserTier = 'free' | 'pro';

export interface CalendarEvent {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  location: string;
  attendees: string[];
  priority: Priority;
  notes: string;
  category: 'meeting' | 'focus' | 'deadline' | 'personal';
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestampIso: string;
  folder: 'inbox' | 'sent' | 'drafts';
  unread: boolean;
  priority: 'urgent' | 'normal';
  encryptedDigest: string;
  threadCount: number;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  column: TaskColumn;
  priority: Priority;
  projectId: string;
  assigneeId: string;
  dueDateIso: string;
  order: number;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  triggerAtIso: string;
  priority: 'urgent' | 'normal';
  completed: boolean;
  category: string;
  notified?: boolean;
}

export interface WorkspaceDocument {
  id: string;
  title: string;
  category: 'protocol' | 'brief' | 'notes' | 'audit';
  content: string;
  updatedAtIso: string;
  encrypted: boolean;
  authorId: string;
}

export interface TeamPermissions {
  canEditCalendar: boolean;
  canSendEmail: boolean;
  canManageTasks: boolean;
  canExportData: boolean;
  canManageBackups: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'online' | 'mobile' | 'offline';
  permissions: TeamPermissions;
}

export interface TeamNotification {
  id: string;
  title: string;
  detail: string;
  priority: 'urgent' | 'normal';
  timestampIso: string;
  actorName: string;
  read: boolean;
  type: 'calendar' | 'email' | 'task' | 'security' | 'sync';
}

export interface EncryptedBackupRecord {
  id: string;
  createdAtIso: string;
  deviceName: string;
  itemCount: number;
  sizeBytes: number;
  checksumSha256: string;
  ivBase64: string;
  saltBase64: string;
  ciphertextBase64: string;
}

export interface WorkspaceState {
  events: CalendarEvent[];
  emails: EmailMessage[];
  tasks: TaskItem[];
  reminders: ReminderItem[];
  documents: WorkspaceDocument[];
  team: TeamMember[];
  notifications: TeamNotification[];
  lastSyncedAtIso: string;
}

export type DashboardWidgetId =
  | 'calendar_timeline'
  | 'urgent_inbox'
  | 'task_pipeline'
  | 'reminders_queue'
  | 'team_activity';

export interface AgentAction {
  type:
    | 'schedule_meeting'
    | 'reschedule_meeting'
    | 'send_email'
    | 'set_reminder'
    | 'create_task'
    | 'update_task'
    | 'search_workspace'
    | 'resolve_conflict';
  status: 'executed' | 'needs_confirmation' | 'conflict_detected';
  summary: string;
  payload: Record<string, unknown>;
  conflictDetails?: {
    conflictingEventTitle: string;
    conflictingStartIso: string;
    conflictingEndIso: string;
    suggestedSlotStartIso: string;
    suggestedSlotEndIso: string;
  };
}

export interface AgentCommandResponse {
  replyText: string;
  actions: AgentAction[];
  transcript: string;
}
