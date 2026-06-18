module marina_capsule::capsule;

use std::string::String;
use sui::clock::Clock;

public struct Capsule has key, store {
    id: UID,
    blob_id: String,
    nonce: vector<u8>,
    unlock_date: u64,
    owner: address,
    recipient: address,
    created_at: u64,
}

public fun create_capsule(
    blob_id: String,
    nonce: vector<u8>,
    unlock_date: u64,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let capsule = Capsule {
        id: object::new(ctx),
        blob_id,
        nonce,
        unlock_date,
        owner: ctx.sender(),
        recipient,
        created_at: clock.timestamp_ms(),
    };
    transfer::transfer(capsule, recipient);
}

public fun get_nonce(capsule: &Capsule): &vector<u8> { &capsule.nonce }
public fun get_blob_id(capsule: &Capsule): &String { &capsule.blob_id }
public fun get_unlock_date(capsule: &Capsule): u64 { capsule.unlock_date }
public fun get_owner(capsule: &Capsule): address { capsule.owner }
public fun get_recipient(capsule: &Capsule): address { capsule.recipient }
