pub mod ids;
pub mod rng;

/// Binary ABI version between `sim_wasm` and TypeScript `EngineBridge`.
pub const ABI_VERSION: u32 = 1;

/// Save/database schema version.
pub const SCHEMA_VERSION: u32 = 1;

/// Player decision / tactical simulation tick rate (0.25 s per tick).
pub const TICK_HZ: u16 = 4;

/// Ball physics substep frequency (60 Hz = 15 substeps per 0.25 s decision tick).
pub const BALL_PHYSICS_HZ: u16 = 60;
pub const BALL_SUBSTEPS_PER_TICK: u16 = BALL_PHYSICS_HZ / TICK_HZ;

/// Fixed binary layout sizes defined in Stage 1 architecture (Blocks B & C).
pub const TICK_FRAME_BYTES: u32 = 312;
pub const MATCH_EVENT_BYTES: u32 = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EngineHandshake {
    pub abi_version: u32,
    pub schema_version: u32,
    pub tick_hz: u16,
    pub ball_physics_hz: u16,
    pub tick_frame_bytes: u32,
    pub match_event_bytes: u32,
}

impl EngineHandshake {
    pub const fn current() -> Self {
        Self {
            abi_version: ABI_VERSION,
            schema_version: SCHEMA_VERSION,
            tick_hz: TICK_HZ,
            ball_physics_hz: BALL_PHYSICS_HZ,
            tick_frame_bytes: TICK_FRAME_BYTES,
            match_event_bytes: MATCH_EVENT_BYTES,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simulation_rates_match_spec() {
        let hs = EngineHandshake::current();
        assert_eq!(hs.tick_hz, 4);
        assert_eq!(hs.ball_physics_hz, 60);
        assert_eq!(BALL_SUBSTEPS_PER_TICK, 15);
        assert_eq!(hs.tick_frame_bytes, 312);
        assert_eq!(hs.match_event_bytes, 16);
    }
}
