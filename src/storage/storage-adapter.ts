export type StorageBackendKind = 'indexeddb' | 'capacitor-sqlite';

export interface SaveSlotMetadata {
  slotId: string;
  schemaVersion: number;
  byteLength: number;
  updatedAtIso: string;
  crc32: number;
}

export interface SaveSlotRecord extends SaveSlotMetadata {
  payload: Uint8Array;
}

export interface IStorageAdapter {
  readonly backend: StorageBackendKind;
  init(): Promise<void>;
  writeSlot(slotId: string, schemaVersion: number, payload: Uint8Array): Promise<SaveSlotMetadata>;
  readSlot(slotId: string): Promise<SaveSlotRecord | null>;
  listSlots(): Promise<SaveSlotMetadata[]>;
  deleteSlot(slotId: string): Promise<void>;
}

/**
 * Standard IEEE CRC32 for verifying checkpoint payload integrity on save/load.
 */
export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
