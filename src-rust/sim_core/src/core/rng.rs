/// SplitMix64 mixer used to derive independent subsystem seeds from a single master seed.
#[inline]
pub const fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x ^ (x >> 31)
}

/// Deterministic PCG32 (XSH-RR) generator with 16-byte state and explicit stream selector.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SimRng {
    state: u64,
    inc: u64,
}

impl SimRng {
    pub fn from_seed_and_stream(seed: u64, stream_id: u64) -> Self {
        let mut rng = Self {
            state: 0,
            inc: (stream_id << 1) | 1,
        };
        let _ = rng.next_u32();
        rng.state = rng.state.wrapping_add(splitmix64(seed));
        let _ = rng.next_u32();
        rng
    }

    #[inline]
    pub fn next_u32(&mut self) -> u32 {
        let old_state = self.state;
        self.state = old_state
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(self.inc);
        let xorshifted = (((old_state >> 18) ^ old_state) >> 27) as u32;
        let rot = (old_state >> 59) as u32;
        xorshifted.rotate_right(rot)
    }

    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        let hi = u64::from(self.next_u32()) << 32;
        let lo = u64::from(self.next_u32());
        hi | lo
    }

    /// Returns a uniform f32 in [0.0, 1.0).
    #[inline]
    pub fn next_f32(&mut self) -> f32 {
        let bits = self.next_u32() >> 8;
        (bits as f32) * (1.0 / 16_777_216.0)
    }
}

/// Independent PRNG streams for world subsystems so edits in one domain never break
/// reproducibility in other domains for the same world seed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorldRngStreams {
    pub daily_world: SimRng,
    pub transfers: SimRng,
    pub youth_intake: SimRng,
    pub injuries: SimRng,
    pub ai_lod_matches: SimRng,
}

impl WorldRngStreams {
    pub fn from_world_seed(world_seed: u64) -> Self {
        Self {
            daily_world: SimRng::from_seed_and_stream(world_seed, 1),
            transfers: SimRng::from_seed_and_stream(world_seed, 2),
            youth_intake: SimRng::from_seed_and_stream(world_seed, 3),
            injuries: SimRng::from_seed_and_stream(world_seed, 4),
            ai_lod_matches: SimRng::from_seed_and_stream(world_seed, 5),
        }
    }

    /// Derives an isolated match PRNG stream from the world seed and fixture ID.
    pub fn derive_match_rng(world_seed: u64, fixture_id: u32) -> SimRng {
        let mixed = splitmix64(world_seed ^ u64::from(fixture_id).wrapping_mul(0x9E37_79B9));
        SimRng::from_seed_and_stream(mixed, u64::from(fixture_id) + 100)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_produces_identical_sequences() {
        let mut a = WorldRngStreams::from_world_seed(0xCAFE_BABE_1234_5678);
        let mut b = WorldRngStreams::from_world_seed(0xCAFE_BABE_1234_5678);

        for _ in 0..1000 {
            assert_eq!(a.daily_world.next_u32(), b.daily_world.next_u32());
            assert_eq!(a.transfers.next_u32(), b.transfers.next_u32());
        }
    }

    #[test]
    fn subsystem_streams_are_isolated() {
        let mut a = WorldRngStreams::from_world_seed(42);
        let mut b = WorldRngStreams::from_world_seed(42);

        // Advance transfers heavily in `a` only.
        for _ in 0..500 {
            let _ = a.transfers.next_u32();
        }

        // `daily_world` and `injuries` must remain bit-identical.
        for _ in 0..100 {
            assert_eq!(a.daily_world.next_u32(), b.daily_world.next_u32());
            assert_eq!(a.injuries.next_u32(), b.injuries.next_u32());
        }
    }

    #[test]
    fn next_f32_stays_within_unit_interval() {
        let mut rng = WorldRngStreams::derive_match_rng(999, 17);
        for _ in 0..10_000 {
            let v = rng.next_f32();
            assert!((0.0..1.0).contains(&v));
        }
    }
}
