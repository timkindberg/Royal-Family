// Compare Fix #7 vs Fix #8 results

const fix7Data = require('./simulation-results/sim-50games-2026-01-11_03-47-58.json');
const fix8Data = require('./simulation-results/sim-50games-2026-01-11_04-02-34.json');

function analyzeData(data, label) {
  let totalRounds = 0;
  let totalAssassinations = 0;
  let totalRaids = 0;
  let totalBattles = 0;
  let totalFields = 0;
  let totalFortifies = 0;
  let totalBringToPower = 0;
  let p1Wins = 0;
  let p2Wins = 0;

  // Analyze royal productivity
  let royalsPlaced = 0;
  let raidsEnabled = 0;

  for (const game of data.results) {
    totalRounds += game.rounds;

    // Use winnerId if available, otherwise parse winner name
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
      if (msg.includes('fortified') || msg.includes('repaired fortification') || msg.includes('upgraded fortification')) {
        totalFortifies++;
      }
      if (msg.includes('brought') && msg.includes('to power')) {
        totalBringToPower++;
        royalsPlaced++;
      }
    }
  }

  const games = data.results.length;
  const avgRounds = totalRounds / games;
  const avgAssassinations = totalAssassinations / games;
  const avgRaids = totalRaids / games;
  const avgBattles = totalBattles / games;
  const avgFields = totalFields / games;
  const avgFortifies = totalFortifies / games;
  const avgBringToPower = totalBringToPower / games;
  const raidsPerRoyal = royalsPlaced > 0 ? totalRaids / royalsPlaced : 0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${label}`);
  console.log('═'.repeat(60));
  console.log(`Games: ${games}`);
  console.log(`\nAverage rounds: ${avgRounds.toFixed(1)}`);
  console.log(`\nWin rate:`);
  console.log(`  P1: ${(p1Wins/games*100).toFixed(1)}%`);
  console.log(`  P2: ${(p2Wins/games*100).toFixed(1)}%`);
  console.log(`\nActions per game:`);
  console.log(`  Assassinations: ${avgAssassinations.toFixed(1)}`);
  console.log(`  Raids: ${avgRaids.toFixed(1)}`);
  console.log(`  Battles: ${avgBattles.toFixed(1)}`);
  console.log(`  Fields: ${avgFields.toFixed(1)}`);
  console.log(`  Fortifies: ${avgFortifies.toFixed(1)}`);
  console.log(`  Bring-to-power: ${avgBringToPower.toFixed(1)}`);
  console.log(`\nRoyal productivity:`);
  console.log(`  Royals placed: ${(royalsPlaced/games).toFixed(1)}/game`);
  console.log(`  Total raids: ${totalRaids}`);
  console.log(`  Raids per royal: ${raidsPerRoyal.toFixed(2)}`);

  return {
    games,
    avgRounds,
    avgAssassinations,
    avgRaids,
    avgBattles,
    avgFields,
    avgFortifies,
    avgBringToPower,
    p1WinRate: p1Wins/games*100,
    p2WinRate: p2Wins/games*100,
    raidsPerRoyal,
    royalsPlaced: royalsPlaced/games
  };
}

const fix7 = analyzeData(fix7Data, 'FIX #7 (Proactive Fortification)');
const fix8 = analyzeData(fix8Data, 'FIX #8 (Field Action Value Boost)');

console.log(`\n${'═'.repeat(60)}`);
console.log('COMPARISON: Fix #7 → Fix #8');
console.log('═'.repeat(60));

console.log(`\nGame length:`);
console.log(`  Fix #7: ${fix7.avgRounds.toFixed(1)} rounds`);
console.log(`  Fix #8: ${fix8.avgRounds.toFixed(1)} rounds`);
console.log(`  Change: ${fix8.avgRounds >= fix7.avgRounds ? '+' : ''}${(fix8.avgRounds - fix7.avgRounds).toFixed(1)} rounds`);

console.log(`\nBalance:`);
console.log(`  Fix #7: P1=${fix7.p1WinRate.toFixed(1)}% / P2=${fix7.p2WinRate.toFixed(1)}%`);
console.log(`  Fix #8: P1=${fix8.p1WinRate.toFixed(1)}% / P2=${fix8.p2WinRate.toFixed(1)}%`);
console.log(`  Change: ${Math.abs(50 - fix8.p1WinRate) < Math.abs(50 - fix7.p1WinRate) ? '✅ Better' : '❌ Worse'}`);

console.log(`\nAssassinations:`);
console.log(`  Fix #7: ${fix7.avgAssassinations.toFixed(1)}/game`);
console.log(`  Fix #8: ${fix8.avgAssassinations.toFixed(1)}/game`);
console.log(`  Change: ${fix8.avgAssassinations >= fix7.avgAssassinations ? '+' : ''}${(fix8.avgAssassinations - fix7.avgAssassinations).toFixed(1)}`);

console.log(`\nRaids:`);
console.log(`  Fix #7: ${fix7.avgRaids.toFixed(1)}/game`);
console.log(`  Fix #8: ${fix8.avgRaids.toFixed(1)}/game`);
console.log(`  Change: ${fix8.avgRaids >= fix7.avgRaids ? '+' : ''}${(fix8.avgRaids - fix7.avgRaids).toFixed(1)}`);

console.log(`\nBattles:`);
console.log(`  Fix #7: ${fix7.avgBattles.toFixed(1)}/game`);
console.log(`  Fix #8: ${fix8.avgBattles.toFixed(1)}/game`);
console.log(`  Change: ${fix8.avgBattles >= fix7.avgBattles ? '+' : ''}${(fix8.avgBattles - fix7.avgBattles).toFixed(1)}`);

console.log(`\nFields:`);
console.log(`  Fix #7: ${fix7.avgFields.toFixed(1)}/game`);
console.log(`  Fix #8: ${fix8.avgFields.toFixed(1)}/game`);
console.log(`  Change: ${fix8.avgFields >= fix7.avgFields ? '+' : ''}${(fix8.avgFields - fix7.avgFields).toFixed(1)}`);

console.log(`\nRoyal productivity:`);
console.log(`  Fix #7: ${fix7.raidsPerRoyal.toFixed(2)} raids/royal`);
console.log(`  Fix #8: ${fix8.raidsPerRoyal.toFixed(2)} raids/royal`);
console.log(`  Change: ${fix8.raidsPerRoyal >= fix7.raidsPerRoyal ? '+' : ''}${(fix8.raidsPerRoyal - fix7.raidsPerRoyal).toFixed(2)}`);

console.log(`\n${'═'.repeat(60)}`);
console.log('ASSESSMENT');
console.log('═'.repeat(60));

if (Math.abs(50 - fix8.p1WinRate) > Math.abs(50 - fix7.p1WinRate) + 5) {
  console.log(`\n❌ REGRESSION: Balance got worse (${fix7.p1WinRate.toFixed(1)}% → ${fix8.p1WinRate.toFixed(1)}%)`);
  console.log(`   This fix may need adjustment or rollback.`);
} else if (fix8.avgRounds > fix7.avgRounds + 1) {
  console.log(`\n⚠️  CONCERN: Games got longer (+${(fix8.avgRounds - fix7.avgRounds).toFixed(1)} rounds)`);
} else if (fix8.raidsPerRoyal < fix7.raidsPerRoyal - 0.05) {
  console.log(`\n⚠️  CONCERN: Royal productivity decreased`);
} else {
  console.log(`\n✅ NEUTRAL or POSITIVE: No major regressions`);
}
