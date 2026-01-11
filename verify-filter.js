// Verify that the filter is actually working by checking logged actions

const newData = require('./simulation-results/sim-50games-2026-01-11_01-23-43.json');

let raidAndBattleBoth = 0;
let justRaid = 0;
let justBattle = 0;

for (const game of newData.results) {
  for (let i = 0; i < game.logs.length; i++) {
    const log = game.logs[i];
    const msg = log.message;

    // Look for action taken messages
    if (msg.includes('raided') || msg.includes('attacked') || msg.includes('destroyed')) {
      // Check if this was a raid or battle
      const wasRaid = msg.includes('raided');
      const wasBattle = msg.includes('attacked') || msg.includes('destroyed');

      if (wasRaid) justRaid++;
      if (wasBattle && !wasRaid) justBattle++;
    }
  }
}

console.log('Action frequencies in improved AI:');
console.log(`  Raids: ${justRaid}`);
console.log(`  Battles: ${justBattle}`);
console.log(`  Total: ${justRaid + justBattle}`);
console.log(`\nBattle rate: ${(justBattle / (justRaid + justBattle) * 100).toFixed(1)}%`);

// Now let's check the baseline for comparison
const oldData = require('./simulation-results/sim-50games-2026-01-10_19-45-08.json');

let oldRaid = 0;
let oldBattle = 0;

for (const game of oldData.results) {
  for (const log of game.logs) {
    const msg = log.message;

    if (msg.includes('raided')) oldRaid++;
    if ((msg.includes('attacked') || msg.includes('destroyed')) && !msg.includes('raided')) {
      oldBattle++;
    }
  }
}

console.log('\nBaseline AI:');
console.log(`  Raids: ${oldRaid}`);
console.log(`  Battles: ${oldBattle}`);
console.log(`  Battle rate: ${(oldBattle / (oldRaid + oldBattle) * 100).toFixed(1)}%`);

console.log('\nChange:');
console.log(`  Raid count: ${justRaid - oldRaid} (${justRaid >= oldRaid ? '+' : ''}${((justRaid - oldRaid) / oldRaid * 100).toFixed(1)}%)`);
console.log(`  Battle count: ${justBattle - oldBattle} (${justBattle >= oldBattle ? '+' : ''}${((justBattle - oldBattle) / oldBattle * 100).toFixed(1)}%)`);
