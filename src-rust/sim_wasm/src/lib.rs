use sim_core::core::rng::WorldRngStreams;
use sim_core::core::{EngineHandshake, ABI_VERSION};
use wasm_bindgen::prelude::*;

/// Returns the binary ABI version for early compatibility checks in the Web Worker.
#[wasm_bindgen]
pub fn init_runtime() -> u32 {
    ABI_VERSION
}

/// Stateful WASM engine facade owned by the Web Worker.
#[wasm_bindgen]
pub struct SimEngineHandle {
    handshake: EngineHandshake,
    io_scratch_buf: Vec<u8>,
}

#[wasm_bindgen]
impl SimEngineHandle {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            handshake: EngineHandshake::current(),
            io_scratch_buf: Vec::with_capacity(16 * 1024),
        }
    }

    pub fn abi_version(&self) -> u32 {
        self.handshake.abi_version
    }

    pub fn schema_version(&self) -> u32 {
        self.handshake.schema_version
    }

    pub fn tick_hz(&self) -> u16 {
        self.handshake.tick_hz
    }

    pub fn ball_physics_hz(&self) -> u16 {
        self.handshake.ball_physics_hz
    }

    pub fn tick_frame_bytes(&self) -> u32 {
        self.handshake.tick_frame_bytes
    }

    pub fn match_event_bytes(&self) -> u32 {
        self.handshake.match_event_bytes
    }

    /// Deterministic PRNG probe used by the Stage 2 handshake check.
    pub fn ping_deterministic_rng(&self, seed_lo: u32, seed_hi: u32) -> u32 {
        let seed = (u64::from(seed_hi) << 32) | u64::from(seed_lo);
        let mut streams = WorldRngStreams::from_world_seed(seed);
        streams.daily_world.next_u32()
    }

    /// Reserves space in the reusable WASM scratch buffer and returns a raw pointer
    /// so the Worker can write binary payloads directly into linear memory.
    pub fn alloc_input_buffer(&mut self, byte_len: u32) -> *mut u8 {
        let target_len = byte_len as usize;
        if self.io_scratch_buf.len() < target_len {
            self.io_scratch_buf.resize(target_len, 0);
        }
        self.io_scratch_buf.as_mut_ptr()
    }

    pub fn input_buffer_capacity(&self) -> usize {
        self.io_scratch_buf.capacity()
    }
}

impl Default for SimEngineHandle {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wasm_handle_handshake_is_consistent() {
        let handle = SimEngineHandle::new();
        assert_eq!(init_runtime(), handle.abi_version());
        assert_eq!(handle.tick_hz(), 4);
        assert_eq!(handle.ball_physics_hz(), 60);
        assert_eq!(handle.tick_frame_bytes(), 312);
        assert_eq!(handle.match_event_bytes(), 16);
    }

    #[test]
    fn wasm_handle_rng_probe_is_deterministic() {
        let handle = SimEngineHandle::new();
        let a = handle.ping_deterministic_rng(12345, 67890);
        let b = handle.ping_deterministic_rng(12345, 67890);
        assert_eq!(a, b);
    }
}
