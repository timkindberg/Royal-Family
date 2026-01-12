# AI Logic Improvements
**Evidence-based fixes to improve smart choice rate from 54.3% to 80%+**

## CRITICAL FIX #1: Filter Battle When Raid Available (Expected +26% improvement)

### The Problem
When AI has both "raid unfortified castle" and "battle fortified castle" options, it treats them as independent choices and sometimes picks battle. This is objectively wrong - raiding deals permanent damage, battling only chips fortification.

### The Fix
In `decideAction()` method (around line 1636), add action filtering BEFORE scoring:

```javascript
async decideAction() {
  await this.delay(this.thinkingDelay / 2);

  const actions = this.game.getAvailableActions();
  const enabledActions = actions.filter(a => a.enabled !== false);

  if (enabledActions.length === 0) return;

  // ⭐ NEW: Filter out suboptimal battle actions
  const filteredActions = this.filterSuboptimalActions(enabledActions);

  // Score each action with mood modifiers and variance
  const scoredActions = filteredActions.map(action => {
    let score = this.scoreAction(action);
    score = this.applyMoodModifier(action.type, score);
    score = this.addVariance(score);
    return { action, score };
  });

  // ... rest of method
}
```

Add new method after `decideAction()`:

```javascript
// Filter out objectively bad choices before scoring
filterSuboptimalActions(actions) {
  // Check if we have raid available
  const hasRaid = actions.some(a => a.type === 'raid');

  if (hasRaid) {
    // If we can raid, remove ALL battle actions
    // Raiding unfortified castle is ALWAYS better than battling fortified one
    return actions.filter(a => a.type !== 'battle');
  }

  // Check if we have justified fortify (castle has royals but no fortification)
  const hasJustifiedFortify = actions.some(a => {
    if (a.type !== 'fortify' && a.type !== 'upgrade-fortification') return false;
    const castle = a.castle;
    return castle && castle.royalFamily.length > 0 && !castle.fortification;
  });

  if (hasJustifiedFortify) {
    // If we have royals needing protection, remove redundant fortify options
    return actions.filter(a => {
      if (a.type !== 'fortify' && a.type !== 'upgrade-fortification') return true;
      const castle = a.castle;
      // Keep only fortifies for castles with royals but no fortification
      return castle && castle.royalFamily.length > 0 && !castle.fortification;
    });
  }

  return actions;
}
```

**Expected Impact:** Eliminates 244 out of 941 bad choices (25.9% → 0%)

---

## CRITICAL FIX #2: Prevent Over-Fortification (Expected +18% improvement)

### The Problem
AI fortifies castles that already have fortification and no damage, even when raid opportunities exist.

### The Fix
Update `scoreAction()` method's fortify case (around line 1799):

```javascript
case 'fortify': {
  const castle = action.castle;
  const hasRoyals = castle && castle.royalFamily.length > 0;

  // ⭐ NEW: Don't fortify if already protected and not under attack
  if (castle.fortification && castle.fortificationDamage.length === 0) {
    return -5; // Already protected, don't waste the card
  }

  if (hasRoyals) {
    // URGENT: Protect our royals!
    return 25 + (card.numericValue * 0.3);
  }
  // No royals yet - lower priority
  return 10 + (card.numericValue * 0.2);
}
```

Also update `upgrade-fortification` case (around line 1808):

```javascript
case 'upgrade-fortification': {
  const castle = action.castle;
  const hasRoyals = castle && castle.royalFamily.length > 0;

  // ⭐ NEW: Only upgrade if under active threat
  if (castle.fortificationDamage.length === 0) {
    return 5; // Not under attack, low priority
  }

  if (hasRoyals) {
    return 18 + (card.numericValue * 0.2);
  }
  return 8;
}
```

**Expected Impact:** Eliminates ~174 out of 941 bad choices (18.5% → ~5%)

---

## HIGH PRIORITY FIX #3: Remove Raid Penalty from Defensive Mood

### The Problem
Defensive mood gives -4 penalty to raids, bringing raid score from 30 down to 26. This is too close to battle's 24, allowing variance to flip the decision.

### The Fix
Update `applyMoodModifier()` method (around line 1256):

```javascript
applyMoodModifier(actionType, baseScore) {
  let modifier = 0;

  switch (this.mood) {
    case AIPlayer.MOODS.AGGRESSIVE:
      if (['raid', 'battle', 'assassinate', 'threaten'].includes(actionType)) {
        modifier = 6;
      } else if (['fortify', 'repair-fortification'].includes(actionType)) {
        modifier = -3;
      }
      break;

    case AIPlayer.MOODS.DEFENSIVE:
      if (['fortify', 'repair-fortification', 'upgrade-fortification'].includes(actionType)) {
        modifier = 6;
      }
      // ⭐ REMOVED: Penalty for raids/battles
      // Being defensive doesn't mean refusing to attack when it's smart!
      break;

    case AIPlayer.MOODS.AMBITIOUS:
      if (['bring-to-power', 'persuade'].includes(actionType)) {
        modifier = 5;
      } else if (['field'].includes(actionType)) {
        modifier = -2;
      }
      break;

    case AIPlayer.MOODS.OPPORTUNISTIC:
    default:
      // No modifier - play optimally
      break;
  }

  return baseScore + modifier;
}
```

