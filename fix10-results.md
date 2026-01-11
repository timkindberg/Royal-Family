# AI Fix #10: Correct Drawing & Fielding Logic

## Problem Identified

The AI was making illogical drawing decisions based on a fundamental misunderstanding of how field piles work:

**The Bug:** AI had a "denial bonus" that added score for drawing opponent's valuable cards
- Drew opponent's Queen thinking it would "deny" them
- Then fielded that Queen (correctly covering opponent's 9)
- **Result:** Opponent just takes the Queen anyway - no denial happened!

**Root Cause:** Drawing doesn't remove cards from the game - it just moves them between piles. The only way to deny opponent cards is to **cover them up** when fielding.

---

## Implementation

### Change 1: Removed Denial Bonus (Lines 1380-1385)

**Before:**
```javascript
// DENIAL BONUS: Add value for denying opponent a useful card
const denialValue = this.evaluateCardForOpponent(card);
if (denialValue >= 15) {
  // This card would be GREAT for opponent - take it to deny them!
  score += denialValue * 0.5; // WRONG - not actually denying!
}
```

**After:**
```javascript
// (removed - no denial bonus)
```

**Rationale:** You can't deny by drawing. Only by covering.

---

### Change 2: Improved Uncover Logic (Lines 1380-1393)

**Before:**
```javascript
// Flat bonuses/penalties
if (uncoverValueForOpponent >= 12) {
  score -= 3; // Small flat penalty
}
if (uncoverValueForMe >= 15) {
  score += 2; // Small flat bonus
}
```

**After:**
```javascript
// Scaled bonuses/penalties based on actual card value
// Uncovering their Queen is much worse than uncovering their 4
score -= uncoverValueForOpponent * 0.3;
score += uncoverValueForMe * 0.2;
```

**Rationale:** The impact of uncovering cards should scale with their value. Uncovering opponent's Queen (value ~18) should have 4.5x the penalty of uncovering their 4 (value ~4).

---

### Change 3: Removed Deep Pile Preference (Lines 2015-2017)

**Before:**
```javascript
pileOptions.sort((a, b) => {
  if (b.coverValue !== a.coverValue) {
    return b.coverValue - a.coverValue;
  }
  // Tiebreaker: prefer piles with more cards (bury our card deeper)
  return b.size - a.size; // WRONG - doesn't matter
});
```

**After:**
```javascript
// AI FIX #10: Sort by cover value only (pile depth doesn't matter)
pileOptions.sort((a, b) => b.coverValue - a.coverValue);
```

**Rationale:** Pile depth is irrelevant for denial. Whether the card is 3rd or 7th in a pile, it's equally buried until the cards above are drawn.

---

## Results (50 games)

| Metric | Fix #7 (Baseline) | Fix #10 | Change |
|--------|-------------------|---------|--------|
| **Game Length** | 26.4 rounds | 27.3 rounds | +1.0 ⚠️ |
| **P1/P2 Balance** | 48%/52% | **48%/52%** | ✅ Perfect |
| **Assassinations** | 5.5/game | 5.6/game | +0.1 |
| **Raids** | 10.4/game | 10.0/game | -0.3 |
| **Battles** | 9.7/game | **12.1/game** | +2.4 ⚠️ |
| **Fields** | 22.5/game | 19.1/game | -3.4 |
| **Raids/royal** | 0.96 | 0.86 | -0.10 ⚠️ |

---

## Analysis

### ✅ Positive Changes

1. **Balance maintained perfectly:** 48%/52% (unchanged)
2. **Eliminated illogical draws:** AI no longer draws opponent's cards thinking it's "denial"
3. **Better uncover logic:** Penalties now scale with card value
4. **Code correctness:** Logic now matches game mechanics

### ⚠️ Concerning Changes

1. **More battles:** +2.4/game (9.7 → 12.1)
2. **Fewer raids:** -0.3/game (10.4 → 10.0)
3. **Lower royal productivity:** 0.96 → 0.86 raids/royal (-10%)
4. **Slightly longer games:** +1.0 rounds

### 🤔 Why This Happened

By removing the denial bonus, the AI now:
- Draws cards based purely on their utility value
- Fields more cards it can't use (because it's not drawing opponent's cards anymore)
- Has fewer soldiers available for raids (more fielding = fewer actions)
- Defaults to battles more often

**This is actually correct behavior** - the AI shouldn't have been drawing opponent's cards in the first place. The slight performance drop suggests the AI might need:
- Better raid prioritization
- Better soldier management
- Or the previous "denial bonus" was accidentally helping despite being conceptually wrong

---

## Trade-off Assessment

**Correctness vs Performance:**

**PROS:**
- ✅ Logically correct behavior (no fake "denial")
- ✅ Balance maintained perfectly
- ✅ Scaled uncover penalties are more accurate
- ✅ Code matches game mechanics

**CONS:**
- ⚠️ Slightly worse metrics (more battles, fewer raids)
- ⚠️ Lower royal productivity
- ⚠️ Games 1 round longer

**VERDICT:** ✅ **KEEP**

**Rationale:**
1. **Correctness matters** - the AI should understand how the game works
2. **Balance is maintained** - no regression in fairness
3. **User experience improved** - AI won't make obviously illogical draws
4. **Performance delta is small** - only 1 round longer, -0.3 raids/game
5. **Future improvements easier** - correct foundation allows better tuning

The slight performance hit is acceptable because the AI is now playing "correctly" instead of benefiting from a bug. Future optimizations can build on this correct foundation.

---

## What Player Will Notice

**Before Fix #10:**
- "Why did you draw my Queen and then field it? That makes no sense!" 😤

**After Fix #10:**
- AI makes more logical drawing decisions
- No more obviously wasteful draws
- Might see slightly more fielding/battles

---

## Next Steps

The performance delta suggests potential improvements:
1. **Raid scoring boost** - Already done in Fix #6, might need more
2. **Battle vs Raid filtering** - Already done in Fix #1, might need refinement
3. **Action prioritization** - Consider weighting permanent damage (raids) over chip damage (battles) even more

---

**Status:** ✅ IMPLEMENTED
**Impact:** Correctness fix with minor performance trade-off
**Recommendation:** Keep and monitor
