import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AgentAction,
  CalendarEvent,
  EmailMessage,
  EncryptedBackupRecord,
  ReminderItem,
  TaskColumn,
  TaskItem,
  TeamMember,
  TeamNotification,
  WorkspaceState,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');
const BACKUPS_FILE = path.join(DATA_DIR, 'backups.json');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function createSeedWorkspace(): WorkspaceState {
  const today = new Date('2026-11-20T09:00:00-08:00');
  const isoAt = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  return {
    events: [
      {
        id: 'evt-1',
        title: 'Q4 Mobile Architecture Sync',
        startIso: isoAt(0, 12, 0),
        endIso: isoAt(0, 13, 0),
        location: 'Encrypted Bridge · Room 4A',
        attendees: ['elena.vance@aether.dev', 'marcus.chen@aether.dev'],
        priority: 'urgent',
        notes: 'Finalize zero-knowledge sync protocol and mobile battery budget.',
        category: 'meeting',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'evt-2',
        title: 'Security Key Rotation Review',
        startIso: isoAt(0, 12, 30),
        endIso: isoAt(0, 13, 30),
        location: 'Security Briefing',
        attendees: ['elena.vance@aether.dev'],
        priority: 'high',
        notes: 'Overlaps with Q4 Mobile Architecture Sync — needs AI reschedule.',
        category: 'deadline',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'evt-3',
        title: 'Deep Focus: Voice Intent Pipeline',
        startIso: isoAt(0, 15, 0),
        endIso: isoAt(0, 16, 30),
        location: 'Focus Mode',
        attendees: [],
        priority: 'medium',
        notes: 'Optimize sub-300ms voice command parsing on mobile Safari.',
        category: 'focus',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'evt-4',
        title: 'Executive Weekly Roadmap',
        startIso: isoAt(1, 10, 0),
        endIso: isoAt(1, 11, 0),
        location: 'Main Briefing',
        attendees: ['elena.vance@aether.dev', 'marcus.chen@aether.dev'],
        priority: 'high',
        notes: 'Review sprint velocity and offline PWA rollout metrics.',
        category: 'meeting',
        updatedAt: new Date().toISOString(),
      },
    ],
    emails: [
      {
        id: 'mail-1',
        from: 'elena.vance@aether.dev',
        to: 'OFENTSEALSTON19@gmail.com',
        subject: 'Urgent: Biometric WebAuthn Enclave Sign-Off',
        body: 'Hi, the WebAuthn passkey verification flow passed all staging checks on iOS 19 and Android 16. Please confirm if we should enable strict hardware-backed keys for team admins before 4:00 PM today.',
        timestampIso: isoAt(0, 10, 42),
        folder: 'inbox',
        unread: true,
        priority: 'urgent',
        encryptedDigest: 'sha256:9f84c2b1e4a0d781',
        threadCount: 3,
      },
      {
        id: 'mail-2',
        from: 'marcus.chen@aether.dev',
        to: 'OFENTSEALSTON19@gmail.com',
        subject: 'Offline IndexedDB Delta Sync Benchmark',
        body: 'Tested 12,500 task records under offline flight mode. Re-sync completed in 180ms once connectivity resumed with zero conflict drops.',
        timestampIso: isoAt(0, 9, 15),
        folder: 'inbox',
        unread: true,
        priority: 'normal',
        encryptedDigest: 'sha256:4a12e7c901b5d33f',
        threadCount: 2,
      },
      {
        id: 'mail-3',
        from: 'security-ops@aether.dev',
        to: 'OFENTSEALSTON19@gmail.com',
        subject: 'Cloud Backup Snapshot Verified (AES-256-GCM)',
        body: 'Your cross-device encrypted snapshot completed successfully. Checksum integrity verified across desktop and mobile clients.',
        timestampIso: isoAt(-1, 18, 30),
        folder: 'inbox',
        unread: false,
        priority: 'normal',
        encryptedDigest: 'sha256:7d31f80a22e91c4b',
        threadCount: 1,
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Finalize E2EE Cloud Backup Key Derivation',
        description: 'Verify PBKDF2 250k iterations and AES-256-GCM IV rotation on mobile browsers.',
        column: 'in_progress',
        priority: 'urgent',
        projectId: 'proj-sec',
        assigneeId: 'usr-2',
        dueDateIso: isoAt(0, 17, 0),
        order: 0,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'task-2',
        title: 'API Migration to Edge Streaming',
        description: 'Move voice transcription fallback and command endpoints to low-latency streaming.',
        column: 'backlog',
        priority: 'high',
        projectId: 'proj-core',
        assigneeId: 'usr-3',
        dueDateIso: isoAt(1, 16, 0),
        order: 0,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'task-3',
        title: 'Touch Gesture Calibration for Kanban',
        description: 'Validate swipe-to-complete and drag-drop thresholds on 375px touchscreens.',
        column: 'review',
        priority: 'medium',
        projectId: 'proj-mobile',
        assigneeId: 'usr-1',
        dueDateIso: isoAt(2, 14, 0),
        order: 0,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'task-4',
        title: 'PDF & CSV Compliance Export Templates',
        description: 'Include tabular timestamps and SHA-256 verification headers in executive exports.',
        column: 'done',
        priority: 'low',
        projectId: 'proj-core',
        assigneeId: 'usr-3',
        dueDateIso: isoAt(-1, 12, 0),
        order: 0,
        updatedAt: new Date().toISOString(),
      },
    ],
    reminders: [
      {
        id: 'rem-1',
        title: 'Approve Biometric WebAuthn release window',
        triggerAtIso: isoAt(0, 15, 30),
        priority: 'urgent',
        completed: false,
        category: 'Security',
      },
      {
        id: 'rem-2',
        title: 'Send board summary PDF before 5:00 PM',
        triggerAtIso: isoAt(0, 16, 45),
        priority: 'normal',
        completed: false,
        category: 'Executive',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        title: 'Zero-Knowledge Sync Protocol Spec v2',
        category: 'protocol',
        content: 'All mobile and desktop state payloads are encrypted client-side with AES-256-GCM prior to cloud backup upload. Keys remain resident in device WebCrypto enclaves.',
        updatedAtIso: isoAt(0, 8, 30),
        encrypted: true,
        authorId: 'usr-2',
      },
      {
        id: 'doc-2',
        title: 'Mobile Voice Ergonomics & Free Tier Scope',
        category: 'brief',
        content: 'Free tier users receive core Siri-class voice commands, local calendar conflict checks, reminders, and offline IndexedDB cache. Pro unlocks multi-device SSE team sync, RBAC permissions, and encrypted cloud backups.',
        updatedAtIso: isoAt(-1, 14, 20),
        encrypted: false,
        authorId: 'usr-1',
      },
      {
        id: 'doc-3',
        title: 'Q4 Security Audit & RBAC Matrix',
        category: 'audit',
        content: 'Granular workspace permissions enforce role isolation across Admin, Editor, and Viewer accounts with independent toggles for email dispatch, backup restoration, and exports.',
        updatedAtIso: isoAt(-2, 11, 10),
        encrypted: true,
        authorId: 'usr-2',
      },
    ],
    team: [
      {
        id: 'usr-1',
        name: 'Ofentse Alston',
        email: 'OFENTSEALSTON19@gmail.com',
        avatar: '/src/assets/images/avatar_primary_user_1795204221349.jpg',
        role: 'admin',
        status: 'online',
        permissions: {
          canEditCalendar: true,
          canSendEmail: true,
          canManageTasks: true,
          canExportData: true,
          canManageBackups: true,
        },
      },
      {
        id: 'usr-2',
        name: 'Elena Vance',
        email: 'elena.vance@aether.dev',
        avatar: '/src/assets/images/avatar_teammate_elena_1795204220137.jpg',
        role: 'editor',
        status: 'mobile',
        permissions: {
          canEditCalendar: true,
          canSendEmail: true,
          canManageTasks: true,
          canExportData: true,
          canManageBackups: false,
        },
      },
      {
        id: 'usr-3',
        name: 'Marcus Chen',
        email: 'marcus.chen@aether.dev',
        avatar: '/src/assets/images/avatar_teammate_marcus_1795204220559.jpg',
        role: 'viewer',
        status: 'online',
        permissions: {
          canEditCalendar: false,
          canSendEmail: false,
          canManageTasks: true,
          canExportData: true,
          canManageBackups: false,
        },
      },
    ],
    notifications: [
      {
        id: 'notif-1',
        title: 'Calendar conflict detected at 12:30 PM',
        detail: 'Q4 Mobile Architecture Sync overlaps with Security Key Rotation Review by 30 minutes.',
        priority: 'urgent',
        timestampIso: isoAt(0, 11, 15),
        actorName: 'Aether Scheduler',
        read: false,
        type: 'calendar',
      },
      {
        id: 'notif-2',
        title: 'Urgent email from Elena Vance',
        detail: 'Biometric WebAuthn Enclave Sign-Off requires approval before 4:00 PM.',
        priority: 'urgent',
        timestampIso: isoAt(0, 10, 42),
        actorName: 'Elena Vance',
        read: false,
        type: 'email',
      },
      {
        id: 'notif-3',
        title: 'Offline delta benchmark completed',
        detail: 'Marcus Chen synced 12,500 records in 180ms.',
        priority: 'normal',
        timestampIso: isoAt(0, 9, 18),
        actorName: 'Marcus Chen',
        read: true,
        type: 'sync',
      },
    ],
    lastSyncedAtIso: new Date().toISOString(),
  };
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(WORKSPACE_FILE)) {
    fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(createSeedWorkspace(), null, 2));
  }
  if (!fs.existsSync(BACKUPS_FILE)) {
    fs.writeFileSync(BACKUPS_FILE, JSON.stringify([], null, 2));
  }
}

