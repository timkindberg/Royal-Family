#!/usr/bin/env node

// Analyze AVAILABLE actions vs CHOSEN actions when royals are present
const fs = require('fs');
const path = require('path');

const dataFile = process.argv[2] || 'simulation-results/sim-50games-2026-01-10_19-45-08.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('Analyzing Available vs Chosen Actions...\n');

// Track when player has royals and what they could have done
let turnsAnalyzed = 0;
let couldRaid = 0;
let didRaid = 0;
let couldBattle = 0;
let didBattle = 0;
let choseInsteadOfRaid = {
  field: 0,
  fortify: 0,
  persuade: 0,
  threaten: 0,
  'bring-to-power': 0,
  battle: 0,
  other: 0
};

for (const game of data.results) {
  for (const log of game.logs) {
    if (!log.state) continue; // Skip logs without state data

    const state = log.state;
    const msg = log.message;

    // Determine current player
    const currentPlayer = state.currentPlayer;
    const playerState = currentPlayer === 1 ? state.p1 : state.p2;
    const opponentState = currentPlayer === 1 ? state.p2 : state.p1;

    // Check if current player has any royals
    const hasRoyals = playerState.primary.royals.length > 0 || playerState.alliance.royals.length > 0;

    if (!hasRoyals || !state.drawnCard) continue;

    turnsAnalyzed++;

    const card = state.drawnCard;
    const cardValue = parseInt(card.match(/\d+/)?.[0]) || 0;
    const cardSuit = card.match(/[♠♣♥♦]/)?.[0];

    // Skip non-soldier cards
    if (card.startsWith('K') || card.startsWith('Q') || card.startsWith('J') || card.startsWith('2') || card.startsWith('A')) {
      continue;
    }

    // Determine player's suits
    // P1: ♠ (primary), ♣ (alliance)
    // P2: ♥ (primary), ♦ (alliance)
    const primarySuit = currentPlayer === 1 ? '♠' : '♥';
    const allianceSuit = currentPlayer === 1 ? '♣' : '♦';

    const matchesPrimary = cardSuit === primarySuit;
    const matchesAlliance = cardSuit === allianceSuit && playerState.alliance.isActive;

    // Check if player has royals in the matching castle
    const primaryHasRoyals = matchesPrimary && playerState.primary.royals.length > 0;
    const allianceHasRoyals = matchesAlliance && playerState.alliance.royals.length > 0;

    const hasMatchingRoyals = primaryHasRoyals || allianceHasRoyals;

    if (!hasMatchingRoyals) continue;

    // Check opponent's castles - are they vulnerable to raid?
    const opponentPrimaryVulnerable = opponentState.primary.isActive && !opponentState.primary.destroyed;
    const opponentAllianceVulnerable = opponentState.alliance.isActive && !opponentState.alliance.destroyed;

    const anyEnemyCastleActive = opponentPrimaryVulnerable || opponentAllianceVulnerable;

    if (!anyEnemyCastleActive) continue;

    // Check if enemy has fortification
    const primaryFortified = opponentState.primary.fortification !== null;
    const allianceFortified = opponentState.alliance.fortification !== null;

    const anyEnemyFortified = primaryFortified || allianceFortified;
    const anyEnemyUnfortified = (opponentPrimaryVulnerable && !primaryFortified) ||
                                 (opponentAllianceVulnerable && !allianceFortified);

    // Could have raided (unfortified enemy castle exists)
    if (anyEnemyUnfortified) {
      couldRaid++;

      if (msg.includes('raided')) {
        didRaid++;
      } else {
        // What did they do instead?
        if (msg.includes('fielded')) choseInsteadOfRaid.field++;
        else if (msg.includes('fortified')) choseInsteadOfRaid.fortify++;
        else if (msg.includes('persuaded')) choseInsteadOfRaid.persuade++;
        else if (msg.includes('threatened')) choseInsteadOfRaid.threaten++;
        else if (msg.includes('brought') && msg.includes('power')) choseInsteadOfRaid['bring-to-power']++;
        else if (msg.includes('fortification')) choseInsteadOfRaid.battle++;
        else choseInsteadOfRaid.other++;
      }
    }

    // Could have battled (fortified enemy castle exists)
    if (anyEnemyFortified) {
      couldBattle++;

      if (msg.includes('attacked') || msg.includes('destroyed')) {
        didBattle++;
      }
    }
  }
}

console.log('═'.repeat(60));
console.log('RAID OPPORTUNITY ANALYSIS');
console.log('═'.repeat(60));

console.log(`\nTurns analyzed (player has matching royals + soldier): ${turnsAnalyzed}`);
console.log(`\nRaid opportunities (unfortified enemy castle):`);
console.log(`  Could raid: ${couldRaid}`);
console.log(`  Actually raided: ${didRaid} (${(didRaid/couldRaid*100).toFixed(1)}%)`);
console.log(`  Chose something else: ${couldRaid - didRaid} (${((couldRaid-didRaid)/couldRaid*100).toFixed(1)}%)`);

console.log(`\nBattle opportunities (fortified enemy castle):`);
console.log(`  Could battle: ${couldBattle}`);
console.log(`  Actually battled: ${didBattle} (${(didBattle/couldBattle*100).toFixed(1)}%)`);

console.log(`\nWhen AI skipped raid opportunity, they chose:`);
const totalSkipped = couldRaid - didRaid;
for (const [action, count] of Object.entries(choseInsteadOfRaid)) {
  if (count > 0) {
    console.log(`  ${action}: ${count} (${(count/totalSkipped*100).toFixed(1)}%)`);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('CONCLUSION');
console.log('═'.repeat(60));

const raidRate = didRaid / couldRaid * 100;

if (raidRate < 30) {
  console.log(`\n🚨 AI IS MISSING RAID OPPORTUNITIES!`);
  console.log(`   Only raiding ${raidRate.toFixed(1)}% of the time when it could raid.`);
  console.log(`   This is an AI LOGIC problem, not a game design problem.`);
} else if (raidRate < 60) {
  console.log(`\n⚠️  AI is somewhat reluctant to raid.`);
  console.log(`   Raiding ${raidRate.toFixed(1)}% when possible - might prioritize defense.`);
} else {
  console.log(`\n✅ AI is aggressive about raiding.`);
  console.log(`   Raiding ${raidRate.toFixed(1)}% when possible.`);
}

// Calculate actual constraint
const opportunityRate = couldRaid / turnsAnalyzed * 100;
console.log(`\nHow often can royals ACTUALLY raid?`);
console.log(`  Turns with matching royals+soldier: ${turnsAnalyzed}`);
console.log(`  Raid opportunities: ${couldRaid} (${opportunityRate.toFixed(1)}%)`);

if (opportunityRate < 40) {
  console.log(`  ⚠️ Royals can only raid ${opportunityRate.toFixed(1)}% of the time due to constraints`);
  console.log(`     (suit mismatch, enemy fortifications, etc.)`);
} else {
  console.log(`  ✅ Royals have plenty of raid opportunities (${opportunityRate.toFixed(1)}%)`);
}
