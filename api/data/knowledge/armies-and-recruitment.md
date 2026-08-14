---
key: armies-and-recruitment
title: Armies & Recruitment
category: Warfare
order: 80
---

## Troop categories

Every Troop type belongs to one of five categories, and category is load-bearing — it drives the
counter matrix in combat (see **Combat**):

| Category | Examples | Requirements |
|---|---|---|
| INFANTRY | Soldiers, Pikemen | BARRACKS |
| RANGED | Archers | BARRACKS + Research |
| CAVALRY | Knights | BARRACKS + NOBLE class |
| SPECIAL | Paladins, Mercenaries, and each class's elite unit | class-gated, various buildings |
| PEASANT | Militia | none |

SPECIAL and PEASANT sit outside the counter matrix entirely — they win or lose purely on raw
stats, with no composition bonus or penalty either way.

## Recruiting costs up to five things

Recruitment (creating a new Army or adding Troops to an existing one) can require, all scaled per
100 Troops and checked together — the whole recruitment fails if any one can't be paid:

1. **Money or Piety** — Piety only for the couple of Troop types that specifically cost Piety
   (Paladins, Templar Order); everyone else pays Money.
2. **Draft pool** — drawn from your national Troops resource. A few Troop types (Mercenaries,
   Free Company) skip this and are hired directly with Money instead.
3. **Goods** — an optional one-time Goods cost (e.g. Knights need Weapons). Not refunded if you
   later remove the Troops or disband the Army.
4. **A second, independent Goods cost** — some Troop types (the class elite units) need two
   distinct Goods to recruit, not just one.

You can only recruit in a Province you legally own and that isn't occupied — **unless** you're
the occupier, in which case you can recruit at any recruitment-capable building (like a captured
Fort) in the Province you're occupying.

## Merging & Transferring

Two of your own Armies **already in the same Province** — any Province, owned or not — can be
consolidated:

- **Merge** — dissolves one Army entirely into the other. One-directional, no minimum-size check
  on the army being dissolved.
- **Transfer** — rebalances specific Troop types between two Armies that both survive. After the
  transfer, both Armies must still meet the 100-Troop minimum or the whole action fails and
  nothing moves.

Both count as one of the three army-lock actions (Move/Merge/Transfer) — see **Turns & Actions**.

## Minimum size

Any Army that drops below **100 Troops** — from combat losses, starvation, or a bad transfer — is
automatically disbanded at the end of the turn it happened on.
