#!/usr/bin/env node

/**
 * COMPARE SIMULATIONS
 *
 * Compares two simulation result files and shows the delta between them.
 * Useful for measuring the impact of AI changes or game mechanic tweaks.
 *
 * USAGE:
 *   node scripts/compare-simulations.js <path-to-baseline.json> <path-to-changed.json>
 *
 * EXAMPLE:
 *   node scripts/compare-simulations.js \
 *     simulation-results/baseline.json \
 *     simulation-results/after-fix.json
 *
 * OUTPUT:
 *   - Game length comparison
 *   - Win rate balance (P1/P2)
 *   - Assassinations per game
 *   - Raids, battles, fields per game
 *   - Royal productivity (raids per royal)
 *   - Assessment (better/worse/neutral)
 */

const fs = require('fs');
const path = require('path');

function analyzeData(data, label) {
  let totalRounds = 0;
  let totalAssassinations = 0;
  let totalRaids = 0;
  let totalBattles = 0;
  let totalFields = 0;
  let p1Wins = 0;
  let p2Wins = 0;
  let royalsPlaced = 0;

  for (const game of data.results) {
    totalRounds += game.rounds;

    const winnerId = game.winnerId || (game.winner && game.winner.includes('Starless') ? 1 : 2);
    if (winnerId === 1) p1Wins++;
    if (winnerId === 2) p2Wins++;

    for (const log of game.logs) {
      const msg = log.message;
      if (msg.includes('assassinated')) totalAssassinations++;
      if (msg.includes('raided')) totalRaids++;
      if (msg.includes('attacked') || msg.includes('destroyed')) {
        if (!msg.includes('raided')) totalBattles++;
      }
      if (msg.includes('fielded')) totalFields++;
      if (msg.includes('brought') && msg.includes('to power')) royalsPlaced++;
    }
  }

  const games = data.results.length;
  const raidsPerRoyal = royalsPlaced > 0 ? totalRaids / royalsPlaced : 0;

  return {
    games,
    avgRounds: totalRounds / games,
    avgAssassinations: totalAssassinations / games,
    avgRaids: totalRaids / games,
    avgBattles: totalBattles / games,
    avgFields: totalFields / games,
    p1WinRate: p1Wins / games * 100,
    p2WinRate: p2Wins / games * 100,
    raidsPerRoyal,
    royalsPlaced: royalsPlaced / games
  };
}

// Main execution
if (process.argv.length < 4) {
  console.error('Usage: node compare-simulations.js <baseline.json> <changed.json>');
  process.exit(1);
}

const baselinePath = process.argv[2];
const changedPath = process.argv[3];

if (!fs.existsSync(baselinePath)) {
  console.error(`Error: Baseline file not found: ${baselinePath}`);
  process.exit(1);
}

if (!fs.existsSync(changedPath)) {
  console.error(`Error: Changed file not found: ${changedPath}`);
  process.exit(1);
}

const baseline = require(path.resolve(baselinePath));
const changed = require(path.resolve(changedPath));

const baselineStats = analyzeData(baseline, 'Baseline');
const changedStats = analyzeData(changed, 'Changed');

console.log('═'.repeat(60));
console.log('SIMULATION COMPARISON');
console.log('═'.repeat(60));
console.log(`Baseline: ${baselinePath}`);
console.log(`Changed:  ${changedPath}`);

console.log(`\nGame length:`);
console.log(`  Baseline: ${baselineStats.avgRounds.toFixed(1)} rounds`);
console.log(`  Changed:  ${changedStats.avgRounds.toFixed(1)} rounds`);
const roundsDelta = changedStats.avgRounds - baselineStats.avgRounds;
console.log(`  Change:   ${roundsDelta >= 0 ? '+' : ''}${roundsDelta.toFixed(1)} rounds ${roundsDelta < -1 ? '✅' : roundsDelta > 1 ? '⚠️' : ''}`);

console.log(`\nBalance:`);
console.log(`  Baseline: P1=${baselineStats.p1WinRate.toFixed(1)}% / P2=${baselineStats.p2WinRate.toFixed(1)}%`);
console.log(`  Changed:  P1=${changedStats.p1WinRate.toFixed(1)}% / P2=${changedStats.p2WinRate.toFixed(1)}%`);
const balanceChange = Math.abs(50 - changedStats.p1WinRate) - Math.abs(50 - baselineStats.p1WinRate);
console.log(`  Change:   ${balanceChange > 0 ? '❌ Worse' : balanceChange < 0 ? '✅ Better' : '✓ Same'} (${balanceChange.toFixed(1)}% from 50/50)`);

