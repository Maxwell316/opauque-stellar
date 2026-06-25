# Nullifier Storage Compaction Strategy

> **Status:** Design proposal  
> **Date:** 2026-06-25  
> **Author:** DeborahOlaboye

## Problem Statement

Nullifiers in `ReputationVerifier` are stored as individual `NullifierEntry { used: bool }` values in Soroban persistent storage, keyed by the 32-byte nullifier hash. This means:

- Each spent nullifier costs 32 bytes (key) + ~1 byte (value) + storage overhead.
- Storage grows **linearly and unboundedly** with each `verify_reputation` call.
- Soroban's persistent storage has cost implications: the contract pays rent for each entry.
- Long-term, this creates an ever-increasing storage cost burden that the contract admin must subsidize.

## Current Storage Model

```rust
fn nullifier_key(n: &BytesN<32>) -> (Symbol, BytesN<32>) {
    (Symbol::new(&n.env(), "nullifier"), n.clone())
}
// Stored as: NullifierEntry { used: bool }
```

- Each nullifier is stored as an individual persistent entry.
- No batch operations or expiry mechanisms exist.
- The `are_nullifiers_spent` read function queries each key individually (batched up to 128 per call).
- Soroban persistent entries are subject to rent; the admin must extend TTL on the contract's behalf.

## Approach A: Merkle Accumulator (Compact Sparse Merkle Tree)

### Concept
Replace individual nullifier entries with a **sparse Merkle tree (SMT)** of fixed depth (e.g., 256). Each nullifier bit is represented as a leaf in the tree. A nullifier is "spent" when its leaf is set to 1.

### Advantages
- **Constant storage per root**: Only the root hash and a few sibling paths need to be stored.
- **Batch verification**: A single Merkle proof can verify inclusion of many nullifiers.
- **Bounded growth**: Storage grows logarithmically with the number of spent nullifiers, not linearly.

### Disadvantages
- **Proof overhead**: Callers must supply Merkle inclusion proofs when calling `verify_reputation` (or the contract must compute them, which costs CPU).
- **Sibling path storage**: Up to 256 sibling hashes per updated leaf must be stored temporarily.
- **Circuit changes**: If the ZK circuit references the nullifier set, the circuit would need to be updated to accept Merkle proofs.
- **Implementation complexity**: Requires auditing a sparse Merkle tree implementation in Soroban (no built-in SMT support).

### Storage Impact

| Metric | Current | SMT (est.) |
|--------|---------|------------|
| Per-nullifier cost | ~72 bytes (key + val + overhead) | ~0 bytes (leaf is a bit in a tree) |
| Per-update cost | 1 write | ~log₂(N) writes for sibling path |
| Read cost | 1 read | 1 read (root) + proof verification |
| Total at 1M nullifiers | ~72 MB | ~2 KB (tree root + few nodes) |

### Feasibility on Soroban
Soroban does not provide a built-in Merkle tree host function. An SMT would need to be implemented in contract code, which adds to contract size and CPU budget. The `alt_bn128` host functions cannot directly help here (they are for BN254 pairings, not generic hashing). Poseidon hash would be the natural choice for ZK compatibility but would need to be implemented in WASM or via host `sha256` with field arithmetic.

**Verdict:** Technically feasible but high complexity. Requires a new audited code module. Best suited for a future version after the protocol has stabilized.

## Approach B: Periodic Snapshot with Archival

### Concept
Maintain the current per-nullifier storage but add a **periodic compaction mechanism**:

1. The admin defines an **epoch length** (e.g., every 100,000 ledgers).
2. At epoch boundaries, a snapshot of the nullifier set is taken and stored as a **Bloom filter** or **bitset**.
3. Nullifiers older than N epochs are considered "archived" — their individual entries can be pruned.
4. Verification checks the live set first, then falls back to the archived snapshot.

### Advantages
- **Incremental change**: No ZK circuit changes required.
- **Lower implementation risk**: Bloom filters/bitsets are well-understood.
- **Configurable**: Epoch length and retention policy can be tuned.
- **Backward compatible**: Existing nullifiers remain valid during migration.

### Disadvantages
- **Bloom filter false positives**: Small probability of false "spent" results (acceptable if the contract re-checking is done conservatively).
- **Admin overhead**: Requires periodic admin operations to trigger snapshots.
- **Read complexity**: Must check both live storage and archived snapshots.
- **Still bounded growth**: Only the current epoch's nullifiers are stored individually.

### Storage Impact

