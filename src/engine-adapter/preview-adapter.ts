import type { EngineHandshakeInfo, ISimEngine, PreviewClubFixture } from './types';

/**
 * Isolated Preview Adapter used ONLY when the compiled Rust/WASM bundle
 * (`src/wasm-pkg/sim_wasm.js`) is not yet present in the local preview environment.
 * Contains strictly static fixtures and ZERO simulation math.
 */
const STATIC_PREVIEW_CLUBS: PreviewClubFixture[] = [
  {
    id: 1,
    name: 'FC Nordhafen',
    league: 'Central Premier Division',
    reputation: 7850,
    budgetEurMillions: 42.5,
    squadSize: 28,
  },
  {
    id: 2,
    name: 'Atletico Valterra',
    league: 'Iberian Liga Primera',
    reputation: 8420,
    budgetEurMillions: 68.0,
    squadSize: 27,
  },
  {
    id: 3,
    name: 'Sporting Rivena',
    league: 'Alpine Super League',
    reputation: 6410,
    budgetEurMillions: 14.2,
    squadSize: 26,
  },
];

export class PreviewAdapter implements ISimEngine {
  public readonly mode = 'preview-fixture' as const;
  private readonly fallbackReason: string;

  constructor(fallbackReason: string) {
    this.fallbackReason = fallbackReason;
  }

  public async initialize(): Promise<EngineHandshakeInfo> {
    return {
      mode: 'preview-fixture',
      abiVersion: 1,
      schemaVersion: 1,
      tickHz: 4,
      ballPhysicsHz: 60,
      tickFrameBytes: 312,
      matchEventBytes: 16,
      inputBufferCapacity: 0,
      fallbackReason: this.fallbackReason,
    };
  }

  public async pingDeterministicRng(): Promise<number | null> {
    // No simulation math or PRNG emulation in TypeScript.
    return null;
  }

  public async testTransferableRoundtrip(
    byteLength: number
  ): Promise<{ transferredBytes: number; durationMs: number }> {
    const started = performance.now();
    const buf = new ArrayBuffer(byteLength);
    return {
      transferredBytes: buf.byteLength,
      durationMs: Math.max(0, performance.now() - started),
    };
  }

  public getPreviewClubs(): PreviewClubFixture[] {
    return STATIC_PREVIEW_CLUBS;
  }

  public dispose(): void {
    // Nothing to release in static preview adapter.
  }
}