function readWorkspace(): WorkspaceState {
  ensureDataFiles();
  try {
    return JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf-8')) as WorkspaceState;
  } catch {
    const seed = createSeedWorkspace();
    fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}

function writeWorkspace(state: WorkspaceState): WorkspaceState {
  ensureDataFiles();
  const next = { ...state, lastSyncedAtIso: new Date().toISOString() };
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(next, null, 2));
  return next;
}

function readBackups(): EncryptedBackupRecord[] {
  ensureDataFiles();
  try {
    return JSON.parse(fs.readFileSync(BACKUPS_FILE, 'utf-8')) as EncryptedBackupRecord[];
  } catch {
    return [];
  }
}

function writeBackups(backups: EncryptedBackupRecord[]) {
  ensureDataFiles();
  fs.writeFileSync(BACKUPS_FILE, JSON.stringify(backups.slice(0, 25), null, 2));
}

// SSE clients for real-time cross-device and team synchronization
const sseClients = new Set<Response>();
function broadcastWorkspaceUpdate(sourceDeviceId: string, eventType = 'workspace_sync', payload?: unknown) {
  const data = JSON.stringify({ eventType, sourceDeviceId, timestamp: new Date().toISOString(), payload });
  for (const client of sseClients) {
    client.write(`event: sync\ndata: ${data}\n\n`);
  }
}

