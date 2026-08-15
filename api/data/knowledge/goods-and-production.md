---
key: goods-and-production
title: Goods & Production
category: Economy
order: 50
---

## Two-pass production, every turn

Production runs in two passes, right after income and before upkeep:

1. **Resource production (unconditional)** — any building with a per-turn resource yield credits
   it straight to your stockpile. This is what MINE, FORESTRY, and BARN do — normally the
   Province's own resource, though a building can be set to credit a different one instead (PORT
   does this: it produces **Fish** every turn regardless of what the Province itself sits on).
2. **Goods production** — buildings that manufacture a Good spend a raw resource (if the building
   requires one) from your stockpile, then credit the finished Good to your inventory. If the
   input reservation fails — you're out of the raw resource — that building simply produces
   nothing that turn. Some production is unconditional instead (your CAPITAL makes Food from
   nothing).

Resource production always finishes before Goods production starts, so a resource mined this turn
is available to this same turn's manufacturing regardless of building order.

## The core Goods chain

| Building | Consumes | Produces |
|---|---|---|
| MINE (iron/gold/stone Province) | — | raw resource |
| BARN (grain Province) | — | raw grain |
| FORESTRY / SAWMILL | wood | **Lumber** |
| BRICKYARD (stone Province) | stone | **Bricks** |
| ARMORY | iron | **Weapons** |
| CAPITAL | — (unconditional) | **Food** |
| GARDEN / FARM (upgrade) | grain | **Food** |
| PORT | — | Fish (raw resource) |

**Lumber** and **Bricks** are one-time construction costs — most buildings need a Lumber payment
alongside their Money cost to build, and some (SAWMILL, FORT) need Bricks. **Food** is the one
Good with a genuine per-turn sink: it feeds your Armies every turn (see **Supply & Food**), so
unlike Lumber/Bricks it's meant to be spent continuously, not stockpiled.

## Food math

A BARN (25 grain/turn) sustains roughly 5 GARDENs or 2.5 FARMs on its own. Your CAPITAL's Food
output is deliberately the smallest of the three sources — a baseline trickle, not your main food
supply once you're running an actual economy.

## Where prestige Goods fit

Three more Goods — Warhorses, Relics, Spices — only exist inside the class-specific prestige
economy. See **The Class Economy** for how those work; they follow the same production mechanic
described here, just gated behind a player class.
