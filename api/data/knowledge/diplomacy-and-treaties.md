---
key: diplomacy-and-treaties
title: Diplomacy & Treaties
category: Diplomacy
order: 130
---

## Diplomacy is real-time, not queued

Unlike building, moving Armies, or recruiting, every diplomatic action — declaring war, proposing
or accepting a treaty, sending Money — takes effect immediately. It has to: an offer needs to be
able to sit and wait for a reply across multiple turns, and the other player might act on it at
any moment.

## Relationship states

Between any two players, the relationship is one of:

- **Neutral** (the default) — attacks allowed, no formal hostility on record.
- **War** — attacks allowed, tracked as a formal War with attacker/defender sides.
- **Peace** — an enforced truce; attacks are blocked. Decays back to Neutral after a few turns if
  no new treaty renews it.
- **Alliance** — attacks blocked between you, passage granted both ways, and mutual defense: if
  one of you is attacked, the other is called in on their side.

Breaking an alliance drops the pair straight to Neutral, not Peace.

## Wars and being called in

Every act of hostility creates or joins a formal War with an attacker leader and a defender
leader, each with their own list of participants. When someone attacks a player who has allies,
those allies are automatically called to the defender's side — if a called ally happens to also
be allied with the attacker, that alliance breaks first before they join the fight.

## Treaty types

- **Peace** — ends a war. Demanded or ceded Provinces must be **contiguous** to the receiving
  side's existing territory — no scattering isolated conquests across the map. A **leader peace**
  ends the whole war for both sides; a **separate peace** lets one non-leader ally exit the war on
  their own, breaking off from their side.
- **Alliance** — sets the pair to Alliance. Can't be proposed while at war.
- **Trade** — transfers Money, raw resources, or Goods. Money can be sent to anyone (no treaty
  needed) except an enemy you're currently at war with. Resources and Goods additionally require a
  trade connection — a shared border, or a chain of neighbors who've granted troops-pass between
  you. Mark a trade **recurring** and it re-applies automatically every turn until cancelled.
- **Troops Pass** — lets one side's Armies enter the other's territory without triggering combat
  or occupation. Directional — granting it to someone doesn't grant it back automatically.
- **Article** — pure text, no mechanical effect. For roleplay notes and side agreements.

Any signed Alliance or Troops Pass can be cancelled unilaterally at any time. Cancelling one
teleports any of the other side's Armies currently sitting on your territory back to their
nearest fort or capital — they don't get stranded, but they don't get to linger either.

## Treaties expire if ignored

A pending treaty proposal that sits unanswered for too many turns auto-rejects on its own.
