const oldData = require('./simulation-results/sim-50games-2026-01-10_19-45-08.json');
const newData = require('./simulation-results/sim-50games-2026-01-11_01-23-43.json');

function analyzeRaidChoices(data, label) {
  let raidOpps = 0;
  let raidChoices = 0;
  let fortifyChoices = 0;
  let fortifyJustified = 0;
  let battleChoices = 0;

  for (const game of data.results) {
    for (const log of game.logs) {
      if (!log.state || log.state.phase !== 'action' || !log.state.drawnCard) continue;

      const state = log.state;
      const card = state.drawnCard;

      if (card.startsWith('K') || card.startsWith('Q') || card.startsWith('J') ||
          card.startsWith('2') || card.startsWith('A') || card.includes('🃏')) continue;

      const currentPlayer = state.currentPlayer;
      const playerState = currentPlayer === 1 ? state.p1 : state.p2;
      const opponentState = currentPlayer === 1 ? state.p2 : state.p1;

      const hasRoyals = playerState.primary.royals.length > 0 || playerState.alliance.royals.length > 0;
      if (!hasRoyals) continue;

      const cardSuit = card.match(/[♠♣♥♦]/)?.[0];
      const primarySuit = currentPlayer === 1 ? '♠' : '♥';
      const allianceSuit = currentPlayer === 1 ? '♣' : '♦';

      const primaryMatch = cardSuit === primarySuit && playerState.primary.royals.length > 0;
      const allianceMatch = cardSuit === allianceSuit && playerState.alliance.isActive && playerState.alliance.royals.length > 0;

      if (!primaryMatch && !allianceMatch) continue;

      const enemyHasActive = (opponentState.primary.isActive && !opponentState.primary.destroyed) ||
                             (opponentState.alliance.isActive && !opponentState.alliance.destroyed);
      if (!enemyHasActive) continue;

      const primaryVuln = opponentState.primary.isActive && !opponentState.primary.destroyed && !opponentState.primary.fortification;
      const allianceVuln = opponentState.alliance.isActive && !opponentState.alliance.destroyed && !opponentState.alliance.fortification;

      if (!primaryVuln && !allianceVuln) continue;

      raidOpps++;
      const msg = log.message;

      if (msg.includes('raided')) {
        raidChoices++;
      } else if (msg.includes('fortified')) {
        fortifyChoices++;

        const primaryNeedsFort = playerState.primary.royals.length > 0 && !playerState.primary.fortification;
        const allianceNeedsFort = playerState.alliance.royals.length > 0 && !playerState.alliance.fortification;

        if (primaryNeedsFort || allianceNeedsFort) {
          fortifyJustified++;
        }
      } else if (msg.includes('attacked') || msg.includes('destroyed')) {
        battleChoices++;
      }
    }
  }

  const smartChoices = raidChoices + fortifyJustified;
  const smartRate = (smartChoices / raidOpps * 100).toFixed(1);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${label}`);
  console.log('═'.repeat(60));
  console.log(`Raid opportunities: ${raidOpps}`);
  console.log(`\n  ✅ Raided: ${raidChoices} (${(raidChoices/raidOpps*100).toFixed(1)}%)`);
  console.log(`  ✅ Fortified (justified): ${fortifyJustified} (${(fortifyJustified/raidOpps*100).toFixed(1)}%)`);
  console.log(`  ❌ Fortified (unjustified): ${fortifyChoices - fortifyJustified} (${((fortifyChoices-fortifyJustified)/raidOpps*100).toFixed(1)}%)`);
  console.log(`  ❌ Battled (should raid): ${battleChoices} (${(battleChoices/raidOpps*100).toFixed(1)}%)`);
  console.log(`\n📊 Smart choice rate: ${smartRate}%`);

  return {
    raidOpps,
    raidChoices,
    fortifyJustified,
    battleChoices,
    smartRate: parseFloat(smartRate)
  };
}

console.log('\n' + '═'.repeat(60));
console.log('BASELINE vs IMPROVED AI COMPARISON');
console.log('═'.repeat(60));

const baseline = analyzeRaidChoices(oldData, 'BASELINE AI (Before Fixes)');
const improved = analyzeRaidChoices(newData, 'IMPROVED AI (After Fixes)');

console.log('\n' + '═'.repeat(60));
console.log('IMPROVEMENT SUMMARY');
console.log('═'.repeat(60));
console.log(`\nSmart choice rate:`);
console.log(`  Before: ${baseline.smartRate}%`);
console.log(`  After:  ${improved.smartRate}%`);
console.log(`  Change: ${improved.smartRate >= baseline.smartRate ? '+' : ''}${(improved.smartRate - baseline.smartRate).toFixed(1)}%`);

console.log(`\nRaid rate when possible:`);
console.log(`  Before: ${(baseline.raidChoices/baseline.raidOpps*100).toFixed(1)}%`);
console.log(`  After:  ${(improved.raidChoices/improved.raidOpps*100).toFixed(1)}%`);
console.log(`  Change: +${((improved.raidChoices/improved.raidOpps - baseline.raidChoices/baseline.raidOpps)*100).toFixed(1)}%`);

console.log(`\nBattles when should raid:`);
console.log(`  Before: ${baseline.battleChoices} (${(baseline.battleChoices/baseline.raidOpps*100).toFixed(1)}%)`);
console.log(`  After:  ${improved.battleChoices} (${(improved.battleChoices/improved.raidOpps*100).toFixed(1)}%)`);
console.log(`  Change: ${improved.battleChoices - baseline.battleChoices} (${((improved.battleChoices/improved.raidOpps - baseline.battleChoices/baseline.raidOpps)*100).toFixed(1)}%)`);

if (improved.smartRate >= 80) {
  console.log(`\n🎉 SUCCESS! AI achieved ${improved.smartRate}% smart choice rate (target: 80%+)`);
} else if (improved.smartRate > baseline.smartRate + 10) {
  console.log(`\n✅ SIGNIFICANT IMPROVEMENT! Smart choice rate up ${(improved.smartRate - baseline.smartRate).toFixed(1)}%`);
} else if (improved.smartRate > baseline.smartRate) {
  console.log(`\n⚠️  MINOR IMPROVEMENT: Smart choice rate up ${(improved.smartRate - baseline.smartRate).toFixed(1)}% (needs more work)`);
} else {
  console.log(`\n❌ NO IMPROVEMENT: Fixes didn't work as expected`);
}
