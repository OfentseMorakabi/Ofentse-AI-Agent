import { openDB, type IDBPDatabase } from 'idb';
import type { DashboardWidgetId, WorkspaceState } from '../types';

const DB_NAME = 'aether_offline_vault';
const DB_VERSION = 1;

interface OfflineMutation {
  id: string;
  timestampIso: string;
  description: string;
  state: WorkspaceState;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workspace')) {
          db.createObjectStore('workspace');
        }
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveOfflineWorkspace(state: WorkspaceState): Promise<void> {
  const db = await getDb();
  await db.put('workspace', state, 'current');
}

export async function loadOfflineWorkspace(): Promise<WorkspaceState | null> {
  const db = await getDb();
  const data = await db.get('workspace', 'current');
  return (data as WorkspaceState | undefined) ?? null;
}

export async function enqueueOfflineMutation(description: string, state: WorkspaceState): Promise<void> {
  const db = await getDb();
  const item: OfflineMutation = {
    id: `mut-${Date.now()}`,
    timestampIso: new Date().toISOString(),
    description,
    state,
  };
  await db.put('queue', item);
}

export async function getPendingOfflineMutations(): Promise<OfflineMutation[]> {
  const db = await getDb();
  return (await db.getAll('queue')) as OfflineMutation[];
}

export async function clearOfflineQueue(): Promise<void> {
  const db = await getDb();
  await db.clear('queue');
}

export async function saveDashboardLayout(widgets: DashboardWidgetId[]): Promise<void> {
  const db = await getDb();
  await db.put('prefs', widgets, 'dashboard_widgets');
}

export async function loadDashboardLayout(): Promise<DashboardWidgetId[] | null> {
  const db = await getDb();
  const res = await db.get('prefs', 'dashboard_widgets');
  return (res as DashboardWidgetId[] | undefined) ?? null;
}
