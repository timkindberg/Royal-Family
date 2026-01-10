const data = require('./simulation-results/sim-50games-2026-01-10_19-45-08.json');

let raidOpportunities = 0;
const chosenActions = {};

for (const game of data.results) {
  for (const log of game.logs) {
    if (!log.state || log.state.phase !== 'action' || !log.state.drawnCard) continue;

    const state = log.state;
    const card = state.drawnCard;

    // Filter to soldiers only
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

    // This is a raid opportunity!
    raidOpportunities++;

    // Categorize action taken
    const msg = log.message;
    let action = 'other';
    if (msg.includes('raided')) action = 'raid';
    else if (msg.includes('fielded')) action = 'field';
    else if (msg.includes('fortified')) action = 'fortify';
    else if (msg.includes('attacked') || msg.includes('destroyed')) action = 'battle';
    else if (msg.includes('persuaded')) action = 'persuade';
    else if (msg.includes('threatened')) action = 'threaten';

    chosenActions[action] = (chosenActions[action] || 0) + 1;
  }
}

console.log('═'.repeat(60));
console.log('RAID OPPORTUNITY ANALYSIS - ALL 50 GAMES');
console.log('═'.repeat(60));
console.log(`\nTotal raid opportunities: ${raidOpportunities}\n`);
console.log('Actions chosen when raid available:');

const sorted = Object.entries(chosenActions).sort((a, b) => b[1] - a[1]);
for (const [action, count] of sorted) {
  const pct = (count / raidOpportunities * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(count / raidOpportunities * 50));
  console.log(`  ${action.padEnd(15)} ${count.toString().padStart(4)} (${pct.padStart(5)}%)  ${bar}`);
}

const raidPct = ((chosenActions.raid || 0) / raidOpportunities * 100).toFixed(1);
console.log(`\n\nConclusion:`);
console.log(`  When AI could raid, it raided ${raidPct}% of the time`);
console.log(`  Chose other actions ${(100 - parseFloat(raidPct)).toFixed(1)}% of the time`);
