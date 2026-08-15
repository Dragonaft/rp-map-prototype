---
key: provinces-and-buildings
title: Provinces & Buildings
category: Territory
order: 30
---

## Province landscapes

Every land Province has a landscape that caps how many buildings it can hold, before Research
bonuses:

| Landscape | Base building cap |
|---|---|
| Plains | 4 |
| Forest, Hills | 3 |
| Mountain, Desert, Swamp | 2 |

Water Provinces have no landscape and can never be owned or built on — Armies can still fight and
travel there (see **Ports & Naval**).

## Province resources

Some Provinces sit on a raw resource deposit: **iron**, **gold**, **stone**, **wood**, or
**grain**. Water Provinces instead carry **fish**. Certain buildings can only be built where the
matching resource is present — a MINE needs iron/gold/stone, FORESTRY needs wood, a BARN or FARM
needs grain. Gold is the rarest deposit on the map (roughly 4% of land Provinces), which makes it
a real bottleneck for anyone drawing on it.

## Building rules

Every rule below is data an admin can retune — treat the specifics as defaults, not fixed law:

- **Building cap** — landscape-based, extendable by Research.
- **Buildable / destructible** — most buildings can be built and demolished freely; your CAPITAL
  can do neither.
- **Unique per Province** — some buildings (MINE, FORT, PORT, and others) only allow one instance
  per Province.
- **Costs** — most buildings need Money, and often a one-time reservation of a raw Resource
  and/or manufactured Goods, paid once at build time and refunded if you demolish or upgrade away.
- **Tech/building prerequisites** — some buildings require a Research unlock or another building
  already standing (e.g. a RELIQUARY requires a TEMPLE first).
- **Neighboring water** — PORT can only be built where the Province itself sits next to at least
  one water Province.

## Upgrade chains

A handful of buildings upgrade in place rather than requiring demolition: **GARDEN → FARM**,
**FORT → CASTLE**, **FORESTRY → SAWMILL**. Upgrading keeps the building's existing output and adds
to it — it never resets progress.

## Defense buildings

FORT, CASTLE, CAPITAL, CAPITOL, and CATHEDRAL each add a flat defense bonus to any battle fought
in their Province. CASTLE is strictly the stronger fortification over FORT, but also costs more
to build and maintain — there's no free upgrade.

## Occupied Provinces

If a Province is occupied, **neither the legal owner nor the occupier can build, upgrade, or
demolish there**, and the legal owner earns nothing from it while occupation lasts. See
**Occupation** for the full mechanic.
