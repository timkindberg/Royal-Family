#!/usr/bin/env node

// Analyze actual ACTION choices when raid is available
const fs = require('fs');
const path = require('path');

const dataFile = process.argv[2] || 'simulation-results/sim-50games-2026-01-10_19-45-08.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('Analyzing Action Choices When Raid Available...\n');

let raidOpportunities = 0;
let chosenActions = {
  raid: 0,
  field: 0,
  fortify: 0,
  'bring-to-power': 0,
  battle: 0,
  persuade: 0,
  threaten: 0,
  'upgrade-fortification': 0,
  assassinate: 0
};

// Action patterns to detect final action taken
const actionPatterns = {
  raid: /raided .+ castle \(\+/,
  field: /fielded .+/,
  fortify: /fortified .+ castle \(strength:/,
  'bring-to-power': /brought [KQJ].+ to power/,
  battle: /(attacked|destroyed) .+ fortification/,
  persuade: /persuaded alliance/,
  threaten: /threatened enemy alliance/,
  assassinate: /assassinated [KQJ]/
};

for (const game of data.results) {
  let currentOpportunity = null;

  for (let i = 0; i < game.logs.length; i++) {
    const log = game.logs[i];
    if (!log.state) continue;

    const state = log.state;
    const msg = log.message;

    // Skip if not action phase
    if (state.phase !== 'action') continue;

    const currentPlayer = state.currentPlayer;
    const playerState = currentPlayer === 1 ? state.p1 : state.p2;
    const opponentState = currentPlayer === 1 ? state.p2 : state.p1;

    // Must have drawn card (soldier only)
    if (!state.drawnCard) continue;
    const card = state.drawnCard;
    if (card.startsWith('K') || card.startsWith('Q') || card.startsWith('J') ||
        card.startsWith('2') || card.startsWith('A') || card.includes('🃏')) {
      continue;
    }

    // Must have royals
    const hasRoyals = playerState.primary.royals.length > 0 || playerState.alliance.royals.length > 0;
    if (!hasRoyals) continue;

    // Must have matching suit
    const cardSuit = card.match(/[♠♣♥♦]/)?.[0];
    const primarySuit = currentPlayer === 1 ? '♠' : '♥';
    const allianceSuit = currentPlayer === 1 ? '♣' : '♦';

    const primaryMatch = cardSuit === primarySuit && playerState.primary.royals.length > 0;
    const allianceMatch = cardSuit === allianceSuit && playerState.alliance.isActive && playerState.alliance.royals.length > 0;

    if (!primaryMatch && !allianceMatch) continue;

    // Check if enemy has unfortified active castle
    const primaryVuln = opponentState.primary.isActive && !opponentState.primary.destroyed && !opponentState.primary.fortification;
    const allianceVuln = opponentState.alliance.isActive && !opponentState.alliance.destroyed && !opponentState.alliance.fortification;

    if (!primaryVuln && !allianceVuln) continue;

    // This is a raid opportunity! Look for the next action log
    currentOpportunity = {
      turn: log.turn,
      card: state.drawnCard,
      found: false
    };

    // Look ahead for the action taken
    for (let j = i + 1; j < game.logs.length && j < i + 5; j++) {
      const nextLog = game.logs[j];
      if (nextLog.turn !== log.turn) break;

      // Check which action was taken
      for (const [action, pattern] of Object.entries(actionPatterns)) {
        if (pattern.test(nextLog.message)) {
          raidOpportunities++;
          chosenActions[action]++;
          currentOpportunity.found = true;
          break;
        }
      }

      if (currentOpportunity.found) break;
    }
  }
}

console.log('═'.repeat(60));
console.log('ACTION CHOICE ANALYSIS');
console.log('═'.repeat(60));

console.log(`\nTotal raid opportunities detected: ${raidOpportunities}\n`);
console.log('Actions chosen when raid was available:');

// Sort by frequency
const sorted = Object.entries(chosenActions)
  .sort((a, b) => b[1] - a[1])
  .filter(([_, count]) => count > 0);

for (const [action, count] of sorted) {
  const pct = (count / raidOpportunities * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(count / raidOpportunities * 50));
  console.log(`  ${action.padEnd(20)} ${count.toString().padStart(4)} (${pct.padStart(5)}%)  ${bar}`);
}

console.log('\n' + '═'.repeat(60));
console.log('CONCLUSION');
console.log('═'.repeat(60));

const raidPct = (chosenActions.raid / raidOpportunities * 100).toFixed(1);

console.log(`\nWhen AI could raid:`);
console.log(`  Actually raided: ${raidPct}%`);
console.log(`  Chose other actions: ${(100 - parseFloat(raidPct)).toFixed(1)}%`);

if (parseFloat(raidPct) < 30) {
  console.log(`\n🚨 CRITICAL AI FLAW: AI is severely underutilizing raids!`);
  console.log(`   Likely cause: Field action competing with raid action in scoring.`);
} else if (parseFloat(raidPct) < 60) {
  console.log(`\n⚠️  AI is somewhat cautious but not critically broken.`);
} else {
  console.log(`\n✅ AI is appropriately aggressive with raids.`);
}

// Calculate opportunity cost
const missedRaids = raidOpportunities - chosenActions.raid;
const avgDamagePerRaid = 6; // Rough average soldier value
const totalMissedDamage = missedRaids * avgDamagePerRaid;

console.log(`\nOpportunity cost:`);
console.log(`  Missed ${missedRaids} raids`);
console.log(`  ≈ ${totalMissedDamage} missed permanent damage across all games`);
console.log(`  ≈ ${(totalMissedDamage / data.gameCount).toFixed(0)} missed damage per game`);
