+++
title = "Layers"
description = "The bitcoin layers Cassis routes across, and how each one expresses an HTLC."
weight = 3
+++

## Overview

| Layer        | Kind                | Lock primitive                  | Typical role in a route     |
|--------------|---------------------|---------------------------------|-----------------------------|
| Lightning    | Payment channels    | BOLT-2 HTLC                     | Source, destination, router |
| Liquid       | Federated sidechain | Script HTLC (`SHA256` + `CSV`)  | Router, high-value hop      |
| Arkade       | Shared-UTXO rollup  | VTXO hash lock + relative lock  | Source, destination         |
| Cashu        | Ecash mints         | Mint HTLC offer                 | Source, destination, router |
| Fedimint     | Federation ecash    | Federation HTLC module          | Source, destination         |
| Rootstock    | EVM sidechain       | Solidity HTLC contract          | Source, destination         |

A route may combine any of the above in any order, as long as each hop can
carry the same hash `H` and honor decreasing timeouts.

## Lightning

Lightning already speaks fluent HTLC: `update_add_htlc` carries `payment_hash`
and `cltv_expiry`. Cassis rides BOLT-11/BOLT-12 invoices whose payment hash is
the route-wide `H`, so a Cassis hop into or out of Lightning looks like a
perfectly ordinary payment to the network.

## Liquid

Liquid scripts support `OP_SHA256` and relative timelocks via `OP_CHECKSEQUENCEVERIFY`,
which is everything an HTLC needs. A Cassis swap node on Liquid holds a taproot
output locked as:

```text
  tr(<swap node key>, {
    hash160? ... # variant with OP_SHA256 H
    pk(<receiver key>) && sha256(H)   # claim: preimage of H
    pk(<swap node key>) && csv(96)    # refund after 96 blocks
  })
```

Liquid's one-minute blocks make its timeouts short and predictable.

## Arkade

Arkade VTXOs carry script commitments evaluated at exit time. A Cassis hop locks
a VTXO to `sha256(H)` with a relative lock for the claim branch and an
absolute/relative lock for the refund branch, matching the Arkade round cadence.
Arkade wallets expose this as a standard send-with-hashlock operation.

## Cashu

Cashu mints accept **HTLC offers**: a melt/swap request locked to `H` that
pays out ecash only against the preimage. The mint is not trusted with custody
beyond its normal ecash role &mdash; it cannot claim funds without `R`.

## Fedimint

The federation's LN gateway / HTLC module holds incoming ecash against `H`
until the preimage arrives or the timeout passes, then either pays out the
recipient or returns funds to the upstream hop. Federation consensus, not a
single operator, enforces the contract.

## Rootstock

On Rootstock a minimal Solidity HTLC contract does the job:

```solidity
contract CassisHTLC {
    bytes32 public immutable h;
    uint256 public immutable timeout;
    address payable public immutable sender;
    address payable public immutable receiver;

    function claim(bytes32 r) external {
        require(sha256(abi.encodePacked(r)) == h && block.number < timeout);
        selfdestruct(receiver);
    }

    function refund() external {
        require(block.number >= timeout);
        selfdestruct(sender);
    }
}
```

`sha256` is available as a precompile, so `H` matches every other layer
byte-for-byte.
