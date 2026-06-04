# Champion AI specification

Idle Rifts uses **utility AI**: every simulation tick each champion scores six actions; the highest score wins (earlier actions break ties). This document is the source of truth for **when** a champion does **what**, **why**, and **which attributes** drive the decision.

Implementation lives under `src/game/ai/`. Tune numbers in `AiTuning.ts` and role curves in `RoleProfiles.ts`.

---

## Core model

| Concept | Meaning |
|--------|---------|
| **Action** | Stateless behaviour module (`FarmMinionAction`, etc.) with `calculateScore` + `execute`. |
| **Score** | Non-negative urgency; higher = more important this tick. |
| **Situation** | Snapshot built from `MatchContext` (`ChampionSituation`) so all actions read the same facts. |
| **Role profile** | Per-role multipliers (CS greed, duel hunger, peel, shop timing). |
| **Lane contract** | Laners only fight their lane opponent; bot = ADC + support; jungle = jungle + camps only. |

### Champion attributes used by AI

| Attribute | Source | Used for |
|-----------|--------|----------|
| `role` | template | Lane, profile, duel eligibility |
| `hpPercent` | `currentHp / maxHp` | Recall, retreat, all-in |
| `statsLine.gold` | match economy | Recall shopping |
| `nextBackGold` | champion | Recall threshold (default 1500) |
| `stats.range` | role + template | Engage distance, last-hit |
| `stats.ms` | template + buffs | Pathing speed |
| `matchLevel` | in-match XP | Jungle objectives (dragon/baron gates) |
| `rotationLane` / `rotationIntent` | match events | Push/defend after T2 falls |
| `state` | output | `farming`, `fighting`, `retreating`, `backing`, `sieging`, `rotating` |
| `side` | team | Enemy/ally queries |

Combat stats (`ad`, `ap`, `armor`, etc.) affect **damage**, not utility scores, except indirectly via survivability (HP%).

### Lane & target rules

| Role | Home lane | May attack champions | May attack lane minions | May siege towers |
|------|-----------|----------------------|-------------------------|------------------|
| Top | top | Enemy top | Enemy top wave | Yes, with minion aggro |
| Mid | mid | Enemy mid | Enemy mid wave | Yes, with minion aggro |
| ADC | bot | Enemy ADC or support | Enemy bot wave | Yes, with minion aggro |
| Support | bot | Enemy ADC or support | Enemy bot wave | Yes, with minion aggro |
| Jungle | — | Enemy jungle only | No | No |

Minions only attack enemy champions in the **same lane** (junglers ignored).

---

## Action priority (tie-break order)

Listed first = wins equal scores:

1. `BACKPORT` — recall channel  
2. `RETREAT` — short reposition without recall  
3. `JUNGLE_CAMP` — jungle route only  
4. `ATTACK_CHAMPION` — lane duel / execute  
5. `PUSH_TOWER` — structure siege or rotation march  
6. `FARM_MINION` — floor; CS, approach wave, default path  

---

## Action specifications

### 1. Farm minions (`FARM_MINION`)

**Player fantasy:** “I walk up to the wave and last-hit.”

| Trigger | Score (base × role `csPriority`) | Why |
|---------|----------------------------------|-----|
| Enemy minion in attack range | 88 × csPriority | Last-hit is the default laning loop |
| Enemy minion visible in lane (≤560px) | 62 × csPriority | Walk up to the wave like a real laner |
| Other lane target in range (champ/structure) | 39 × csPriority | Secondary fight/siege |
| Nothing else | 15 × csPriority | Follow lane path toward next wave |

**Execute:**

1. `engage()` nearest valid target from `findTargetForChampion` (minions preferred in target scoring).  
2. Else `moveTowards` nearest enemy minion in lane.  
3. Else honour `rotationLane` (push path / defend point).  
4. Else `followPath` home lane rail.

**Does not run for:** jungle (score 0).

**Real-life rule:** Healthy laners **do not** give up a nearby cannon/minion last-hit to trade unless the opponent is in execute range (see Attack).

---

### 2. Attack champion (`ATTACK_CHAMPION`)

**Player fantasy:** “I trade when ahead, all-in when they’re low, with wave/minion backup.”

