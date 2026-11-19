import { IndexedDBStorageAdapter } from './indexeddb-adapter';
import { CapacitorSQLiteStorageAdapter } from './sqlite-adapter';
import type { IStorageAdapter } from './storage-adapter';

export function isCapacitorNativeAndroid(): boolean {
  const win = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  };
  return Boolean(win.Capacitor?.isNativePlatform?.() && win.Capacitor?.getPlatform?.() === 'android');
}

export async function createStorageAdapter(): Promise<IStorageAdapter> {
  const adapter: IStorageAdapter = isCapacitorNativeAndroid()
    ? new CapacitorSQLiteStorageAdapter()
    : new IndexedDBStorageAdapter();
  await adapter.init();
  return adapter;
}

export * from './storage-adapter';
