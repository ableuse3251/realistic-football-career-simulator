import type { WasmHandshakePayload, WorkerRequest, WorkerResponse } from './protocol';

const EXPECTED_ABI_VERSION = 1;

interface SimWasmExports {
  default: () => Promise<unknown>;
  init_runtime: () => number;
  SimEngineHandle: new () => {
    abi_version: () => number;
    schema_version: () => number;
    tick_hz: () => number;
    ball_physics_hz: () => number;
    tick_frame_bytes: () => number;
    match_event_bytes: () => number;
    ping_deterministic_rng: (seedLo: number, seedHi: number) => number;
    input_buffer_capacity: () => number;
  };
}

let engineHandle: InstanceType<SimWasmExports['SimEngineHandle']> | null = null;

interface WorkerGlobalLike {
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void | Promise<void>) | null;
}

const workerScope = self as unknown as WorkerGlobalLike;

function post(response: WorkerResponse, transfer: Transferable[] = []): void {
  workerScope.postMessage(response, transfer);
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'INIT_WASM') {
    const moduleUrl = msg.wasmModuleUrl ?? '/src/wasm-pkg/sim_wasm.js';
    try {
      const wasmMod = (await import(/* @vite-ignore */ moduleUrl)) as SimWasmExports;
      await wasmMod.default();
      const abiVersion = wasmMod.init_runtime();
      if (abiVersion !== EXPECTED_ABI_VERSION) {
        post({
          type: 'INIT_WASM_RESULT',
          requestId: msg.requestId,
          ok: false,
          reason: 'ABI_MISMATCH',
          message: `Expected ABI v${EXPECTED_ABI_VERSION}, got v${abiVersion}`,
        });
        return;
      }

      engineHandle = new wasmMod.SimEngineHandle();
      const handshake: WasmHandshakePayload = {
        abiVersion: engineHandle.abi_version(),
        schemaVersion: engineHandle.schema_version(),
        tickHz: engineHandle.tick_hz(),
        ballPhysicsHz: engineHandle.ball_physics_hz(),
        tickFrameBytes: engineHandle.tick_frame_bytes(),
        matchEventBytes: engineHandle.match_event_bytes(),
        inputBufferCapacity: engineHandle.input_buffer_capacity(),
      };

      post({
        type: 'INIT_WASM_RESULT',
        requestId: msg.requestId,
        ok: true,
        handshake,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      post({
        type: 'INIT_WASM_RESULT',
        requestId: msg.requestId,
        ok: false,
        reason: 'WASM_UNAVAILABLE',
        message,
      });
    }
    return;
  }

  if (msg.type === 'PING_RNG') {
    if (!engineHandle) {
      post({
        type: 'PING_RNG_RESULT',
        requestId: msg.requestId,
        value: 0,
      });
      return;
    }
    const value = engineHandle.ping_deterministic_rng(msg.seedLo >>> 0, msg.seedHi >>> 0);
    post({
      type: 'PING_RNG_RESULT',
      requestId: msg.requestId,
      value,
    });
    return;
  }

  if (msg.type === 'TRANSFER_ROUNDTRIP') {
    // Demonstrates zero-copy Transferable ArrayBuffer ownership ping-pong without SharedArrayBuffer.
    const byteLength = msg.buffer.byteLength;
    post(
      {
        type: 'TRANSFER_ROUNDTRIP_RESULT',
        requestId: msg.requestId,
        byteLength,
        buffer: msg.buffer,
      },
      [msg.buffer]
    );
  }
};
