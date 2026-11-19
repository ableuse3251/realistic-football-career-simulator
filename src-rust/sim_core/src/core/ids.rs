/// Sentinel value representing an absent handle in dense arrays (4 bytes instead of 8 for Option<u32>).
pub const NONE_U32: u32 = u32::MAX;

macro_rules! define_id_u32 {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
        #[repr(transparent)]
        pub struct $name(pub u32);

        impl $name {
            pub const NONE: Self = Self(NONE_U32);

            #[inline]
            pub const fn is_valid(self) -> bool {
                self.0 != NONE_U32
            }

            #[inline]
            pub const fn index(self) -> usize {
                self.0 as usize
            }
        }
    };
}

define_id_u32!(PersonId);
define_id_u32!(PlayerId);
define_id_u32!(ClubId);
define_id_u32!(StaffId);
define_id_u32!(CompId);
define_id_u32!(ContractId);
define_id_u32!(StringId);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
#[repr(transparent)]
pub struct NationId(pub u16);

impl NationId {
    pub const NONE: Self = Self(0);

    #[inline]
    pub const fn is_valid(self) -> bool {
        self.0 != 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::mem::size_of;

    #[test]
    fn handle_sizes_are_compact() {
        assert_eq!(size_of::<PersonId>(), 4);
        assert_eq!(size_of::<PlayerId>(), 4);
        assert_eq!(size_of::<ClubId>(), 4);
        assert_eq!(size_of::<StaffId>(), 4);
        assert_eq!(size_of::<CompId>(), 4);
        assert_eq!(size_of::<ContractId>(), 4);
        assert_eq!(size_of::<StringId>(), 4);
        assert_eq!(size_of::<NationId>(), 2);
    }

    #[test]
    fn sentinel_validity_works() {
        assert!(!PlayerId::NONE.is_valid());
        assert!(PlayerId(0).is_valid());
        assert!(!NationId::NONE.is_valid());
        assert!(NationId(42).is_valid());
    }
}
