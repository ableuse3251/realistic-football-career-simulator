export type WorkerRequest =
  | { type: 'INIT_WASM'; requestId: number; wasmModuleUrl?: string }
  | { type: 'PING_RNG'; requestId: number; seedLo: number; seedHi: number }
  | { type: 'TRANSFER_ROUNDTRIP'; requestId: number; buffer: ArrayBuffer };

export type WorkerRequestPayload =
  | { type: 'INIT_WASM'; wasmModuleUrl?: string }
  | { type: 'PING_RNG'; seedLo: number; seedHi: number }
  | { type: 'TRANSFER_ROUNDTRIP'; buffer: ArrayBuffer };

export interface WasmHandshakePayload {
  abiVersion: number;
  schemaVersion: number;
  tickHz: number;
  ballPhysicsHz: number;
  tickFrameBytes: number;
  matchEventBytes: number;
  inputBufferCapacity: number;
}

export type WorkerResponse =
  | {
      type: 'INIT_WASM_RESULT';
      requestId: number;
      ok: true;
      handshake: WasmHandshakePayload;
    }
  | {
      type: 'INIT_WASM_RESULT';
      requestId: number;
      ok: false;
      reason: 'WASM_UNAVAILABLE' | 'ABI_MISMATCH' | 'INIT_ERROR';
      message: string;
    }
  | {
      type: 'PING_RNG_RESULT';
      requestId: number;
      value: number;
    }
  | {
      type: 'TRANSFER_ROUNDTRIP_RESULT';
      requestId: number;
      byteLength: number;
      buffer: ArrayBuffer;
    };
