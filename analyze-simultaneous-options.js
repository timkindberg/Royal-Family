// Check how often raid and battle options are available simultaneously

const data = require('./simulation-results/sim-50games-2026-01-10_19-45-08.json');

let turnsWithActions = 0;
let turnsWithRaid = 0;
let turnsWithBattle = 0;
let turnsWithBoth = 0;

let raidChosen = 0;
let battleChosen = 0;
let raidChosenWhenBoth = 0;
let battleChosenWhenBoth = 0;

for (const game of data.results) {
  for (const log of game.logs) {
    if (!log.state || log.state.phase !== 'action') continue;

    turnsWithActions++;

    // We need to infer available actions from the state
    // This is approximate since we don't have the actual action list

    const state = log.state;
    const currentPlayer = state.currentPlayer;
    const playerState = currentPlayer === 1 ? state.p1 : state.p2;
    const opponentState = currentPlayer === 1 ? state.p2 : state.p1;

    // Check if opponent has fortified castles (battle possible)
    const hasFortifiedCastle = (opponentState.primary.isActive && opponentState.primary.fortification) ||
                                (opponentState.alliance.isActive && opponentState.alliance.fortification);

    // Check if opponent has unfortified castles (raid possible if we have royals)
    const hasUnfortifiedCastle = (opponentState.primary.isActive && !opponentState.primary.fortification) ||
                                  (opponentState.alliance.isActive && !opponentState.alliance.fortification);

    // Check if we have royals (needed for real raid)
    const hasRoyals = playerState.primary.royals.length > 0 || playerState.alliance.royals.length > 0;

    const canRaid = hasUnfortifiedCastle && hasRoyals;
    const canBattle = hasFortifiedCastle;

    if (canRaid) turnsWithRaid++;
    if (canBattle) turnsWithBattle++;
    if (canRaid && canBattle) turnsWithBoth++;

    // What did they actually do?
    const msg = log.message;
    if (msg.includes('raided')) {
      raidChosen++;
      if (canRaid && canBattle) raidChosenWhenBoth++;
    }
    if ((msg.includes('attacked') || msg.includes('destroyed')) && !msg.includes('raided')) {
      battleChosen++;
      if (canRaid && canBattle) battleChosenWhenBoth++;
    }
  }
}

console.log('═'.repeat(60));
console.log('SIMULTANEOUS RAID/BATTLE OPPORTUNITY ANALYSIS (BASELINE)');
console.log('═'.repeat(60));

console.log(`\nTotal action phase turns: ${turnsWithActions}`);
console.log(`\nTurns where actions were theoretically available:`);
console.log(`  Could raid: ${turnsWithRaid} (${(turnsWithRaid/turnsWithActions*100).toFixed(1)}%)`);
console.log(`  Could battle: ${turnsWithBattle} (${(turnsWithBattle/turnsWithActions*100).toFixed(1)}%)`);
console.log(`  Could do BOTH: ${turnsWithBoth} (${(turnsWithBoth/turnsWithActions*100).toFixed(1)}%)`);

console.log(`\nWhen BOTH raid and battle were available (${turnsWithBoth} turns):`);
if (turnsWithBoth > 0) {
  console.log(`  Chose raid: ${raidChosenWhenBoth} (${(raidChosenWhenBoth/turnsWithBoth*100).toFixed(1)}%)`);
  console.log(`  Chose battle: ${battleChosenWhenBoth} (${(battleChosenWhenBoth/turnsWithBoth*100).toFixed(1)}%)`);
  console.log(`  Chose other: ${turnsWithBoth - raidChosenWhenBoth - battleChosenWhenBoth} (${((turnsWithBoth - raidChosenWhenBoth - battleChosenWhenBoth)/turnsWithBoth*100).toFixed(1)}%)`);
}

console.log(`\nExpected impact of filtering battles when raid available:`);
console.log(`  Battles that should be eliminated: ${battleChosenWhenBoth}`);
console.log(`  As % of total battles: ${(battleChosenWhenBoth/battleChosen*100).toFixed(1)}%`);

console.log(`\n💡 This explains why the filter has limited impact!`);
console.log(`   Most of the time, only ONE of raid/battle is available, not both.`);
