const data = require('./simulation-results/sim-50games-2026-01-10_19-45-08.json');

let raidOpps = 0;
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

    if (msg.includes('fortified')) {
      fortifyChoices++;

      const primaryNeedsFort = playerState.primary.royals.length > 0 && !playerState.primary.fortification;
      const allianceNeedsFort = playerState.alliance.royals.length > 0 && !playerState.alliance.fortification;

      if (primaryNeedsFort || allianceNeedsFort) {
        fortifyJustified++;
      }
    }

    if (msg.includes('attacked') || msg.includes('destroyed')) {
      battleChoices++;
    }
  }
}

console.log('═'.repeat(60));
console.log('CHOICE JUSTIFICATION ANALYSIS');
console.log('═'.repeat(60));

console.log(`\nTotal raid opportunities: ${raidOpps}`);
console.log(`\nChose to FORTIFY instead: ${fortifyChoices}`);
console.log(`  Justified (had unfortified castle with royals): ${fortifyJustified} (${(fortifyJustified/fortifyChoices*100).toFixed(1)}%)`);
console.log(`  Unjustified (already fortified, or could have raided): ${fortifyChoices - fortifyJustified} (${((fortifyChoices-fortifyJustified)/fortifyChoices*100).toFixed(1)}%)`);

console.log(`\nChose to BATTLE instead: ${battleChoices}`);
console.log(`  NOTE: All battles here are UNJUSTIFIED because enemy had`);
console.log(`        an unfortified castle available to raid!`);

console.log('\n' + '═'.repeat(60));
console.log('FINAL VERDICT');
console.log('═'.repeat(60));

const actuallyRaided = raidOpps - fortifyChoices - battleChoices - 12;
const justifiedFortifies = fortifyJustified;
const unjustifiedChoices = (fortifyChoices - fortifyJustified) + battleChoices;

console.log(`\nWhen AI had raid opportunities (${raidOpps}):`);
console.log(`  ✅ Raided: ${actuallyRaided} (${(actuallyRaided/raidOpps*100).toFixed(1)}%)`);
console.log(`  ✅ Fortified (justified): ${justifiedFortifies} (${(justifiedFortifies/raidOpps*100).toFixed(1)}%)`);
console.log(`  ❌ Unjustified choices: ${unjustifiedChoices} (${(unjustifiedChoices/raidOpps*100).toFixed(1)}%)`);
console.log(`     - Fortify when already protected: ${fortifyChoices - fortifyJustified}`);
console.log(`     - Battle when could raid: ${battleChoices}`);

const smartChoiceRate = ((actuallyRaided + justifiedFortifies) / raidOpps * 100).toFixed(1);
console.log(`\n📊 Smart choice rate: ${smartChoiceRate}%`);

if (parseFloat(smartChoiceRate) < 60) {
  console.log('   🚨 AI is making poor decisions - needs improvement');
} else if (parseFloat(smartChoiceRate) < 75) {
  console.log('   ⚠️  AI is okay but could be smarter');
} else {
  console.log('   ✅ AI is making reasonable decisions');
}