function findOverlappingEvent(events: CalendarEvent[], startIso: string, endIso: string, ignoreId?: string): CalendarEvent | undefined {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return events.find((evt) => {
    if (ignoreId && evt.id === ignoreId) return false;
    const es = new Date(evt.startIso).getTime();
    const ee = new Date(evt.endIso).getTime();
    return s < ee && e > es;
  });
}

function findNextFreeSlot(events: CalendarEvent[], desiredStartIso: string, durationMs: number): { startIso: string; endIso: string } {
  let candidateStart = new Date(desiredStartIso).getTime();
  for (let i = 0; i < 24; i++) {
    const candidateEnd = candidateStart + durationMs;
    const conflict = findOverlappingEvent(events, new Date(candidateStart).toISOString(), new Date(candidateEnd).toISOString());
    if (!conflict) {
      return {
        startIso: new Date(candidateStart).toISOString(),
        endIso: new Date(candidateEnd).toISOString(),
      };
    }
    candidateStart = new Date(conflict.endIso).getTime() + 15 * 60 * 1000;
  }
  return {
    startIso: new Date(candidateStart).toISOString(),
    endIso: new Date(candidateStart + durationMs).toISOString(),
  };
}

const agentTools: FunctionDeclaration[] = [
  {
    name: 'scheduleMeeting',
    description: 'Schedule a new calendar meeting or focus block. Automatically checks for scheduling conflicts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Clear title of the meeting or event.' },
        startIso: { type: Type.STRING, description: 'ISO 8601 start date-time with timezone offset.' },
        endIso: { type: Type.STRING, description: 'ISO 8601 end date-time with timezone offset.' },
        attendees: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Email addresses or names of attendees.' },
        location: { type: Type.STRING, description: 'Location or encrypted bridge link.' },
        priority: { type: Type.STRING, description: 'urgent, high, medium, or low' },
        notes: { type: Type.STRING, description: 'Optional agenda or notes.' },
        forceOverlap: { type: Type.BOOLEAN, description: 'Set true only if user explicitly confirms double-booking.' },
      },
      required: ['title', 'startIso', 'endIso'],
    },
  },
  {
    name: 'rescheduleMeeting',
    description: 'Move or reschedule an existing calendar meeting to a new time slot.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        titleQuery: { type: Type.STRING, description: 'Title or partial title of the event to move.' },
        newStartIso: { type: Type.STRING, description: 'New ISO 8601 start date-time.' },
        newEndIso: { type: Type.STRING, description: 'New ISO 8601 end date-time.' },
      },
      required: ['titleQuery', 'newStartIso', 'newEndIso'],
    },
  },
  {
    name: 'sendEmail',
    description: 'Prepare or send an email on behalf of the user. Always drafts for user confirmation first unless confirmed=true.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Concise email subject line.' },
        body: { type: Type.STRING, description: 'Full professional email body text.' },
        priority: { type: Type.STRING, description: 'urgent or normal' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'setReminder',
    description: 'Create a real-time priority reminder with a trigger timestamp.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Reminder message.' },
        triggerAtIso: { type: Type.STRING, description: 'ISO 8601 timestamp when reminder should alert.' },
        priority: { type: Type.STRING, description: 'urgent or normal' },
        category: { type: Type.STRING, description: 'Category such as Security, Executive, Personal.' },
      },
      required: ['title', 'triggerAtIso'],
    },
  },
  {
    name: 'createTask',
    description: 'Create a new task card on the project board.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title.' },
        description: { type: Type.STRING, description: 'Task details.' },
        column: { type: Type.STRING, description: 'backlog, in_progress, review, or done' },
        priority: { type: Type.STRING, description: 'urgent, high, medium, or low' },
        dueDateIso: { type: Type.STRING, description: 'Optional ISO due date.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'updateTask',
    description: 'Move, reprioritize, or complete an existing task.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        titleQuery: { type: Type.STRING, description: 'Partial or full title of the task to update.' },
        newColumn: { type: Type.STRING, description: 'backlog, in_progress, review, or done' },
        newPriority: { type: Type.STRING, description: 'urgent, high, medium, or low' },
        newTitle: { type: Type.STRING, description: 'Optional updated title.' },
      },
      required: ['titleQuery'],
    },
  },
  {
    name: 'resolveCalendarConflict',
    description: 'Detect overlapping meetings and automatically suggest or move the conflicting meeting to the next open slot.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventTitleQuery: { type: Type.STRING, description: 'Optional title of meeting to move if conflict exists.' },
        autoApply: { type: Type.BOOLEAN, description: 'If true, moves the conflicting event to the next free slot.' },
      },
    },
  },
  {
    name: 'searchWorkspace',
    description: 'Search across documents, emails, calendar events, and tasks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Keywords to search for.' },
      },
      required: ['query'],
    },
  },
];

