/// Seal policy: time-lock + recipient check
/// key-id format: bcs(unlock_time) ++ bcs(recipient_address)
module marina_capsule::seal_policy;

use sui::bcs::{Self, BCS};
use sui::clock;

const ENoAccess: u64 = 77;

entry fun seal_approve(id: vector<u8>, c: &clock::Clock, ctx: &TxContext) {
    assert!(check_policy(id, c, ctx), ENoAccess);
}

fun check_policy(id: vector<u8>, c: &clock::Clock, ctx: &TxContext): bool {
    let mut prepared: BCS = bcs::new(id);
    let t = prepared.peel_u64();
    let recipient = prepared.peel_address();
    let leftovers = prepared.into_remainder_bytes();
    (leftovers.length() == 0)
        && (c.timestamp_ms() >= t)
        && (ctx.sender() == recipient)
}