console.log(`\nAssassinations:`);
console.log(`  Baseline: ${baselineStats.avgAssassinations.toFixed(1)}/game`);
console.log(`  Changed:  ${changedStats.avgAssassinations.toFixed(1)}/game`);
const assDelta = changedStats.avgAssassinations - baselineStats.avgAssassinations;
console.log(`  Change:   ${assDelta >= 0 ? '+' : ''}${assDelta.toFixed(1)} ${assDelta < -1 ? '✅' : assDelta > 1 ? '⚠️' : ''}`);

console.log(`\nRaids:`);
console.log(`  Baseline: ${baselineStats.avgRaids.toFixed(1)}/game`);
console.log(`  Changed:  ${changedStats.avgRaids.toFixed(1)}/game`);
const raidDelta = changedStats.avgRaids - baselineStats.avgRaids;
console.log(`  Change:   ${raidDelta >= 0 ? '+' : ''}${raidDelta.toFixed(1)} ${raidDelta > 1 ? '✅' : raidDelta < -1 ? '⚠️' : ''}`);

console.log(`\nBattles:`);
console.log(`  Baseline: ${baselineStats.avgBattles.toFixed(1)}/game`);
console.log(`  Changed:  ${changedStats.avgBattles.toFixed(1)}/game`);
const battleDelta = changedStats.avgBattles - baselineStats.avgBattles;
console.log(`  Change:   ${battleDelta >= 0 ? '+' : ''}${battleDelta.toFixed(1)} ${battleDelta < -1 ? '✅' : battleDelta > 1 ? '⚠️' : ''}`);

console.log(`\nRoyal productivity:`);
console.log(`  Baseline: ${baselineStats.raidsPerRoyal.toFixed(2)} raids/royal`);
console.log(`  Changed:  ${changedStats.raidsPerRoyal.toFixed(2)} raids/royal`);
const prodDelta = changedStats.raidsPerRoyal - baselineStats.raidsPerRoyal;
console.log(`  Change:   ${prodDelta >= 0 ? '+' : ''}${prodDelta.toFixed(2)} ${prodDelta > 0.1 ? '✅' : prodDelta < -0.1 ? '⚠️' : ''}`);

console.log(`\n${'═'.repeat(60)}`);
console.log('ASSESSMENT');
console.log('═'.repeat(60));

// Overall assessment
const majorRegressions = [];
if (Math.abs(balanceChange) > 10) majorRegressions.push(`Balance: ${Math.abs(balanceChange).toFixed(1)}% worse`);
if (roundsDelta > 5) majorRegressions.push(`Games ${roundsDelta.toFixed(1)} rounds longer`);
if (assDelta > 2) majorRegressions.push(`Assassinations +${assDelta.toFixed(1)}/game`);
if (prodDelta < -0.2) majorRegressions.push(`Productivity ${prodDelta.toFixed(2)} worse`);

if (majorRegressions.length > 0) {
  console.log(`\n❌ REGRESSION DETECTED:`);
  majorRegressions.forEach(r => console.log(`   - ${r}`));
} else if (Math.abs(balanceChange) > 5) {
  console.log(`\n⚠️  MODERATE BALANCE SHIFT: ${Math.abs(balanceChange).toFixed(1)}% from 50/50`);
  console.log(`   Consider running more games or investigating cause.`);
} else {
  console.log(`\n✅ NO MAJOR REGRESSIONS`);
  const improvements = [];
  if (roundsDelta < -2) improvements.push(`faster games (-${Math.abs(roundsDelta).toFixed(1)} rounds)`);
  if (assDelta < -1) improvements.push(`fewer assassinations (${assDelta.toFixed(1)})`);
  if (prodDelta > 0.1) improvements.push(`better productivity (+${prodDelta.toFixed(2)})`);
  if (Math.abs(balanceChange) < -2) improvements.push(`better balance`);

  if (improvements.length > 0) {
    console.log(`   Improvements: ${improvements.join(', ')}`);
  }
}