**Expected Impact:** Prevents mood system from overriding smart raid choices

---

## MEDIUM PRIORITY FIX #4: Smarter Raid Choice (Kill vs Kidnap)

### The Problem
AI always kills highest rank royal, ignoring strategic context like castle distribution.

### The Fix
Update `decideRaidChoice()` method (around line 1991):

```javascript
async decideRaidChoice() {
  await this.delay(this.thinkingDelay / 2);

  const options = this.game.getRaidOptions();
  if (options.length === 0) return;

  const killOptions = options.filter(o => o.type === 'kill');
  const kidnapOption = options.find(o => o.type === 'kidnap');
  const rescueOption = options.find(o => o.type === 'rescue');

  // Always rescue first
  if (rescueOption) {
    this.game.executeRaidChoice('rescue');
    return;
  }

  if (killOptions.length > 0) {
    // ⭐ NEW: Strategic kill selection
    const best = this.chooseBestKillTarget(killOptions);
    this.game.executeRaidChoice('kill', best.target);
  } else if (kidnapOption) {
    const kidnapOptions = options.filter(o => o.type === 'kidnap');
    const best = kidnapOptions.reduce((a, b) =>
      ROYAL_HIERARCHY[a.target.value] > ROYAL_HIERARCHY[b.target.value] ? a : b
    );
    this.game.executeRaidChoice('kidnap', best.target);
  } else {
    this.game.executeRaidChoice('skip');
  }
}

// ⭐ NEW: Choose kill target strategically
chooseBestKillTarget(killOptions) {
  const raidedCastle = this.game.raidTarget;

  // Strategy: Prefer killing the ONLY royal in a castle over killing highest rank
  // Eliminating a castle's attack capability is better than reducing strength

  // Check if any target is the only royal in their castle
  for (const option of killOptions) {
    const targetCastle = raidedCastle;
    if (targetCastle.royalFamily.length === 1) {
      // This is the only royal - killing it eliminates castle's raid capability!
      return option;
    }
  }

  // Otherwise, kill highest rank (existing behavior)
  return killOptions.reduce((a, b) =>
    ROYAL_HIERARCHY[a.target.value] > ROYAL_HIERARCHY[b.target.value] ? a : b
  );
}
```

**Expected Impact:** More strategic kills, better castle elimination

---

## OPTIONAL FIX #5: Reduce Variance

### The Problem
±3 point variance can cause good actions to lose to mediocre ones when scores are close.

### The Fix
Reduce variance from 3 to 1 in constructor (line 1116):

```javascript
constructor(game, playerNumber = 2) {
  this.game = game;
  this.playerNumber = playerNumber;
  this.thinkingDelay = 800;

  this.mood = this.randomMood();
  this.turnsSinceMoodChange = 0;
  this.turnsSinceAttack = 0;
  this.lastAction = null;

  // ⭐ CHANGED: Reduce variance for more consistent decisions
  this.variance = 1; // Was 3 - smaller variance = smarter choices
  this.similarThreshold = 5;
}
```

**Expected Impact:** More consistent decision-making, fewer fluke bad choices

---

## ✅ ACTUAL RESULTS (After Implementation)

| Metric | Baseline | After Fixes | Change |
|--------|----------|-------------|--------|
| Game length (avg rounds) | 39.2 | 27.9 | **-29% faster** ✅ |
| Game length (median) | 37 | 26 | **-30% faster** ✅ |
| Raids per royal | 0.44 | 0.46 | +4.5% ✅ |
| P1/P2 balance | 42%/58% | 54%/46% | **More balanced** ✅ |

### Key Learnings

**What Worked:**
1. ✅ **Fix #6 (Boost raid scoring 30→45)** - THE GAME CHANGER
   - Made raids top priority above persuade (40 pts)
   - Games became 29% faster and more aggressive

2. ✅ **Fix #1 (Filter battles)** - Helped but limited impact
   - Only ~33% of turns have both raid AND battle available
   - Most of the time, only one option exists
   - Reduced battles by ~75 but not game-changing

3. ✅ **Fix #5 (Reduce variance)** - More consistent play
   - Fewer fluke decisions from randomness

**What Didn't Work As Expected:**
- ❌ **Smart choice rate didn't improve to 80%+**
  - Stayed around 54-55% because the problem was SCORING, not filtering
  - AI chose "other actions" 71.7% when raid+battle both available
  - Fix #6 (boosting raid score) addressed the root cause

**The Real Problem:**
- Raids scored 30-38, but persuade scored 40
- AI prioritized building (persuade, fortify, bring-to-power) over attacking
- Boosting raid to 45+ made permanent damage the top priority
- Result: Games became decisive and fast

