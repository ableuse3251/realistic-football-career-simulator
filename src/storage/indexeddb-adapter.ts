import {
  computeCrc32,
  type IStorageAdapter,
  type SaveSlotMetadata,
  type SaveSlotRecord,
} from './storage-adapter';

const DB_NAME = 'rfcs_saves_v1';
const DB_VERSION = 1;
const STORE_NAME = 'slots';

interface StoredRow {
  slotId: string;
  schemaVersion: number;
  byteLength: number;
  updatedAtIso: string;
  crc32: number;
  payload: ArrayBuffer;
}

export class IndexedDBStorageAdapter implements IStorageAdapter {
  public readonly backend = 'indexeddb' as const;
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is unavailable in this environment.');
    }

    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
    });
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('IndexedDBStorageAdapter must be initialized before use.');
    }
    return this.db;
  }

  public async writeSlot(
    slotId: string,
    schemaVersion: number,
    payload: Uint8Array
  ): Promise<SaveSlotMetadata> {
    const db = this.getDb();
    const crc32 = computeCrc32(payload);
    const updatedAtIso = new Date().toISOString();
    const copy = new ArrayBuffer(payload.byteLength);
    new Uint8Array(copy).set(payload);

    const row: StoredRow = {
      slotId,
      schemaVersion,
      byteLength: payload.byteLength,
      updatedAtIso,
      crc32,
      payload: copy,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
    });

    return {
      slotId,
      schemaVersion,
      byteLength: row.byteLength,
      updatedAtIso,
      crc32,
    };
  }

  public async readSlot(slotId: string): Promise<SaveSlotRecord | null> {
    const db = this.getDb();
    const row = await new Promise<StoredRow | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(slotId);
      req.onsuccess = () => resolve(req.result as StoredRow | undefined);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed.'));
    });

    if (!row) return null;
    const bytes = new Uint8Array(row.payload);
    const actualCrc = computeCrc32(bytes);
    if (actualCrc !== row.crc32) {
      throw new Error(`Save slot "${slotId}" failed CRC32 integrity check.`);
    }

    return {
      slotId: row.slotId,
      schemaVersion: row.schemaVersion,
      byteLength: row.byteLength,
      updatedAtIso: row.updatedAtIso,
      crc32: row.crc32,
      payload: bytes,
    };
  }

  public async listSlots(): Promise<SaveSlotMetadata[]> {
    const db = this.getDb();
    const rows = await new Promise<StoredRow[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredRow[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB list failed.'));
    });

    return rows.map(({ slotId, schemaVersion, byteLength, updatedAtIso, crc32 }) => ({
      slotId,
      schemaVersion,
      byteLength,
      updatedAtIso,
      crc32,
    }));
  }

  public async deleteSlot(slotId: string): Promise<void> {
    const db = this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(slotId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed.'));
    });
  }
}
