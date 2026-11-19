import { PreviewAdapter } from './preview-adapter';
import type { EngineHandshakeInfo, ISimEngine, PlatformCapabilities } from './types';
import { WasmWorkerAdapter } from './wasm-worker-adapter';

export function detectPlatformCapabilities(): PlatformCapabilities {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    webAssemblySupported: typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function',
    webWorkerSupported: typeof Worker === 'function',
    indexedDbSupported: typeof indexedDB !== 'undefined',
    sharedArrayBufferAvailable: typeof SharedArrayBuffer !== 'undefined',
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
  };
}

export async function createSimEngine(): Promise<{
  engine: ISimEngine;
  handshake: EngineHandshakeInfo;
}> {
  const caps = detectPlatformCapabilities();

  if (caps.webAssemblySupported && caps.webWorkerSupported) {
    const wasmAdapter = new WasmWorkerAdapter();
    try {
      const handshake = await wasmAdapter.initialize();
      return { engine: wasmAdapter, handshake };
    } catch (error) {
      wasmAdapter.dispose();
      const reason = error instanceof Error ? error.message : String(error);
      const preview = new PreviewAdapter(reason);
      const handshake = await preview.initialize();
      return { engine: preview, handshake };
    }
  }

  const preview = new PreviewAdapter('WebAssembly or Web Worker API is unavailable in this environment.');
  const handshake = await preview.initialize();
  return { engine: preview, handshake };
}

export * from './types';
