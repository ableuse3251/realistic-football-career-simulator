import type { WorkerRequest, WorkerRequestPayload, WorkerResponse } from '../workers/protocol';
import type { EngineHandshakeInfo, ISimEngine, PreviewClubFixture } from './types';

interface PendingRequest {
  resolve: (value: WorkerResponse) => void;
  reject: (reason?: unknown) => void;
}

export class WasmWorkerAdapter implements ISimEngine {
  public readonly mode = 'wasm-worker' as const;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const res = event.data;
        const entry = this.pending.get(res.requestId);
        if (entry) {
          this.pending.delete(res.requestId);
          entry.resolve(res);
        }
      };
      this.worker.onerror = (error) => {
        for (const [, entry] of this.pending) {
          entry.reject(error);
        }
        this.pending.clear();
      };
    }
    return this.worker;
  }

  private send<T extends WorkerResponse>(
    request: WorkerRequestPayload,
    transfer: Transferable[] = []
  ): Promise<T> {
    const worker = this.ensureWorker();
    const requestId = this.nextRequestId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (res) => resolve(res as T),
        reject,
      });
      worker.postMessage({ ...request, requestId } as WorkerRequest, transfer);
    });
  }

  public async initialize(): Promise<EngineHandshakeInfo> {
    const res = await this.send<Extract<WorkerResponse, { type: 'INIT_WASM_RESULT' }>>({
      type: 'INIT_WASM',
    });

    if (!res.ok) {
      throw new Error(`[${res.reason}] ${res.message}`);
    }

    return {
      mode: 'wasm-worker',
      ...res.handshake,
    };
  }

  public async pingDeterministicRng(seedLo: number, seedHi: number): Promise<number> {
    const res = await this.send<Extract<WorkerResponse, { type: 'PING_RNG_RESULT' }>>({
      type: 'PING_RNG',
      seedLo,
      seedHi,
    });
    return res.value;
  }

  public async testTransferableRoundtrip(
    byteLength: number
  ): Promise<{ transferredBytes: number; durationMs: number }> {
    const buffer = new ArrayBuffer(byteLength);
    const started = performance.now();
    const res = await this.send<Extract<WorkerResponse, { type: 'TRANSFER_ROUNDTRIP_RESULT' }>>(
      {
        type: 'TRANSFER_ROUNDTRIP',
        buffer,
      },
      [buffer]
    );
    const durationMs = Math.max(0, performance.now() - started);
    return {
      transferredBytes: res.byteLength,
      durationMs,
    };
  }

  public getPreviewClubs(): PreviewClubFixture[] {
    // Stage 3 will replace fixture data with live queries to WorldState.
    return [];
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
  }
}
