# Analysis Scripts

This folder contains reusable analysis scripts for evaluating AI performance and game balance.

## Available Scripts

### 🔬 compare-simulations.js

Compares two simulation result files to measure the impact of changes.

**Usage:**
```bash
node scripts/compare-simulations.js <baseline.json> <changed.json>
```

**Example:**
```bash
node scripts/compare-simulations.js \
  simulation-results/before-fix.json \
  simulation-results/after-fix.json
```

**Metrics Analyzed:**
- Game length (rounds)
- Win rate balance (P1/P2)
- Assassinations per game
- Raids, battles, fields per game
- Royal productivity (raids per royal)
- Overall assessment (regression/improvement)

**When to Use:**
- After implementing AI logic changes
- After game mechanic adjustments
- To validate that a fix didn't break balance

---

### 🎯 analyze-ai-quality.js

Analyzes AI decision-making quality by identifying suboptimal choices.

**Usage:**
```bash
node scripts/analyze-ai-quality.js <simulation-results.json>
```

**Example:**
```bash
node scripts/analyze-ai-quality.js simulation-results/sim-50games-latest.json
```

**Metrics Analyzed:**
- Raid opportunities (situations where raid is optimal)
- Smart choice rate (% of times AI chose optimally)
- Breakdown of suboptimal choices:
  - Battles when should raid
  - Over-fortification
  - Other wasteful actions

**When to Use:**
- To identify AI decision-making flaws
- To measure improvement after AI fixes
- To find specific patterns of bad choices

**Target:** 80%+ smart choice rate

---

## Requirements

All scripts require:
- Node.js installed
- Simulation result files in JSON format (from simulate-node.js with full state capture)

## Tips

**Running Simulations:**
```bash
# Generate baseline results
node simulate-node.js analyze 50

# Make your changes to game.js

# Generate new results
node simulate-node.js analyze 50

# Compare them
node scripts/compare-simulations.js \
  simulation-results/sim-50games-<baseline-timestamp>.json \
  simulation-results/sim-50games-<new-timestamp>.json
```

**Analyzing AI Quality:**
```bash
# Run a simulation with full state capture
node simulate-node.js analyze 50

# Analyze the results
node scripts/analyze-ai-quality.js simulation-results/sim-50games-<timestamp>.json
```

## Archive

The `archive/` folder contains one-off analysis scripts used during specific investigations. These are kept for reference but are not generally useful.
