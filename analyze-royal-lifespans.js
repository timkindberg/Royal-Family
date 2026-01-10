#!/usr/bin/env node

// Analyze royal lifespans and value extracted before assassination
const fs = require('fs');
const path = require('path');

const dataFile = process.argv[2] || 'simulation-results/sim-50games-2026-01-10_19-45-08.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('Analyzing Royal Lifespans and Value Extraction...\n');

let totalRoyalsPlaced = 0;
let totalRoyalsAssassinated = 0;
let totalRoyalsDiedOtherWays = 0; // Castle destruction, killed in raid
let totalRoyalsSurvived = 0; // Still alive at game end

const lifespans = []; // { royal, placedTurn, diedTurn, lifespan, raids, kills, kidnaps }
const assassinationLifespans = [];
const raidDeathLifespans = [];

for (const game of data.results) {
  const royalTracker = new Map(); // Track each royal: "K♠" -> { placedTurn, castle, owner }

  for (const log of game.logs) {
    const turn = log.turn;
    const msg = log.message;

    // Track royal placement: "brought K♠ to power"
    const bringMatch = msg.match(/brought ([KQJ][♠♣♥♦]) to power/);
    if (bringMatch) {
      const royal = bringMatch[1];
      const owner = msg.includes('Starless') ? 'P1' : 'P2';
      royalTracker.set(royal, {
        royal,
        owner,
        placedTurn: turn,
        diedTurn: null,
        deathType: null,
        raidsEnabled: 0,
        killsMade: 0,
        kidnapsMade: 0
      });
      totalRoyalsPlaced++;
    }

    // Track raids (royal enables raid if in attacking castle)
    // "The Starless raided spade castle (+7 damage, total: 14/20)"
    const raidMatch = msg.match(/(Starless|Scarlett) raided ([a-z]+) castle/);
    if (raidMatch) {
      const attacker = raidMatch[1] === 'Starless' ? 'P1' : 'P2';
      const targetSuit = raidMatch[2]; // "spade", "club", "heart", "diamond"

      // Determine which castle is attacking based on suit
      // P1: spade (primary), club (alliance)
      // P2: heart (primary), diamond (alliance)
      let attackingSuit;
      if (attacker === 'P1') {
        attackingSuit = targetSuit === 'heart' || targetSuit === 'diamond' ? '♠' : '♣';
      } else {
        attackingSuit = targetSuit === 'spade' || targetSuit === 'club' ? '♥' : '♦';
      }

      // Find royals in that castle
      for (const [royalKey, info] of royalTracker.entries()) {
        if (info.owner === attacker && royalKey.includes(attackingSuit) && !info.diedTurn) {
          info.raidsEnabled++;
        }
      }
    }

    // Track kills: "The Starless killed Q♥!"
    const killMatch = msg.match(/killed ([KQJ][♠♣♥♦])/);
    if (killMatch) {
      const killedRoyal = killMatch[1];
      const killer = msg.includes('Starless') ? 'P1' : 'P2';

      // Record death
      if (royalTracker.has(killedRoyal)) {
        const info = royalTracker.get(killedRoyal);
        if (!info.diedTurn) {
          info.diedTurn = turn;
          info.deathType = 'raid-kill';
          totalRoyalsDiedOtherWays++;
        }
      }

      // Credit the kill to killer's royals in that castle
      // (Simplified: just credit all living royals of killer)
      for (const [royalKey, info] of royalTracker.entries()) {
        if (info.owner === killer && !info.diedTurn) {
          info.killsMade++;
        }
      }
    }

    // Track assassinations: "assassinated K♠" or "Assassin killed Q♥"
    const assassinMatch = msg.match(/assassinated ([KQJ][♠♣♥♦])|Assassin killed ([KQJ][♠♣♥♦])/);
    if (assassinMatch) {
      const assassinatedRoyal = assassinMatch[1] || assassinMatch[2];
      if (royalTracker.has(assassinatedRoyal)) {
        const info = royalTracker.get(assassinatedRoyal);
        if (!info.diedTurn) {
          info.diedTurn = turn;
          info.deathType = 'assassination';
          totalRoyalsAssassinated++;
        }
      }
    }

    // Track kidnaps: "kidnapped Q♥"
    const kidnapMatch = msg.match(/kidnapped ([KQJ][♠♣♥♦])/);
    if (kidnapMatch) {
      const kidnappedRoyal = kidnapMatch[1];
      const kidnapper = msg.includes('Starless') ? 'P1' : 'P2';

      // Credit kidnap to kidnapper's royals
      for (const [royalKey, info] of royalTracker.entries()) {
        if (info.owner === kidnapper && !info.diedTurn) {
          info.kidnapsMade++;
        }
      }

      // Note: kidnapped royal doesn't "die" unless castle destroyed
    }

    // Track castle destruction: "SPADE CASTLE DESTROYED!"
    const destroyMatch = msg.match(/([A-Z]+) CASTLE DESTROYED/);
    if (destroyMatch) {
      const destroyedSuit = destroyMatch[1].toLowerCase(); // "spade", "club", etc.
      const suitSymbol = {
        'spade': '♠',
        'club': '♣',
        'heart': '♥',
        'diamond': '♦'
      }[destroyedSuit];

      // All royals in that castle die
      for (const [royalKey, info] of royalTracker.entries()) {
        if (royalKey.includes(suitSymbol) && !info.diedTurn) {
          info.diedTurn = turn;
          info.deathType = 'castle-destroyed';
          totalRoyalsDiedOtherWays++;
        }
      }
    }
  }

  // End of game - calculate lifespans
  for (const [royalKey, info] of royalTracker.entries()) {
    if (!info.diedTurn) {
      // Survived to end
      info.diedTurn = game.turns;
      info.deathType = 'survived';
      totalRoyalsSurvived++;
    }

    const lifespan = info.diedTurn - info.placedTurn;
    const fullInfo = { ...info, lifespan };

    lifespans.push(fullInfo);

    if (info.deathType === 'assassination') {
      assassinationLifespans.push(fullInfo);
    } else if (info.deathType === 'raid-kill') {
      raidDeathLifespans.push(fullInfo);
    }
  }
}

