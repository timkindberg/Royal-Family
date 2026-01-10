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

## Summary of Expected Improvements

| Fix | Current Issue | Expected After Fix |
|-----|--------------|-------------------|
| Filter battle actions | 244 battles when should raid (25.9%) | ~0 battles when should raid (0%) |
| Prevent over-fortify | 174 unjustified fortifies (18.5%) | ~30 unjustified fortifies (3%) |
| Remove raid penalty | Defensive mood sabotages raids | Consistent raid scoring |
| Strategic kills | Always kill highest rank | Kill to eliminate castles |
| Reduce variance | ±3 causes bad luck choices | ±1 for consistency |

**Overall Expected Impact:**
- **Current smart choice rate: 54.3%**
- **Expected after fixes: 80-85%**
- **Raids per royal: 0.44 → ~1.8** (based on improved utilization)

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
