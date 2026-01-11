# AI Fix #8 (ROLLED BACK): Field Action Value Boost

## Implementation

**Changes Attempted:**
1. **Field multiplier boost** - Increased coverValue multiplier from 0.3 → 0.6
2. **Cap raised** - Field action cap raised from 20 → 35

**Logic:**
- Field actions should compete with mid-priority actions for strategic value
- Covering opponent's valuable cards (assassins, royals, high soldiers) should score higher
- Enable multi-turn strategic plays

---

## Results

| Metric | Fix #7 | Fix #8 | Change |
|--------|--------|--------|--------|
| **Game Length (avg)** | 26.4 rounds | 27.0 rounds | +0.6 rounds ❌ |
| **P1/P2 Balance** | 48%/52% | **62%/38%** | **-14% imbalance!** ❌ |
| **Assassinations/game** | 5.5 | 5.4 | -0.1 ✅ |
| **Raids per game** | 10.4 | 10.9 | +0.6 ✅ |
| **Battles per game** | 9.7 | 9.3 | -0.4 ✅ |
| **Fields per game** | 22.5 | 23.6 | +1.1 ✅ |
| **Royal productivity** | 0.96 raids/royal | 0.99 raids/royal | +0.03 ✅ |

---

## Critical Problem: Balance Regression

### 📊 The Issue

**Before Fix #8:** P1: 48% / P2: 52% (near perfect!)
**After Fix #8:** P1: 62% / P2: 38% (14% swing - terrible!)

This is the **worst balance** we've seen across all fixes. Even worse than the baseline (42%/58%).

### Why This Happened

**Turn Order Imbalance:**
- Each round has 3 turns
- Turn order: P1 → P2 → P1
- **P1 gets 2 turns per round, P2 gets 1 turn**

**Field Control Advantage:**
- By making field actions more valuable (0.6 multiplier, 35 cap), field control became more important
- P1 gets to field cards twice as often as P2 in the critical early turns
- This amplifies P1's inherent turn order advantage
- P1 can deny P2's valuable cards more effectively, snowballing the advantage

### What We Learned

**Field action value is tied to turn order balance!**

Increasing field action value makes the turn order imbalance worse because:
1. P1 goes first and can cover P2's best cards
2. P2 gets one chance to respond
3. P1 goes again and can cover more cards
4. Repeat

The game already has a structural imbalance favoring whoever gets more turns per round. Making field actions stronger exacerbates this.

---

## Positive Changes (Not Worth The Tradeoff)

✅ **Royal productivity up 3%** - More raids per royal (0.96 → 0.99)
✅ **More raids** - 10.4 → 10.9 per game (+5%)
✅ **Fewer wasteful battles** - 9.7 → 9.3 per game (-4%)

These are all good changes, but the **14% balance regression** makes the fix unacceptable.

---

## Decision: ROLLBACK

**Reason:** Balance regression is too severe.

**What This Means:**
- FLAW #1 (Field Action Undervalued) remains unaddressed
- Field actions will continue to be primarily reactive, not strategic
- AI will continue to miss multi-turn plays

**Alternative Approaches to Consider:**
1. **Fix turn order system first** - Make rounds more balanced (alternating who goes first?)
2. **Conditional field boost** - Only boost field value for P2 to compensate for turn disadvantage
3. **Smaller boost** - Try 0.4 multiplier or 25 cap instead of 0.6/35
4. **Abandon this fix** - Maybe field being lower priority is actually fine given turn order dynamics

---

## Conclusion

Fix #8 demonstrated that **field action value and turn order balance are interdependent**.

Attempting to improve AI strategic play by boosting field actions backfired because it amplified an existing structural imbalance in the game.

**Next Steps:**
- Move to FLAW #4 (Overly Complex Uncover Logic) which shouldn't affect balance
- Consider turn order rebalancing as a separate game design issue (not AI logic)

**Status:** ❌ ROLLED BACK