// Calculate statistics
function calcStats(arr, key) {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };
  const values = arr.map(x => x[key]).sort((a, b) => a - b);
  return {
    min: values[0],
    max: values[values.length - 1],
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    median: values[Math.floor(values.length / 2)]
  };
}

console.log('═'.repeat(60));
console.log('ROYAL PLACEMENT & DEATH SUMMARY');
console.log('═'.repeat(60));
console.log(`Total royals placed: ${totalRoyalsPlaced}`);
console.log(`  Assassinated: ${totalRoyalsAssassinated} (${(totalRoyalsAssassinated/totalRoyalsPlaced*100).toFixed(1)}%)`);
console.log(`  Killed in raids: ${totalRoyalsDiedOtherWays} (${(totalRoyalsDiedOtherWays/totalRoyalsPlaced*100).toFixed(1)}%)`);
console.log(`  Survived to end: ${totalRoyalsSurvived} (${(totalRoyalsSurvived/totalRoyalsPlaced*100).toFixed(1)}%)`);
console.log(`  Per game: ${(totalRoyalsPlaced / data.gameCount).toFixed(1)} placed, ${(totalRoyalsAssassinated / data.gameCount).toFixed(1)} assassinated`);

console.log('\n' + '═'.repeat(60));
console.log('ROYAL LIFESPAN ANALYSIS');
console.log('═'.repeat(60));

const allLifespanStats = calcStats(lifespans, 'lifespan');
console.log(`\nAll Royals (n=${lifespans.length}):`);
console.log(`  Lifespan: min=${allLifespanStats.min}, median=${allLifespanStats.median}, avg=${allLifespanStats.avg.toFixed(1)}, max=${allLifespanStats.max} turns`);

if (assassinationLifespans.length > 0) {
  const assassinStats = calcStats(assassinationLifespans, 'lifespan');
  console.log(`\nAssassinated Royals (n=${assassinationLifespans.length}):`);
  console.log(`  Lifespan: min=${assassinStats.min}, median=${assassinStats.median}, avg=${assassinStats.avg.toFixed(1)}, max=${assassinStats.max} turns`);
  console.log(`  Avg raids before death: ${calcStats(assassinationLifespans, 'raidsEnabled').avg.toFixed(1)}`);
  console.log(`  Avg kills before death: ${calcStats(assassinationLifespans, 'killsMade').avg.toFixed(1)}`);
}

