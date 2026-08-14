---
key: supply-and-food
title: Supply & Food
category: Warfare
order: 100
---

## Every Army eats

Right after upkeep is charged each turn, every Army is billed Food based on its Troop composition
and how far it's strayed from your supply network. This is what makes deep offensives a real
tradeoff instead of a free action — an Army parked far from home costs more to keep fed, and
eventually starts starving.

## Supply buildings and range

CAPITAL, FORT, and CASTLE all act as supply sources. A Province counts as a source for whoever
**currently controls** it — if you occupy an enemy's fort, it starts supplying you, not them.

The first **4 tiles** from your nearest supply source are free (Research can extend this). Beyond
that, cost scales up linearly with distance, capped at 4× the base cost for anything unreachable
or extremely far out.

## What happens if an Army goes unfed

An Army that can't be fed loses **10% of every unit** that turn, plus you get a single warning
notification (one per turn, not one per Army). It isn't deleted outright by starvation alone —
but if the losses drop it below the 100-Troop minimum, the normal end-of-turn cleanup disbands it
just like any other undersized Army.

## Reading your Army's supply state

Every Army panel shows its current distance to the nearest supply source and the resulting cost
multiplier — check this before committing to a long campaign. An Army sitting well outside your
supply range and paying real Food cost is flagged directly in the Province panel too.

## Feeding order

If you can't afford to feed every Army at once, they're fed in order of who's cheapest to supply
first — home garrisons before far-flung expeditions. A shortfall starves the whole Army for that
Good rather than partially feeding it; there's no partial payment.
