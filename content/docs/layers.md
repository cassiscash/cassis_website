+++
title = "Layers"
description = "The bitcoin layers Cassis routes across, and how each one expresses an HTLC."
weight = 4
+++

## Overview

A Cassis payment is a route with any number of hops, each of which is an HTLC,
all bound to the same hash `H` and honoring strictly decreasing timeouts.
Each network expresses that HTLC in its own idiom, the preimage `R` (with
`H = sha256(R)`) is the only key that settles a hop, and a timeout always
opens a refund path.

For each layer below:

- **HTLC descriptor** is what describes a locked HTLC on the wire: the
  sender returns it in reply to `EXECUTE`, and the receiver checks it
  against the ledger before going on. Every descriptor also carries the
  **target** it pays: the claim key (or hold invoice) that can settle it on
  that network.
- **Default incoming delta** is how long a router needs, after learning the
  preimage at the last possible moment (when its outgoing HTLC expires), to
  get the claim of its incoming HTLC through on that network before the
  HTLC can be refunded.
- **Outgoing lag** is how long after its expiry an HTLC sent on that network
  can still be claimed, because the refund path opens by the network's own
  clock and can lag behind wall time. A router adds this lag to the default
  incoming delta it announces, so each hop's gap depends on both the network
  it receives on and the one it sends on (see
  [how it works](@/docs/how-it-works.md#timeouts)).
- **Typical cost** is what the lock and the claim pay in network or operator
  fees, in sats, for an ordinary payment. It leaves out the amount locked,
  Cassis router fees, and one-off on-chain costs such as opening a
  Lightning channel or boarding a Fedimint; fixed fees dominate small
  payments and percentage fees scale with the amount (see
  [cost assumptions](#cost-assumptions)).

## <span style="color:#eab308">●</span> Lightning

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://github.com/lightning/bolts">BOLT</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>lightning</code> (mainnet), <code>lightning::signet</code>, <code>lightning::mutinynet</code>, <code>lightning::regtest</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">native BOLT <code>update_add_htlc</code> with <code>payment_hash</code> and <code>cltv_expiry</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">BOLT11 hold invoice (<code>payment_request</code>), sent as the outgoing target the payer pays verbatim to preserve the payment secret</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">60 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Outgoing lag</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">60 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Typical cost</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">≈1–2 sats to lock, paid as the Lightning routing fee on the hold invoice (Cassis allows up to max(1 sat, 1%)); nothing to claim offchain. A force-close is a separate on-chain cost.</dd>
</dl>

The hold invoice must be settled before its CLTV runs out, and that is
counted in bitcoin blocks, which can come early.

## <span style="color:#5ab7ec">●</span> Liquid

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://liquid.net">Liquid</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>liquid</code> (mainnet), <code>liquid::testnet</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">P2WSH script, <code>OP_HASH160 &lt;RIPEMD160(payment_hash)&gt;</code> claim path with CLTV refund</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">lockup outpoint (<code>lockup_txid</code> + <code>lockup_vout</code>) pinning the broadcast lockup tx, <code>refund_pubkey</code>, <code>refund_locktime</code>, and the compressed-secp256k1 <code>target</code>; the claim side is rebuilt from the route hash</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">10 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Outgoing lag</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">10 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Typical cost</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">≈27 sats to lock at Cassis's 0.1 sat/vB (the relay floor), and ≈40 sats to claim. The sender pays the lock; the claim fee comes out of the HTLC.</dd>
</dl>

Liquid has regular one-minute blocks; the claim must confirm before the
refund path opens.

## <span style="color:#a855f7">●</span> Arkade

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://arkadeos.com/">Arkade</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>arkade</code> (arkade.computer, mainnet), <code>arkade::mutinynet</code> (the public mutinynet operator), <code>arkade::&lt;operator host&gt;</code> (each operator is a separate network)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>VhtlcScript</code> taproot tree, <code>RIPEMD160(payment_hash)</code>, seconds-based timelocks</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">VHTLC options — <code>sender</code> x-only key, <code>refund_locktime</code>, three unilateral CSV delays (<code>unilateral_claim_delay</code>, <code>unilateral_refund_delay</code>, <code>unilateral_refund_without_receiver_delay</code>), and the x-only <code>target</code> (the receiver). The operator is the network's server, and <code>payment_hash160</code> follows from the route hash</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">20 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Outgoing lag</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">60 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Typical cost</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">No on-chain fee. The mainnet operator charges 0.2% of each offchain input more than ~29 days from batch expiry (0 when it is nearer), and nothing on offchain outputs, so a lock and claim usually cost about 0.4% of the coins spent between them.</dd>
</dl>

**Fees.** The mainnet operator charges no transaction fee and nothing on
offchain outputs. Its only per-transfer charge is 0.2% of the value of each
offchain input whose batch expires more than 29 days away
(`2,505,216` seconds); inputs closer to expiry cost nothing to spend. An
HTLC therefore normally costs 0.2% to lock and 0.2% to claim, but nothing
at all when its coins are near the end of their batch. The charge is on
the input's value, not the payment: a small HTLC funded from a large VTXO
pays 0.2% of the whole coin, so split coins before locking small amounts.
An onchain exit output costs 200 sats. Every operator sets its own
schedule, published at `/v1/info`; check the one you use.

**Batch expiry.** Arkade VTXOs live in *batches*, and every VTXO expires
with the batch it descends from (VTXOs created offchain inherit their
inputs' expiry). After that the operator may sweep it, and it can no
longer be spent offchain: a VHTLC still running then could neither be
claimed nor refunded. So:

- An HTLC must be over at least **20 minutes before** the batch of its
  VHTLC expires. Receivers reject VHTLCs that are not.
- Before locking an HTLC, a sender moves coins that would expire too
  early into a new batch.
- A router caps how long an incoming HTLC may run with `max_htlc_secs` in
  its config (three days by default) and refuses longer ones.
- Wallet coins older than a batch read as 0 until
  `cassis-wallet arkade --network <id> onboard` settles them into a new one.

**Dust.** Operators refuse outputs below their dust limit (330 sats by
default), including change: a payment smaller than that, or one that
would leave less change than that, is refused before anything is
locked.

## <span style="color:#1d4ed8">●</span> Cashu

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://cashu.space">Cashu</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>cashu::&lt;host[:port]&gt;</code> (each mint is a separate network)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">NUT-14 spending conditions on a NUT-10 HTLC secret</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">NUT-14 locked ecash proofs, one base64-encoded NUT-00 <code>Proof</code> per element, plus the x-only <code>target</code> that can claim them</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">5 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Outgoing lag</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">1 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Typical cost</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">≈2 sats in total at 100 ppk, paid by the payer: about 1 sat for the lock swap and 1 sat more locked in to cover the claim. Mints with a 0 ppk input fee are free.</dd>
</dl>

Claims are a single request to the mint, timed by the mint's clock. Real
mints may charge input fees (e.g. 100 ppk) per proof: the payer locks a
little extra to cover the claim's fee, so the payee still nets the
invoiced amount.

## <span style="color:#ef4444">●</span> Fedimint

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://fedimint.org">Fedimint</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>fedimint::&lt;invite_code&gt;</code> (each fedimint is a separate network)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">LNv2 direct HTLC: an <code>OutgoingContract</code> funded between two clients of the federation, with no Lightning gateway involved</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">where the contract was funded (<code>funding_txid</code> + <code>funding_out_idx</code>), the contract itself as consensus JSON, and the x-only <code>target</code> that can claim it</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">40 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Outgoing lag</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">60 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Typical cost</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">A few sats per side. Consensus fees are 1 sat per input and output, so they grow with the number of e-cash notes touched, plus up to 0.1% per side if the federation sets the maximum relative fee.</dd>
</dl>

Contracts expire after a number of bitcoin blocks, which can come early
or late: refunds may only go through a few blocks after the time the
HTLC was planned to expire. Consensus fees are per input and output, so a
payment that touches several e-cash notes costs a few sats on each side.

## <span style="color:#22c55e">●</span> Rootstock

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://rootstock.io">Rootstock</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>rootstock</code> (mainnet), <code>rootstock::testnet</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><a href="https://explorer.rootstock.io/address/0x3612e393cA2fbB8874854B88fFCf04307a518239?tab=contract">EtherSwap v3</a> contract, <code>sha256</code> precompile matches <code>H</code> byte-for-byte</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>amount_wei</code>, <code>refund_address</code>, block-height <code>timelock</code>, and the compressed-secp256k1 <code>target</code> (the claim address)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">20 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Outgoing lag</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">60 min</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Typical cost</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">≈80 sats to lock and ≈140 sats to claim at ~0.03 gwei (about 26k and 46k gas); roughly double at 0.065 gwei and triple at 0.1 gwei. Paid in RBTC gas by the sender and the claimer.</dd>
</dl>

Rootstock has ~30 s blocks with some variance, and its timelocks are
block heights. Claiming is a contract call, so **the receiver needs a
little RBTC for gas**, the payee included: without it the claim fails
and the whole route stays locked until it expires. Both calls are paid in
RBTC, which is pegged 1:1 to BTC, so the gas figures above convert
directly to sats.

## Cost assumptions

The cost rows are network and operator fees only, in sats, checked on
23 November 2026; they are not quotes. They use Cassis's own settings
where it has them (0.1 sat/vB on Liquid, a max(1 sat, 1%) limit on
Lightning) and each network's live schedule otherwise. Fixed fees dominate
small payments; percentage fees scale with the amount, and mint and
operator fees can change without notice. Each hop pays the fees of the
network it locks on, so a route's total is the sum over its hops.

The figures come from Blockstream Esplora (Liquid), the Arkade mainnet
operator's published fee schedule, sampled Cashu mint keysets (0–100 ppk),
Fedimint's LNv2 consensus fee schedule, Rootstock's public RPC and
Blockscout gas statistics, and LND's routing defaults. Re-check them
before pricing a route.