async function startServer() {
  ensureDataFiles();
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/workspace', (_req: Request, res: Response) => {
    res.json(readWorkspace());
  });

  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);
    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);
    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.post('/api/workspace/sync', (req: Request, res: Response) => {
    const { state, deviceId } = req.body as { state?: WorkspaceState; deviceId?: string };
    if (!state || !Array.isArray(state.events) || !Array.isArray(state.tasks)) {
      res.status(400).json({ error: 'Invalid workspace sync payload.' });
      return;
    }
    const saved = writeWorkspace(state);
    broadcastWorkspaceUpdate(deviceId || 'unknown', 'workspace_sync');
    res.json(saved);
  });

  app.post('/api/emails/send', (req: Request, res: Response) => {
    const { to, subject, body, priority, deviceId } = req.body as {
      to?: string;
      subject?: string;
      body?: string;
      priority?: 'urgent' | 'normal';
      deviceId?: string;
    };
    if (!to || !subject || !body) {
      res.status(400).json({ error: 'Missing required email fields (to, subject, body).' });
      return;
    }
    const workspace = readWorkspace();
    const digest = crypto.createHash('sha256').update(`${to}|${subject}|${body}`).digest('hex').slice(0, 16);
    const sentEmail: EmailMessage = {
      id: `mail-${Date.now()}`,
      from: 'OFENTSEALSTON19@gmail.com',
      to,
      subject,
      body,
      timestampIso: new Date().toISOString(),
      folder: 'sent',
      unread: false,
      priority: priority === 'urgent' ? 'urgent' : 'normal',
      encryptedDigest: `sha256:${digest}`,
      threadCount: 1,
    };
    const notif: TeamNotification = {
      id: `notif-${Date.now()}`,
      title: `Email dispatched to ${to}`,
      detail: subject,
      priority: sentEmail.priority,
      timestampIso: new Date().toISOString(),
      actorName: 'Aether Mail',
      read: false,
      type: 'email',
    };
    workspace.emails.unshift(sentEmail);
    workspace.notifications.unshift(notif);
    const saved = writeWorkspace(workspace);
    broadcastWorkspaceUpdate(deviceId || 'desktop', 'email_sent', sentEmail);
    res.json({ email: sentEmail, workspace: saved });
  });

  app.patch('/api/team/permissions', (req: Request, res: Response) => {
    const { memberId, role, permissions, deviceId } = req.body as {
      memberId?: string;
      role?: TeamMember['role'];
      permissions?: TeamMember['permissions'];
      deviceId?: string;
    };
    if (!memberId) {
      res.status(400).json({ error: 'memberId is required.' });
      return;
    }
    const workspace = readWorkspace();
    const member = workspace.team.find((m) => m.id === memberId);
    if (!member) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }
    if (role) member.role = role;
    if (permissions) member.permissions = { ...member.permissions, ...permissions };
    workspace.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: `Permissions updated for ${member.name}`,
      detail: `Role set to ${member.role}`,
      priority: 'normal',
      timestampIso: new Date().toISOString(),
      actorName: 'Access Control',
      read: false,
      type: 'security',
    });
    const saved = writeWorkspace(workspace);
    broadcastWorkspaceUpdate(deviceId || 'desktop', 'permissions_updated');
    res.json(saved);
  });

  app.post('/api/backup/create', (req: Request, res: Response) => {
    const record = req.body as EncryptedBackupRecord;
    if (!record?.ciphertextBase64 || !record?.ivBase64 || !record?.checksumSha256) {
      res.status(400).json({ error: 'Encrypted backup payload is incomplete.' });
      return;
    }
    const backups = readBackups();
    const created: EncryptedBackupRecord = {
      ...record,
      id: record.id || `bkp-${Date.now()}`,
      createdAtIso: record.createdAtIso || new Date().toISOString(),
    };
    backups.unshift(created);
    writeBackups(backups);
    const workspace = readWorkspace();
    workspace.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Encrypted cloud backup saved',
      detail: `${created.itemCount} records sealed (${created.checksumSha256.slice(0, 12)})`,
      priority: 'normal',
      timestampIso: new Date().toISOString(),
      actorName: created.deviceName,
      read: false,
      type: 'security',
    });
    writeWorkspace(workspace);
    broadcastWorkspaceUpdate('backup', 'backup_created');
    res.json({ backup: created, backups });
  });

  app.get('/api/backup/list', (_req: Request, res: Response) => {
    res.json({ backups: readBackups() });
  });

  app.get('/api/backup/:id', (req: Request, res: Response) => {
    const backups = readBackups();
    const found = backups.find((b) => b.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Backup snapshot not found.' });
      return;
    }
    res.json({ backup: found });
  });

  // Server-side Gemini 3.5 Transcribe audio fallback
  app.post('/api/agent/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body as { audioBase64?: string; mimeType?: string };
      if (!audioBase64 || !mimeType) {
        res.status(400).json({ error: 'Missing audioBase64 or mimeType.' });
        return;
      }
      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
        return;
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: audioBase64, mimeType } },
              { text: 'Transcribe this voice command verbatim without commentary.' },
            ],
          },
        ],
      });
      res.json({ transcript: (response.text ?? '').trim() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Audio transcription failed.';
      res.status(500).json({ error: message });
    }
  });

  // Server-side Gemini 4 Hydrogen Siri-like voice & command agent
  app.post('/api/agent/command', async (req: Request, res: Response) => {
    try {
      const { command, currentLocalIso, deviceId } = req.body as {
        command?: string;
        currentLocalIso?: string;
        deviceId?: string;
      };

      if (!command || typeof command !== 'string') {
        res.status(400).json({ error: 'Voice or text command is required.' });
        return;
      }
      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
        return;
      }

      const workspace = readWorkspace();
      const nowIso = currentLocalIso || new Date().toISOString();

      const contextSummary = {
        nowIso,
        events: workspace.events.map((e) => ({
          id: e.id,
          title: e.title,
          startIso: e.startIso,
          endIso: e.endIso,
          priority: e.priority,
        })),
        tasks: workspace.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          column: t.column,
          priority: t.priority,
        })),
        reminders: workspace.reminders.map((r) => ({
          id: r.id,
          title: r.title,
          triggerAtIso: r.triggerAtIso,
          completed: r.completed,
        })),
        teammates: workspace.team.map((m) => ({ name: m.name, email: m.email, role: m.role })),
        unreadUrgentEmails: workspace.emails
          .filter((m) => m.unread)
          .map((m) => ({ from: m.from, subject: m.subject, priority: m.priority })),
      };

      const systemInstruction = `You are Aether, a crisp, Siri-class mobile and desktop executive AI assistant.
Current local date-time: ${nowIso}.
User email: OFENTSEALSTON19@gmail.com.
Workspace context JSON:
${JSON.stringify(contextSummary)}

Rules:
- Interpret natural language voice commands accurately for calendar scheduling, rescheduling, conflict resolution, email drafting/sending, reminders, task creation/updates, and document/workspace search.
- Resolve relative dates ("tomorrow at 2pm", "in 30 minutes", "this afternoon") against ${nowIso}.
- Map teammate first names ("Elena", "Marcus") to their email addresses from teammates context.
- Call the appropriate function tool(s) immediately instead of only describing what you would do.
- Keep your final spoken reply concise (1-2 natural sentences, Siri style, no markdown symbols like ** or #).`;

      const response1 = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: command }] }],
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ functionDeclarations: agentTools }],
        },
      });

      const functionCalls = response1.functionCalls ?? [];
      const executedActions: AgentAction[] = [];
      let workspaceMutated = false;

      const functionResponseParts: Array<{
        functionResponse: { id?: string; name: string; response: Record<string, unknown> };
      }> = [];

      for (const call of functionCalls) {
        const args = (call.args ?? {}) as Record<string, unknown>;
        const name = call.name ?? '';

        if (name === 'scheduleMeeting') {
          const title = String(args.title || 'New Meeting');
          const startIso = String(args.startIso || nowIso);
          const endIso = String(args.endIso || new Date(new Date(startIso).getTime() + 3600000).toISOString());
          const forceOverlap = Boolean(args.forceOverlap);
          const overlap = findOverlappingEvent(workspace.events, startIso, endIso);

          if (overlap && !forceOverlap) {
            const duration = Math.max(1800000, new Date(endIso).getTime() - new Date(startIso).getTime());
            const nextSlot = findNextFreeSlot(workspace.events, startIso, duration);
            const action: AgentAction = {
              type: 'schedule_meeting',
              status: 'conflict_detected',
              summary: `"${title}" conflicts with "${overlap.title}"`,
              payload: {
                title,
                startIso,
                endIso,
                attendees: Array.isArray(args.attendees) ? args.attendees : [],
                location: String(args.location || 'Encrypted Bridge'),
                priority: String(args.priority || 'medium'),
                notes: String(args.notes || ''),
              },
              conflictDetails: {
                conflictingEventTitle: overlap.title,
                conflictingStartIso: overlap.startIso,
                conflictingEndIso: overlap.endIso,
                suggestedSlotStartIso: nextSlot.startIso,
                suggestedSlotEndIso: nextSlot.endIso,
              },
            };
            executedActions.push(action);
            functionResponseParts.push({
              functionResponse: {
                id: call.id,
                name,
                response: {
                  status: 'conflict_detected',
                  conflictingEvent: overlap.title,
                  suggestedSlot: nextSlot,
                },
              },
            });
          } else {
            const newEvt: CalendarEvent = {
              id: `evt-${Date.now()}`,
              title,
              startIso,
              endIso,
              location: String(args.location || 'Encrypted Bridge'),
              attendees: Array.isArray(args.attendees) ? args.attendees.map(String) : [],
              priority: (['urgent', 'high', 'medium', 'low'].includes(String(args.priority))
                ? args.priority
                : 'medium') as CalendarEvent['priority'],
              notes: String(args.notes || ''),
              category: 'meeting',
              updatedAt: new Date().toISOString(),
            };
            workspace.events.push(newEvt);
            workspace.notifications.unshift({
              id: `notif-${Date.now()}`,
              title: `Scheduled: ${newEvt.title}`,
              detail: `${new Date(newEvt.startIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              priority: newEvt.priority === 'urgent' ? 'urgent' : 'normal',
              timestampIso: new Date().toISOString(),
              actorName: 'Aether Voice',
              read: false,
              type: 'calendar',
            });
            workspaceMutated = true;
            executedActions.push({
              type: 'schedule_meeting',
              status: 'executed',
              summary: `Scheduled "${newEvt.title}"`,
              payload: newEvt as unknown as Record<string, unknown>,
            });
            functionResponseParts.push({
              functionResponse: { id: call.id, name, response: { status: 'scheduled', event: newEvt } },
            });
          }
        } else if (name === 'rescheduleMeeting') {
          const query = String(args.titleQuery || '').toLowerCase();
          const target = workspace.events.find((e) => e.title.toLowerCase().includes(query));
          if (!target) {
            functionResponseParts.push({
              functionResponse: { id: call.id, name, response: { status: 'not_found', query } },
            });
          } else {
            target.startIso = String(args.newStartIso);
            target.endIso = String(args.newEndIso);
            target.updatedAt = new Date().toISOString();
            workspaceMutated = true;
            executedActions.push({
              type: 'reschedule_meeting',
              status: 'executed',
              summary: `Moved "${target.title}"`,
              payload: target as unknown as Record<string, unknown>,
            });
            functionResponseParts.push({
              functionResponse: { id: call.id, name, response: { status: 'rescheduled', event: target } },
            });
          }
        } else if (name === 'sendEmail') {
          const to = String(args.to || '');
          const subject = String(args.subject || 'Quick Update');
          const body = String(args.body || '');
          const priority = args.priority === 'urgent' ? 'urgent' : 'normal';
          executedActions.push({
            type: 'send_email',
            status: 'needs_confirmation',
            summary: `Draft ready for ${to}: "${subject}"`,
            payload: { to, subject, body, priority },
          });
          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name,
              response: { status: 'awaiting_user_confirmation', to, subject },
            },
          });
        } else if (name === 'setReminder') {
          const newRem: ReminderItem = {
            id: `rem-${Date.now()}`,
            title: String(args.title || 'Reminder'),
            triggerAtIso: String(args.triggerAtIso || new Date(Date.now() + 1800000).toISOString()),
            priority: args.priority === 'urgent' ? 'urgent' : 'normal',
            completed: false,
            category: String(args.category || 'Voice'),
          };
          workspace.reminders.unshift(newRem);
          workspace.notifications.unshift({
            id: `notif-${Date.now()}`,
            title: `Reminder set: ${newRem.title}`,
            detail: new Date(newRem.triggerAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            priority: newRem.priority,
            timestampIso: new Date().toISOString(),
            actorName: 'Aether Voice',
            read: false,
            type: 'sync',
          });
          workspaceMutated = true;
          executedActions.push({
            type: 'set_reminder',
            status: 'executed',
            summary: `Reminder: "${newRem.title}"`,
            payload: newRem as unknown as Record<string, unknown>,
          });
          functionResponseParts.push({
            functionResponse: { id: call.id, name, response: { status: 'created', reminder: newRem } },
          });
        } else if (name === 'createTask') {
          const col = (['backlog', 'in_progress', 'review', 'done'].includes(String(args.column))
            ? args.column
            : 'backlog') as TaskColumn;
          const newTask: TaskItem = {
            id: `task-${Date.now()}`,
            title: String(args.title || 'New Task'),
            description: String(args.description || 'Created via voice command'),
            column: col,
            priority: (['urgent', 'high', 'medium', 'low'].includes(String(args.priority))
              ? args.priority
              : 'medium') as TaskItem['priority'],
            projectId: 'proj-core',
            assigneeId: 'usr-1',
            dueDateIso: String(args.dueDateIso || new Date(Date.now() + 86400000).toISOString()),
            order: workspace.tasks.filter((t) => t.column === col).length,
            updatedAt: new Date().toISOString(),
          };
          workspace.tasks.unshift(newTask);
          workspaceMutated = true;
          executedActions.push({
            type: 'create_task',
            status: 'executed',
            summary: `Added task "${newTask.title}"`,
            payload: newTask as unknown as Record<string, unknown>,
          });
          functionResponseParts.push({
            functionResponse: { id: call.id, name, response: { status: 'created', task: newTask } },
          });
        } else if (name === 'updateTask') {
          const query = String(args.titleQuery || '').toLowerCase();
          const task = workspace.tasks.find((t) => t.title.toLowerCase().includes(query));
          if (!task) {
            functionResponseParts.push({
              functionResponse: { id: call.id, name, response: { status: 'not_found', query } },
            });
          } else {
            if (args.newColumn && ['backlog', 'in_progress', 'review', 'done'].includes(String(args.newColumn))) {
              task.column = args.newColumn as TaskColumn;
            }
            if (args.newPriority && ['urgent', 'high', 'medium', 'low'].includes(String(args.newPriority))) {
              task.priority = args.newPriority as TaskItem['priority'];
            }
            if (args.newTitle) {
              task.title = String(args.newTitle);
            }
            task.updatedAt = new Date().toISOString();
            workspaceMutated = true;
            executedActions.push({
              type: 'update_task',
              status: 'executed',
              summary: `Updated "${task.title}" (${task.column.replace('_', ' ')})`,
              payload: task as unknown as Record<string, unknown>,
            });
            functionResponseParts.push({
              functionResponse: { id: call.id, name, response: { status: 'updated', task } },
            });
          }
        } else if (name === 'resolveCalendarConflict') {
          const autoApply = Boolean(args.autoApply);
          const sorted = [...workspace.events].sort(
            (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
          );
          let foundConflict: { a: CalendarEvent; b: CalendarEvent } | null = null;
          for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (new Date(a.endIso).getTime() > new Date(b.startIso).getTime()) {
              foundConflict = { a, b };
              break;
            }
          }
          if (!foundConflict) {
            functionResponseParts.push({
              functionResponse: { id: call.id, name, response: { status: 'no_conflicts' } },
            });
          } else {
            const duration = new Date(foundConflict.b.endIso).getTime() - new Date(foundConflict.b.startIso).getTime();
            const freeSlot = findNextFreeSlot(workspace.events, foundConflict.b.startIso, duration);
            if (autoApply) {
              foundConflict.b.startIso = freeSlot.startIso;
              foundConflict.b.endIso = freeSlot.endIso;
              foundConflict.b.updatedAt = new Date().toISOString();
              workspaceMutated = true;
              executedActions.push({
                type: 'resolve_conflict',
                status: 'executed',
                summary: `Moved "${foundConflict.b.title}" to resolve overlap`,
                payload: foundConflict.b as unknown as Record<string, unknown>,
              });
            } else {
              executedActions.push({
                type: 'resolve_conflict',
                status: 'conflict_detected',
                summary: `"${foundConflict.a.title}" overlaps "${foundConflict.b.title}"`,
                payload: { eventId: foundConflict.b.id, title: foundConflict.b.title },
                conflictDetails: {
                  conflictingEventTitle: foundConflict.a.title,
                  conflictingStartIso: foundConflict.b.startIso,
                  conflictingEndIso: foundConflict.b.endIso,
                  suggestedSlotStartIso: freeSlot.startIso,
                  suggestedSlotEndIso: freeSlot.endIso,
                },
              });
            }
            functionResponseParts.push({
              functionResponse: {
                id: call.id,
                name,
                response: {
                  status: autoApply ? 'resolved' : 'conflict_found',
                  eventA: foundConflict.a.title,
                  eventB: foundConflict.b.title,
                  suggestedSlot: freeSlot,
                },
              },
            });
          }
        } else if (name === 'searchWorkspace') {
          const q = String(args.query || '').toLowerCase();
          const matches = {
            events: workspace.events.filter((e) => e.title.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)),
            emails: workspace.emails.filter((m) => m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q)),
            tasks: workspace.tasks.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
            documents: workspace.documents.filter((d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)),
          };
          executedActions.push({
            type: 'search_workspace',
            status: 'executed',
            summary: `Searched "${q}"`,
            payload: matches,
          });
          functionResponseParts.push({
            functionResponse: { id: call.id, name, response: matches },
          });
        }
      }

      let finalReply = (response1.text ?? '').trim();
      const previousContent = response1.candidates?.[0]?.content;

      if (functionResponseParts.length > 0 && previousContent) {
        const response2 = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [
            { role: 'user', parts: [{ text: command }] },
            previousContent,
            { role: 'user', parts: functionResponseParts },
          ],
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        finalReply = (response2.text ?? finalReply).trim();
      }

      if (workspaceMutated) {
        writeWorkspace(workspace);
        broadcastWorkspaceUpdate(deviceId || 'voice', 'agent_mutation');
      }

      res.json({
        replyText: finalReply || 'Done. Your workspace has been updated.',
        actions: executedActions,
        transcript: command,
        workspace: workspaceMutated ? readWorkspace() : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent command processing failed.';
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Aether server running on http://0.0.0.0:${port}`);
  });
}

startServer();