## Summary of Improvements

| Fix | Impact | Status |
|-----|--------|--------|
| Filter battle actions | Reduced battles by ~75 | ✅ Implemented |
| Prevent over-fortify | Minor improvement | ✅ Implemented |
| Remove raid penalty | Consistent scoring | ✅ Implemented |
| Strategic kills | Better castle elimination | ✅ Implemented |
| Reduce variance | More consistent | ✅ Implemented |
| **Boost raid scoring** | **29% faster games!** | ✅ **GAME CHANGER** |

**Overall Actual Impact:**
- **Game speed: 29% faster** (more aggressive, decisive)
- **Raids per royal: maintained** (0.46 vs 0.44 baseline)
- **Balance: significantly improved** (54/46 vs 42/58)
- **AI plays to win condition** (permanent damage prioritized)

---

## ✅ FIX #7 IMPLEMENTED: Proactive Fortification When Assassin Visible

### The Problem
AI would place unprotected royals even when assassin was visible on field, resulting in obvious "dumb deaths":
- Bring-to-power penalty: -18
- First royal base score: 22
- Result: 22 - 18 = 4 (still positive, AI places royal)
- Opponent takes assassin → kills royal immediately
- **Looks stupid to players**

### The Fix

```javascript
// In fortify scoring:
const fieldHasAssassin = this.game.fieldPiles.some(pile =>
  pile.length > 0 && pile[pile.length - 1].value === '2'
);

if (hasRoyals && !castle.fortification && fieldHasAssassin) {
  return 60; // TOP PRIORITY - protect from visible threat!
}

// In bring-to-power:
if (fieldHasAssassin) {
  score -= 30; // Severe penalty ensures AI won't place unprotected royals
}
```

### Results

| Metric | Before Fix #7 | After Fix #7 | Change |
|--------|---------------|--------------|--------|
| Assassinations/game | 8.6 | 5.5 | **-36% reduction!** 🎉 |
| Raids per royal | 0.46 | 0.52 | **+13%** ✅ |
| Kills per royal | 0.22 | 0.27 | **+23%** ✅ |
| Game length | 27.9 rounds | 26.4 rounds | -5% faster |
| P1/P2 balance | 54%/46% | 48%/52% | **Near perfect!** ✅ |

### Impact

**36% fewer assassinations** - The biggest single improvement! AI now:
- Sees assassin on field
- Prioritizes fortification (score 60) over placing royal (negative score)
- Places royals only when protected or safe
- **Looks smart and strategic to players**

**Royals 13% more productive** - Better protection → longer lifespan → more raids before death

**Near-perfect balance** - 48/52 split is essentially 50/50

---

## FINAL COMBINED RESULTS (All 7 Fixes)

| Metric | Baseline | After All Fixes | Total Improvement |
|--------|----------|-----------------|-------------------|
| Game length (avg) | 39.2 rounds | 26.4 rounds | **-33% faster** ✅ |
| Assassinations/game | 9.5 | 5.5 | **-42% reduction** ✅ |
| Raids per royal | 0.44 | 0.52 | **+18% improvement** ✅ |
| Kills per royal | 0.18 | 0.27 | **+50% improvement** ✅ |
| P1/P2 balance | 42%/58% | 48%/52% | **Near perfect** ✅ |

### All Implemented Fixes

| Fix | Impact | Status |
|-----|--------|--------|
| #1: Filter battles | Reduced battles ~75 | ✅ Implemented |
| #2: Prevent over-fortify | Minor improvement | ✅ Implemented |
| #3: Remove raid penalty | Consistent scoring | ✅ Implemented |
| #4: Strategic kills | Better elimination | ✅ Implemented |
| #5: Reduce variance | More consistent | ✅ Implemented |
| #6: **Boost raid scoring** | **29% faster games** | ✅ **GAME CHANGER** |
| #7: **Proactive fortification** | **-36% assassinations** | ✅ **MAJOR WIN** |

**The AI is now competent and looks smart!**
- Plays aggressively to win condition (permanent damage)
- Protects pieces when threatened
- Makes strategic decisions instead of obvious mistakes
- Games are fast, balanced, and decisive

---

## Testing Recommendation

After implementing fixes:

1. Run 50 games with new AI
2. Re-run analysis scripts:
   - `node analyze-choice-justification.js`
   - `node analyze-royal-lifespans.js`
3. Compare smart choice rate (should be 80%+)
4. Compare raids per royal (should be 1.5-2.0)
5. If metrics improve, run 100 more games for validation

---

## Regression Risk

These changes are **low risk**:
- All changes are in AI decision logic, not game mechanics
- No changes to human player experience
- Can be tested entirely in AI vs AI simulation
- Easy to revert if something breaks

The only "breaking" change is making the AI actually play well, which might expose game balance issues that were hidden by bad AI play. But that's a good thing - better to discover balance issues with competent AI!
