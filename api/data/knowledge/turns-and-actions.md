---
key: turns-and-actions
title: Turns & Actions
category: Basics
order: 20
---

## The game advances in ticks, not real time

Nothing you queue happens immediately. Building, moving Armies, recruiting Troops, colonizing —
all of it sits in a queue until the next scheduled turn fires and processes everything at once.

Diplomacy is the one exception: declaring war, proposing and accepting treaties, and sending
money are instant, real-time actions — they have to be, since an offer must be able to sit and
wait for a reply across turns. Selecting your active Research is also instant, for the same
reason (see **Research & Classes**).

## What happens on a turn tick, in order

1. **Income** — Money, Troops, Piety, and Research credited from your buildings.
2. **Production** — raw Resources (from mines, etc.) then manufactured Goods, in that order.
3. **Upkeep** — building and Army maintenance costs deducted.
4. **Supply** — every Army is charged Food based on distance from your nearest supply building;
   unfed Armies take losses.
5. **Recurring trade** — accepted recurring trade treaties settle.
6. **Your queued actions execute**, in the order you queued them.
7. **Cleanup** — Armies below 100 Troops disband, battles between multiple factions in the same
   Province resolve, Province control syncs with whoever's Army is actually standing there.
8. **Diplomacy tick** — occupation counters advance, truces decay, stale treaty offers expire.

Everything reloads automatically the moment your turn's processing finishes — you don't need to
refresh.

## While a turn is processing

The game briefly locks: most screens are unavailable for the few seconds it takes the server to
resolve everyone's queued actions. This is normal — it clears itself.

## If an action fails

A queued action can fail — insufficient Money, a Province that's since been occupied, an Army
that moved out from under you. You won't see why in the queue itself once the turn has processed;
check the **Notifications bell** afterward. Failed-action notices land in your System Logs tab
there and explain exactly what went wrong.

## One army action per turn

An Army can have at most one of **Move**, **Merge**, or **Transfer** pending at a time — queuing
a second locks until the first resolves or is cancelled. This stops you from accidentally
double-committing the same troops.
