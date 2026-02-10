#![cfg_attr(not(feature = "std"), no_std)]
#[inline(never)]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut res = 0;
    for i in 0..a.len() { res |= a[i] ^ b[i]; }
    res == 0
}
