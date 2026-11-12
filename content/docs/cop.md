+++
title = "Cassis Order Protocol (COP)"
description = "A rich, wallet-native protocol for buying, subscribing, pricing in fiat, and ordering from menus without web technologies."
weight = 6
+++

> **Under active design.** Full specifications for the Cassis Order Protocol will be published here and at [cop.cassis.cash](https://cop.cassis.cash/).

The **Cassis Order Protocol (COP)** goes beyond static invoices to provide a completely new way to interact with merchants and services directly from a Bitcoin wallet.

With COP, a user can:

- **Buy items and place orders from a menu** with customizable options, quantities and shipping or delivery details.
- **Subscribe to recurring services** or memberships.
- **Calculate fiat prices** on the fly at the moment of payment while settling over Cassis across any supported Bitcoin layer.
- **Complete any structured commercial flow** without ever leaving their wallet.

## Wallet-native, no web stack required

Today, buying something with Bitcoin usually means navigating a website in a browser, fighting trackers and cookies, and copying an invoice into a wallet &mdash; or embedding a bloated webview inside the wallet itself.

COP replaces that entire flow with a small, clean protocol rendered natively by the wallet:

- **Almost infinitely flexible** &mdash; merchants express menus, forms, price quotes and subscriptions through composable primitives that any COP-capable wallet can display and validate.
- **Interoperable** &mdash; one standard interface works across every wallet and every Bitcoin layer Cassis supports.
- **Private and secure** &mdash; no browsers, no JavaScript, no web servers, and no third-party checkout trackers. Communication happens peer-to-peer over encrypted transport.