| Condition | Effect |
|-----------|--------|
| No lane opponent in engage range (300px) | Score 0 |
| Opponent below 35% HP | +50 execute bonus |
| HP advantage | +(self% − enemy%) × 50 |
| Each ally in 420px | +15 |
| Each allied lane minion (max 6) | +4 |
| **Killable minion in last-hit range** | Score 0 (CS > poke) |
| Support | ×0.55 aggression |
| Jungle | ×0.5 aggression |

**Execute:** `engage()` lane opponent; state `fighting`.

**Real-life rule:** Trading is opportunistic; **farming wins** unless execute or strong HP lead + backup.

---

### 3. Retreat (`RETREAT`)

**Player fantasy:** “I back off under tower without a wave, or when outnumbered and hurt.”

| Trigger | Score |
|---------|-------|
| In enemy tower range, no allied minion tanking | 90 |
| Outnumbered in engage range | +45 per extra enemy |
| Low HP fear | +(1 − hp%) × 55; extra if outnumbered |
| HP &lt; 20% with enemy in range | +40 |
| **Last-hit minion in range, not outnumbered** | Score 0 (stay for CS) |

**Execute:** Move to safe point outside tower, else toward nearest ally tower / base.

**Real-life rule:** Brief pullback, not full recall; don’t run from a 1v1 at high HP.

---

### 4. Backport (`BACKPORT`)

**Player fantasy:** “I recall when nearly dead or full inventory, never while zoned.”

| Condition | Score |
|-----------|-------|
| Already at base | 0 |
| Enemy lane opponent within 220px | 0 (combat lock) |
| HP &lt; 15% | +85 |
| HP &lt; 30% | +45 |
| Gold ≥ `nextBackGold` | +35 × role shop weight |
| HP &gt; 70% and not shopping | 0 |
| **Killable minion in range and HP &gt; 40%** | 0 |

**Execute:** 3s channel; heal to full at base; reset `nextBackGold`.

**Real-life rule:** Recall is for reset economy/survival, not while a free CS is in range.

---

### 5. Push tower (`PUSH_TOWER`)

**Player fantasy:** “I hit the tower only when minions tank it, or when the team assigned a push.”

| Trigger | Score |
|---------|-------|
| Jungle | 0 |
| Attackable tower/nexus + allied minion in tower range | 55 |
| `rotationIntent === "push"` | 35 |

**Execute:** Siege target or march push path.

**Real-life rule:** No mindless tower diving; match requires minion aggro on structures (see `canChampionAttackStructure`).

---

### 6. Jungle camp (`JUNGLE_CAMP`)

**Player fantasy:** “Clear camps → dragon/baron when level/time allows → fight enemy jungler if they invade.”

| Trigger | Score |
|---------|-------|
| Non-jungle | 0 |
| Camp or objective available | 40 base |
| Enemy jungler in 220px | +35 (skirmish over idle path) |

**Execute:** Clear nearest camp; break for objective if close; else patrol `JUNGLE_PATHS`.

**Real-life rule:** Junglers never lane-farm or siege; only neutral monsters + enemy jungler.

---

## Target selection (`findTargetForChampion`)

Scoring sorts by distance with biases (lower = better):

| Target type | Bias | Notes |
|-------------|------|-------|
| Minion | distance − 120 | CS priority |
| Champion | distance − 42 + low-HP bonus | Lane opponent only |
| Structure | distance − 48 (−92 nexus) | Only if minions tanking tower |

Acquisition radius: mid/adc 360px, support 320px, top 300px; jungle duel 220px.

---

## Rewards (combat outcomes)

| Event | Attacker must be | Reward |
|-------|------------------|--------|
| Minion kill | Champion | +1 CS, +14 melee / +18 caster gold |
| Champion kill | Champion | +1 kill, +300 gold, 30s kill buff |
| Camp | Champion (jungle) | +2 CS, +55 gold, camp XP |
| Dragon / Baron | Champion | Team buffs + XP (no direct tower damage) |

---

## Match-level events

| Event | Behaviour |
|-------|-----------|
| Enemy T2 destroyed | Laners **of that lane only** get `rotationLane` + push/defend |
| Wave spawn (30s) | 7 minions/lane/side @ champion move speed |
| Match end | Nexus destroyed, or overtime after 270s if structures damaged |

---

## Tuning reference

See `src/game/ai/AiTuning.ts` for radii and base scores. See `src/game/ai/RoleProfiles.ts` for per-role multipliers.

When changing behaviour, update **this doc** and the corresponding constants together.
