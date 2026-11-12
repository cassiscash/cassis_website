+++
title = "Privacy"
description = "How peer-to-peer communication over Iroh affects network privacy, from default connections to relays, Tor and Nym."
weight = 7
+++

All peer-to-peer communication in Cassis &mdash; between payers, routing nodes and receivers &mdash; happens over [Iroh](https://iroh.computer). Because peers are addressed by their cryptographic public key rather than by an IP address or domain name, neither routers (in their Nostr announcements) nor receivers (in their invoices) ever have to advertise their IP addresses.

## Direct connections by default

Although peers do not advertise their IPs publicly, **Iroh connections by default will try to connect directly to each other**. After an initial handshake coordinated through an Iroh relay, the two endpoints attempt NAT hole-punching to establish a direct peer-to-peer link. When a direct connection succeeds, the two peers communicating on that leg learn each other's IP addresses.

## Relay-only mode

This default behavior can be changed. A peer can opt to **always use an Iroh relay** and refuse direct connections altogether.

When configured in relay-only mode:

- All encrypted traffic between the peer and its counterparties flows through the relay.
- Counterparties only ever see the relay's address.
- The peer's IP address is **only known by that relay** and is never revealed to payers, routers or receivers.

## Default vs. self-hosted relays

By default, peers use the public Iroh relays operated by [number 0](https://iroh.computer). However, users and router operators can **run their own Iroh relays** if they prefer that privacy and trust model, or if they want extra reliability and dedicated infrastructure for their nodes.

Note that running your own personal relay solely for yourself can still reveal the *relay's* IP address to counterparties, so depending on your setup you may want to share a community relay or combine relays with an anonymizing transport.

## Tor and Nym support

For stronger network-level privacy &mdash; where neither counterparties nor relays learn your IP address &mdash; Iroh has built-in support for **Tor** and the **Nym** mixnet as alternative transports:

- **[Tor transport on Iroh](https://docs.iroh.computer/transports/tor)** &mdash; routes Iroh connections through the Tor network.
- **[Nym transport on Iroh](https://docs.iroh.computer/transports/nym)** &mdash; routes Iroh connections through the Nym mixnet for metadata and traffic-analysis resistance.
