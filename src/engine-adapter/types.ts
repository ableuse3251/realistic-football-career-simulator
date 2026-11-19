import type { WasmHandshakePayload } from '../workers/protocol';

export type EngineRuntimeMode = 'wasm-worker' | 'preview-fixture';

export type CareerMode = 'manager' | 'head_coach' | 'pro_player';

export interface PlatformCapabilities {
  webAssemblySupported: boolean;
  webWorkerSupported: boolean;
  indexedDbSupported: boolean;
  sharedArrayBufferAvailable: boolean;
  deviceMemoryGb: number | null;
}

export interface EngineHandshakeInfo extends WasmHandshakePayload {
  mode: EngineRuntimeMode;
  fallbackReason?: string;
}

export interface PreviewClubFixture {
  id: number;
  name: string;
  league: string;
  reputation: number;
  budgetEurMillions: number;
  squadSize: number;
}

export interface ISimEngine {
  readonly mode: EngineRuntimeMode;
  initialize(): Promise<EngineHandshakeInfo>;
  pingDeterministicRng(seedLo: number, seedHi: number): Promise<number | null>;
  testTransferableRoundtrip(byteLength: number): Promise<{ transferredBytes: number; durationMs: number }>;
  getPreviewClubs(): PreviewClubFixture[];
  dispose(): void;
}
