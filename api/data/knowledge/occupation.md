---
key: occupation
title: Occupation
category: Diplomacy
order: 140
---

## Winning a battle doesn't mean annexing the Province

Occupation and annexation ("coring") are two different mechanics, and the distinction matters:

- **Unclaimed land** — winning it is a direct claim. No occupation involved.
- **Your own Province, currently occupied by someone else** — winning it back is a retake: the
  occupation simply clears.
- **Someone else's core Province** — winning it makes you the **occupier**, not the new owner.
  Legal ownership doesn't change. This also escalates the pair to War if you weren't already.

## Life under occupation

While a Province is occupied:

- **The occupier** can't build, upgrade, or demolish there — but *can* recruit and defend at any
  recruitment-capable building already standing (a captured Fort, for instance).
- **The legal owner** is completely cut off from it: no building rights either, and the Province
  produces nothing for them — no income, no production, no upkeep charged, until they get it back.

A Province described as *"Occupied by {country} — cores in N turn(s)"* is telling you exactly
that: military control has changed hands, legal ownership hasn't yet.

## Auto-coring

Occupation isn't meant to be permanent. After **10 consecutive turns** occupied, a Province
automatically **cores** to the occupier — legal ownership transfers outright and the occupation
status clears. This is the passive path to annexation if nobody negotiates a peace first.

## The faster path: peace treaties

A peace treaty can include a `cede_province` article, transferring legal ownership immediately on
acceptance instead of waiting out the 10-turn clock — see **Diplomacy & Treaties**. This is the
usual way a war actually redraws the map, rather than everyone waiting for the timer.

## Multi-faction fights don't skip this rule

Even when a Province gets fought over by more than two players in the same turn (see **Combat**),
whoever ends up holding it goes through the exact same claim/retake/occupy logic described above —
there's no separate rule for chaotic multi-way battles.
