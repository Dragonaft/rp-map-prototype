---
key: combat
title: Combat
category: Warfare
order: 90
---

## How power is calculated

```
Attack Power  = sum(unit.count × troopType.attack  × counterFactor)
Defense Power = sum(unit.count × troopType.defense × counterFactor) × max(defense building bonus, 1.0)
```

`counterFactor` is the composition bonus described below. Defense buildings standing in the
Province (FORT, CASTLE, CAPITAL, CAPITOL, CATHEDRAL) multiply the final defense total.

## The counter matrix

INFANTRY, RANGED, and CAVALRY form a rock-paper-scissors triangle:

```
INFANTRY beats CAVALRY   (+40%)      RANGED beats INFANTRY   (+40%)      CAVALRY beats RANGED   (+40%)
INFANTRY loses to RANGED (−30%)      RANGED loses to CAVALRY (−30%)      CAVALRY loses to INFANTRY (−30%)
```

Pikes stop cavalry, cavalry rides down archers, archers shoot infantry. The bonus scales with how
much of the *enemy's* force actually sits in the countered/countering category — face a
mono-composition army and you get the full swing; face a 50/50 mix and it's half that.
**SPECIAL and PEASANT never trigger or receive this bonus.**

## Who wins, and what it costs

**If the attacker's power is higher:**
- The defender loses their entire Army — there's no partial-casualty outcome for the losing side
  on the attack.
- The attacker gains **control** of the Province — outright if it was unclaimed, or as an
  **occupation** if it belonged to someone else (see **Occupation**).
- If the attacker drops below 100 Troops from their own casualties, their Army disbands too.

**If the defender's power is equal or higher:**
- On land, the attacker retreats with partial losses (capped at 80%) and the defender takes
  smaller losses in return — a minimum 5% casualty rate applies to both sides regardless, so
  fights never end in a true stalemate.
- **On water, there is no partial-casualty outcome for the loser at all — the losing side is
  always wiped out completely**, win or lose the power comparison. The winner still takes the
  same partial casualties as on land.

## Water fights differently

Every Troop type's attack and defense is scaled down while fighting on a water Province — Cavalry
takes the steepest penalty, Infantry/Ranged more moderate ones. See **Ports & Naval** for the
full mechanic and why it matters strategically.

## Multiple factions in one Province

If Armies from more than two players end up in the same Province, they don't all fight at once.
The Province's owner (or, on water where there's no owner, the lowest-ranked player present) is
the provisional defender. Only Armies **hostile** to the defender count as attackers — allies and
anyone granted troops-pass just co-locate peacefully. Attackers then fight the defender one at a
time, strongest first; whoever wins becomes the new defender for the next challenger.
