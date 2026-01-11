// Compare Fix #7 vs Fix #9 results

const fix7Data = require('./simulation-results/sim-50games-2026-01-11_03-47-58.json');
const fix9Data = require('./simulation-results/sim-50games-2026-01-11_04-06-55.json');

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

const fix7 = analyzeData(fix7Data, 'FIX #7');
const fix9 = analyzeData(fix9Data, 'FIX #9');

console.log('═'.repeat(60));
console.log('COMPARISON: Fix #7 (Baseline) → Fix #9 (Simplified Uncover)');
console.log('═'.repeat(60));

console.log(`\nGame length:`);
console.log(`  Fix #7: ${fix7.avgRounds.toFixed(1)} rounds`);
console.log(`  Fix #9: ${fix9.avgRounds.toFixed(1)} rounds`);
console.log(`  Change: ${fix9.avgRounds >= fix7.avgRounds ? '+' : ''}${(fix9.avgRounds - fix7.avgRounds).toFixed(1)} rounds`);

console.log(`\nBalance:`);
console.log(`  Fix #7: P1=${fix7.p1WinRate.toFixed(1)}% / P2=${fix7.p2WinRate.toFixed(1)}%`);
console.log(`  Fix #9: P1=${fix9.p1WinRate.toFixed(1)}% / P2=${fix9.p2WinRate.toFixed(1)}%`);
const balanceChange = Math.abs(50 - fix9.p1WinRate) - Math.abs(50 - fix7.p1WinRate);
console.log(`  Change: ${balanceChange > 0 ? '❌ Worse' : '✅ Better'} (${balanceChange.toFixed(1)}% from 50/50)`);

console.log(`\nAssassinations:`);
console.log(`  Fix #7: ${fix7.avgAssassinations.toFixed(1)}/game`);
console.log(`  Fix #9: ${fix9.avgAssassinations.toFixed(1)}/game`);
console.log(`  Change: ${fix9.avgAssassinations >= fix7.avgAssassinations ? '+' : ''}${(fix9.avgAssassinations - fix7.avgAssassinations).toFixed(1)}`);

console.log(`\nRaids:`);
console.log(`  Fix #7: ${fix7.avgRaids.toFixed(1)}/game`);
console.log(`  Fix #9: ${fix9.avgRaids.toFixed(1)}/game`);
console.log(`  Change: ${fix9.avgRaids >= fix7.avgRaids ? '+' : ''}${(fix9.avgRaids - fix7.avgRaids).toFixed(1)}`);

console.log(`\nBattles:`);
console.log(`  Fix #7: ${fix7.avgBattles.toFixed(1)}/game`);
console.log(`  Fix #9: ${fix9.avgBattles.toFixed(1)}/game`);
console.log(`  Change: ${fix9.avgBattles >= fix7.avgBattles ? '+' : ''}${(fix9.avgBattles - fix7.avgBattles).toFixed(1)}`);

console.log(`\nFields:`);
console.log(`  Fix #7: ${fix7.avgFields.toFixed(1)}/game`);
console.log(`  Fix #9: ${fix9.avgFields.toFixed(1)}/game`);
console.log(`  Change: ${fix9.avgFields >= fix7.avgFields ? '+' : ''}${(fix9.avgFields - fix7.avgFields).toFixed(1)}`);

console.log(`\nRoyal productivity:`);
console.log(`  Fix #7: ${fix7.raidsPerRoyal.toFixed(2)} raids/royal`);
console.log(`  Fix #9: ${fix9.raidsPerRoyal.toFixed(2)} raids/royal`);
console.log(`  Change: ${fix9.raidsPerRoyal >= fix7.raidsPerRoyal ? '+' : ''}${(fix9.raidsPerRoyal - fix7.raidsPerRoyal).toFixed(2)}`);

console.log(`\n${'═'.repeat(60)}`);
console.log('ASSESSMENT');
console.log('═'.repeat(60));

// Check if balance got significantly worse
if (Math.abs(balanceChange) > 5) {
  console.log(`\n⚠️  BALANCE SHIFT: ${Math.abs(balanceChange).toFixed(1)}% further from 50/50`);
  console.log(`   This could be variance (50 games) or a real effect.`);
  console.log(`   Recommend: Run 50 more games to confirm.`);
} else if (Math.abs(balanceChange) < 2) {
  console.log(`\n✅ BALANCE MAINTAINED: ${Math.abs(balanceChange).toFixed(1)}% change is negligible`);
} else {
  console.log(`\n✓ BALANCE SHIFT MINOR: ${Math.abs(balanceChange).toFixed(1)}% change (acceptable)`);
}

// Overall assessment
const gameplayChanges = [
  Math.abs(fix9.avgRounds - fix7.avgRounds),
  Math.abs(fix9.avgAssassinations - fix7.avgAssassinations),
  Math.abs(fix9.avgRaids - fix7.avgRaids),
  Math.abs(fix9.avgBattles - fix7.avgBattles)
];
const maxChange = Math.max(...gameplayChanges);

if (maxChange < 1.0) {
  console.log(`\n✅ MINIMAL GAMEPLAY IMPACT: All metrics changed <1.0`);
  console.log(`   Code simplification achieved without affecting gameplay!`);
} else {
  console.log(`\n⚠️  MODERATE GAMEPLAY CHANGES: Max change ${maxChange.toFixed(1)}`);
}
