import type {
  AdminConfig,
  ChatSession,
  EngineMode,
  LocalServerConfig,
  PersonaId,
  ResponseTone,
  RoutingModeId,
  UsageStats,
} from '../types/onyx';
import type { SpeechLanguageCode } from './artifacts';

const DB_NAME = 'onyx_ai_os_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_state';
const LOCAL_BACKUP_PREFIX = 'onyx_idb_backup_';

export interface PersistedWorkspaceSnapshot {
  chats: ChatSession[];
  activeChatId: string | null;
  draftInput: string;
  engineMode: EngineMode;
  routingMode: RoutingModeId;
  persona: PersonaId;
  responseTone: ResponseTone;
  speechLang: SpeechLanguageCode;
  localServerConfig: LocalServerConfig;
  usageStats: UsageStats;
  updatedAt: number;
}

export const DEFAULT_LOCAL_SERVER_CONFIG: LocalServerConfig = {
  endpointUrl: 'http://127.0.0.1:8080/v1/chat/completions',
  modelName: 'qwen2.5-3b-instruct-q4_k_m',
  temperature: 0.7,
  maxTokens: 1024,
};

function openOnyxDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openOnyxDatabase();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut<T>(key: string, value: T): Promise<void> {
  const db = await openOnyxDatabase();
  if (!db) {
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readLocalBackup<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(`${LOCAL_BACKUP_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalBackup<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(
      `${LOCAL_BACKUP_PREFIX}${key}`,
      JSON.stringify(value)
    );
  } catch {
    // Ignore quota / private browsing errors
  }
}

export async function loadPersistedWorkspace(
  scopeKey: string
): Promise<PersistedWorkspaceSnapshot | null> {
  const key = `workspace_${scopeKey}`;
  const [fromIdb, fromLocal] = await Promise.all([
    idbGet<PersistedWorkspaceSnapshot>(key),
    Promise.resolve(readLocalBackup<PersistedWorkspaceSnapshot>(key)),
  ]);

  if (fromIdb && fromLocal) {
    return (fromIdb.updatedAt ?? 0) >= (fromLocal.updatedAt ?? 0)
      ? fromIdb
      : fromLocal;
  }
  return fromIdb ?? fromLocal ?? null;
}

export function savePersistedWorkspaceSyncBackup(
  scopeKey: string,
  snapshot: PersistedWorkspaceSnapshot
): void {
  const key = `workspace_${scopeKey}`;
  writeLocalBackup(key, snapshot);
}

export async function savePersistedWorkspace(
  scopeKey: string,
  snapshot: PersistedWorkspaceSnapshot
): Promise<void> {
  const key = `workspace_${scopeKey}`;
  writeLocalBackup(key, snapshot);
  await idbPut(key, snapshot);
}

export async function loadCachedAdminConfig(): Promise<AdminConfig | null> {
  const key = 'admin_config_v1';
  const fromIdb = await idbGet<AdminConfig>(key);
  return fromIdb ?? readLocalBackup<AdminConfig>(key);
}

export async function saveCachedAdminConfig(config: AdminConfig): Promise<void> {
  const key = 'admin_config_v1';
  writeLocalBackup(key, config);
  await idbPut(key, config);
}