| Metric | Current | Snapshot (est.) |
|--------|---------|-----------------|
| Per-nullifier cost | ~72 bytes | ~72 bytes (current epoch only) |
| Archived storage | N/A | 1 Bloom filter per epoch (~64 KB for 1M nullifiers at 1% FP rate) |
| Total at 1M nullifiers | ~72 MB | ~1 MB (live epoch) + ~64 KB (archived) |
| Pruning cadence | Never | Every epoch (configurable) |

### Feasibility on Soroban
Bloom filters can be implemented entirely in contract code with SHA-256 host hashing. The snapshot archive can live in persistent storage or be stored off-chain with on-chain commitments. This approach requires no new host function support.

**Verdict:** Feasible for near-term (v1.1) deployment. Moderate implementation effort.

## Approach C: Epoch-Based Nullifier Domains

### Concept
Instead of compacting the nullifier set, **avoid unbounded growth** by partitioning nullifiers into domains:

1. Each `external_nullifier` value defines a separate **nullifier domain**.
2. Each domain has a configurable **max nullifier count** and **expiry ledger**.
3. When a domain expires or reaches its cap, no new nullifiers can be spent in that domain.
4. Old domains can be pruned entirely after a grace period.

### Advantages
- **Deterministic bounds**: Each domain has a hard cap on the number of nullifiers.
- **Simple pruning**: Entire domains are deleted at once (batch storage removal).
- **No ZK circuit changes**: The circuit already uses `external_nullifier`.

### Disadvantages
- **Application-level coordination**: Apps must choose appropriate domain sizes.
- **Protocol change**: The contract must track per-domain metadata and enforce caps.
- **Replay risk**: If a domain is pruned and re-created, old nullifiers could be replayed (mitigated by domain nonce/version).
- **Deletion cost**: Soroban does not refund storage rent on deletion, so past rent is sunk cost.

### Storage Impact

| Metric | Current | Domains (est.) |
|--------|---------|----------------|
| Per-nullifier cost | ~72 bytes | ~72 bytes (within domain cap) |
| Domain metadata | 0 | ~64 bytes per domain |
| Total at 1M nullifiers | ~72 MB | Configurable (e.g., 10 domains × 100K = ~7.2 MB) |

## Recommendation

**Phase 1 (v1.1) — Bloom Filter Snapshot (Approach B)**

Implement periodic snapshot compaction using on-chain Bloom filters. This is the lowest-risk path:

- Requires no circuit changes.
- Existing nullifier storage model is unchanged.
- Admin triggers compaction.
- Bloom filter false positives are acceptable with proper parameter tuning (1% FP rate = ~10 bits per entry).

**Phase 2 (v2.0) — Sparse Merkle Tree (Approach A)**

If ZK protocol evolution warrants on-chain nullifier set proofs, implement the SMT approach. This:

- Requires a new audited contract module.
- Changes the ZK circuit to accept Merkle proofs.
- Eliminates per-nullifier storage entirely.

**Not recommended:** Approach C (Epoch Domains) because it shifts complexity to application developers and introduces UX friction with domain caps.

## Migration Impact

### On Existing Nullifiers (Phase 1)
- Existing nullifiers remain in persistent storage.
- The compaction contract function iterates over existing nullifiers and adds them to the Bloom filter snapshot.
- After migration, the admin can optionally prune old entries (TTL expiry by not extending).
- No nullifier data is lost during migration.

### On Existing Nullifiers (Phase 2)
- A migration script would need to build an SMT from the existing nullifier set.
- Admin must publish the new SMT root on-chain.
- Old contract remains operational alongside the new one during a cooldown period.
- Circuit proving keys must be regenerated for any circuit that references the new SMT structure.

### Rollback
- Phase 1: Trivially reversible — stop triggering snapshots, individual nullifiers remain.
- Phase 2: Requires keeping the old contract deployed; users can verify against either.

## Timeline & Risks

| Phase | Effort | Timeline | Key Risks |
|-------|--------|----------|-----------|
| Phase 1 (Snapshot) | ~2 weeks | v1.1 | Bloom filter false positive rate tuning; rent economics of archived entries |
| Phase 2 (SMT) | ~8 weeks | v2.0 | SMT implementation audit; circuit proving key generation; backward compatibility |

## Open Questions

1. **Rent economics**: What is the cost of maintaining 1M nullifier entries at current Soroban rent rates? Is compaction financially necessary before v1 launch?
2. **Admin operations**: Should snapshot compaction be automated (keeper network) or manual (admin-triggered)?
3. **Circuit coupling**: If the ZK circuit is updated to reference the SMT, how do we handle the transition period where both old and new proofs are valid?