if (raidDeathLifespans.length > 0) {
  const raidStats = calcStats(raidDeathLifespans, 'lifespan');
  console.log(`\nKilled in Raids (n=${raidDeathLifespans.length}):`);
  console.log(`  Lifespan: min=${raidStats.min}, median=${raidStats.median}, avg=${raidStats.avg.toFixed(1)}, max=${raidStats.max} turns`);
  console.log(`  Avg raids before death: ${calcStats(raidDeathLifespans, 'raidsEnabled').avg.toFixed(1)}`);
  console.log(`  Avg kills before death: ${calcStats(raidDeathLifespans, 'killsMade').avg.toFixed(1)}`);
}

const survivors = lifespans.filter(l => l.deathType === 'survived');
if (survivors.length > 0) {
  const survivorStats = calcStats(survivors, 'lifespan');
  console.log(`\nSurvived to End (n=${survivors.length}):`);
  console.log(`  Lifespan: min=${survivorStats.min}, median=${survivorStats.median}, avg=${survivorStats.avg.toFixed(1)}, max=${survivorStats.max} turns`);
  console.log(`  Avg raids during game: ${calcStats(survivors, 'raidsEnabled').avg.toFixed(1)}`);
  console.log(`  Avg kills during game: ${calcStats(survivors, 'killsMade').avg.toFixed(1)}`);
}

console.log('\n' + '═'.repeat(60));
console.log('VALUE EXTRACTION ANALYSIS');
console.log('═'.repeat(60));

const totalRaids = lifespans.reduce((sum, r) => sum + r.raidsEnabled, 0);
const totalKills = lifespans.reduce((sum, r) => sum + r.killsMade, 0);

console.log(`\nTotal raids enabled by all royals: ${totalRaids}`);
console.log(`Total kills made by royals: ${totalKills}`);
console.log(`Average raids per royal: ${(totalRaids / totalRoyalsPlaced).toFixed(2)}`);
console.log(`Average kills per royal: ${(totalKills / totalRoyalsPlaced).toFixed(2)}`);

// ROI analysis
console.log('\n' + '═'.repeat(60));
console.log('RETURN ON INVESTMENT (ROI)');
console.log('═'.repeat(60));

console.log(`\nCost to place a royal:`);
console.log(`  - Draw the royal card (1 turn)`);
console.log(`  - Often need fortification first (~1-2 turns to draw+place soldier)`);
console.log(`  - Total investment: ~2-3 turns`);

console.log(`\nValue extracted from average royal:`);
console.log(`  - Lives ${allLifespanStats.avg.toFixed(1)} turns`);
console.log(`  - Enables ${(totalRaids / totalRoyalsPlaced).toFixed(2)} raids (dealing permanent damage)`);
console.log(`  - Makes ${(totalKills / totalRoyalsPlaced).toFixed(2)} kills/kidnaps`);

console.log(`\nValue extracted from assassinated royal specifically:`);
if (assassinationLifespans.length > 0) {
  const avgAssassinRaids = calcStats(assassinationLifespans, 'raidsEnabled').avg;
  const avgAssassinKills = calcStats(assassinationLifespans, 'killsMade').avg;
  console.log(`  - Lives ${calcStats(assassinationLifespans, 'lifespan').avg.toFixed(1)} turns`);
  console.log(`  - Enables ${avgAssassinRaids.toFixed(2)} raids before death`);
  console.log(`  - Makes ${avgAssassinKills.toFixed(2)} kills before death`);

  if (avgAssassinRaids >= 1) {
    console.log(`\n  ✅ ROI: POSITIVE - Royal enables ~${avgAssassinRaids.toFixed(1)} raid(s) before assassination`);
  } else if (avgAssassinRaids >= 0.5) {
    console.log(`\n  ⚠️  ROI: MARGINAL - Royal enables ~${avgAssassinRaids.toFixed(1)} raids before assassination`);
  } else {
    console.log(`\n  ❌ ROI: NEGATIVE - Royal barely contributes before assassination`);
  }
}

// Breakdown by quick vs long-lived royals
console.log('\n' + '═'.repeat(60));
console.log('LIFESPAN DISTRIBUTION');
console.log('═'.repeat(60));

