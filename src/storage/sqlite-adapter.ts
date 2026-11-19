import type { IStorageAdapter, SaveSlotMetadata, SaveSlotRecord } from './storage-adapter';

/**
 * Main-Thread Capacitor SQLite bridge skeleton for Android WebView.
 * Full SQLite plugin bindings (`@capacitor-community/sqlite`) will be wired in Stage 9.
 * Never invoked from Web Worker directly — always routed through Main Thread EngineBridge.
 */
export class CapacitorSQLiteStorageAdapter implements IStorageAdapter {
  public readonly backend = 'capacitor-sqlite' as const;

  public async init(): Promise<void> {
    throw new Error(
      'Capacitor SQLite plugin is not attached in web preview. Native bindings are scheduled for Stage 9.'
    );
  }

  public async writeSlot(): Promise<SaveSlotMetadata> {
    throw new Error('Capacitor SQLite adapter is unavailable in web preview.');
  }

  public async readSlot(): Promise<SaveSlotRecord | null> {
    throw new Error('Capacitor SQLite adapter is unavailable in web preview.');
  }

  public async listSlots(): Promise<SaveSlotMetadata[]> {
    return [];
  }

  public async deleteSlot(): Promise<void> {
    throw new Error('Capacitor SQLite adapter is unavailable in web preview.');
  }
}