const quickDeaths = assassinationLifespans.filter(r => r.lifespan <= 3);
const mediumLife = assassinationLifespans.filter(r => r.lifespan > 3 && r.lifespan <= 10);
const longLife = assassinationLifespans.filter(r => r.lifespan > 10);

console.log(`\nAssassinated royals by lifespan:`);
console.log(`  Quick death (≤3 turns): ${quickDeaths.length} (${(quickDeaths.length/assassinationLifespans.length*100).toFixed(1)}%)`);
if (quickDeaths.length > 0) {
  console.log(`    - Avg raids: ${calcStats(quickDeaths, 'raidsEnabled').avg.toFixed(2)}`);
  console.log(`    - Avg kills: ${calcStats(quickDeaths, 'killsMade').avg.toFixed(2)}`);
}

console.log(`  Medium life (4-10 turns): ${mediumLife.length} (${(mediumLife.length/assassinationLifespans.length*100).toFixed(1)}%)`);
if (mediumLife.length > 0) {
  console.log(`    - Avg raids: ${calcStats(mediumLife, 'raidsEnabled').avg.toFixed(2)}`);
  console.log(`    - Avg kills: ${calcStats(mediumLife, 'killsMade').avg.toFixed(2)}`);
}

console.log(`  Long life (>10 turns): ${longLife.length} (${(longLife.length/assassinationLifespans.length*100).toFixed(1)}%)`);
if (longLife.length > 0) {
  console.log(`    - Avg raids: ${calcStats(longLife, 'raidsEnabled').avg.toFixed(2)}`);
  console.log(`    - Avg kills: ${calcStats(longLife, 'killsMade').avg.toFixed(2)}`);
}

console.log('\n' + '═'.repeat(60));
console.log('HYPOTHESIS TEST: Are assassinations ruining the game?');
console.log('═'.repeat(60));

console.log(`\nCriteria for "ruining":`);
console.log(`  1. Royals die too quickly (< 5 turn average lifespan)`);
console.log(`  2. Royals contribute too little (< 1 raid average before death)`);
console.log(`  3. Too many instant deaths (>30% die within 3 turns)`);

const avgAssassinatedLifespan = calcStats(assassinationLifespans, 'lifespan').avg;
const avgAssassinatedRaids = calcStats(assassinationLifespans, 'raidsEnabled').avg;
const instantDeathRate = quickDeaths.length / assassinationLifespans.length * 100;

console.log(`\nActual data:`);
console.log(`  1. Average assassinated royal lifespan: ${avgAssassinatedLifespan.toFixed(1)} turns`);
console.log(`  2. Average raids before assassination: ${avgAssassinatedRaids.toFixed(2)}`);
console.log(`  3. Quick death rate (≤3 turns): ${instantDeathRate.toFixed(1)}%`);

console.log(`\nVerdict:`);
let ruining = false;
if (avgAssassinatedLifespan < 5) {
  console.log(`  ❌ FAIL: Lifespan too short (${avgAssassinatedLifespan.toFixed(1)} < 5)`);
  ruining = true;
} else {
  console.log(`  ✅ PASS: Lifespan adequate (${avgAssassinatedLifespan.toFixed(1)} >= 5)`);
}

if (avgAssassinatedRaids < 1) {
  console.log(`  ❌ FAIL: Too little value (${avgAssassinatedRaids.toFixed(2)} < 1 raid)`);
  ruining = true;
} else {
  console.log(`  ✅ PASS: Adequate value (${avgAssassinatedRaids.toFixed(2)} >= 1 raid)`);
}

if (instantDeathRate > 30) {
  console.log(`  ❌ FAIL: Too many instant deaths (${instantDeathRate.toFixed(1)}% > 30%)`);
  ruining = true;
} else {
  console.log(`  ✅ PASS: Acceptable death rate (${instantDeathRate.toFixed(1)}% <= 30%)`);
}

if (ruining) {
  console.log(`\n🚨 CONCLUSION: Assassinations ARE objectively ruining the game`);
} else {
  console.log(`\n✅ CONCLUSION: Assassinations are NOT ruining the game`);
  console.log(`   Royals live long enough and contribute enough value before death.`);
}
