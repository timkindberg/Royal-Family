#!/usr/bin/env node

/**
 * ANALYZE AI DECISION QUALITY
 *
 * Analyzes AI decision-making by finding situations where the AI had better
 * options available but chose suboptimally. Specifically identifies:
 * - Raid opportunities that were wasted on battles or other actions
 * - Over-fortification (fortifying already-protected castles)
 * - Battles against fortified castles when unfortified ones are available
 *
 * USAGE:
 *   node scripts/analyze-ai-quality.js <simulation-results.json>
 *
 * EXAMPLE:
 *   node scripts/analyze-ai-quality.js simulation-results/sim-50games-latest.json
 *
 * OUTPUT:
 *   - Total raid opportunities found
 *   - Smart choice rate (% of times AI chose raid/justified-fortify)
 *   - Breakdown of suboptimal choices (battles, over-fortification, other)
 *   - Per-game averages
 *
 * NOTES:
 *   - Requires full state capture in simulation results
 *   - A "raid opportunity" is when AI has matching soldier + royals + unfortified enemy castle
 *   - "Justified fortify" is fortifying a castle with royals that lacks protection
 */

const fs = require('fs');

function analyzeAIQuality(simulationData) {
  let totalOpportunities = 0;
  let raidChoices = 0;
  let battleChoices = 0;
  let overFortifyChoices = 0;
  let justifiedFortifyChoices = 0;
  let otherChoices = 0;

  for (const game of simulationData.results) {
    for (let i = 0; i < game.logs.length; i++) {
      const log = game.logs[i];
      const state = log.state;

      if (!state || !state.drawnCard) continue;

      const msg = log.message;
      const player = state.currentPlayer;
      const playerState = state.players.find(p => p.name === player);

      if (!playerState) continue;

      // Check if this is a raid opportunity
      const card = state.drawnCard;
      const hasMatchingSoldier = card.suit && card.numericValue >= 3 && card.numericValue <= 10;

      if (!hasMatchingSoldier) continue;

      // Find castle with this suit that has royals
      const castleWithRoyals = playerState.castles.find(c =>
        c.suit === card.suit && c.royalFamily && c.royalFamily.length > 0
      );

      if (!castleWithRoyals) continue;

      // Check if there's an unfortified enemy castle
      const enemyPlayer = state.players.find(p => p.name !== player);
      const hasUnfortifiedEnemyCastle = enemyPlayer?.castles.some(c =>
        c.isActive && !c.destroyed && (!c.fortification || c.fortificationDamage?.length > 0)
      );

      if (!hasUnfortifiedEnemyCastle) continue;

      // This is a raid opportunity!
      totalOpportunities++;

      // Categorize what the AI actually did
      if (msg.includes('raided')) {
        raidChoices++;
      } else if (msg.includes('fortified') || msg.includes('upgraded fortification') || msg.includes('repaired fortification')) {
        // Check if this fortification was justified
        const targetCastle = playerState.castles.find(c => msg.includes(c.suit));
        const hasRoyals = targetCastle?.royalFamily?.length > 0;
        const hasProtection = targetCastle?.fortification && (!targetCastle.fortificationDamage || targetCastle.fortificationDamage.length === 0);

        if (hasRoyals && !hasProtection) {
          justifiedFortifyChoices++;
        } else {
          overFortifyChoices++;
        }
      } else if (msg.includes('attacked') || msg.includes('destroyed')) {
        battleChoices++;
      } else {
        otherChoices++;
      }
    }
  }

  const totalGames = simulationData.results.length;
  const smartChoices = raidChoices + justifiedFortifyChoices;
  const smartChoiceRate = totalOpportunities > 0 ? (smartChoices / totalOpportunities * 100) : 0;

  return {
    totalOpportunities,
    totalGames,
    opportunitiesPerGame: totalOpportunities / totalGames,
    raidChoices,
    battleChoices,
    overFortifyChoices,
    justifiedFortifyChoices,
    otherChoices,
    smartChoices,
    smartChoiceRate
  };
}

// Main execution
if (process.argv.length < 3) {
  console.error('Usage: node analyze-ai-quality.js <simulation-results.json>');
  process.exit(1);
}

const filePath = process.argv[2];

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

const data = require(require('path').resolve(filePath));
const results = analyzeAIQuality(data);

console.log('═'.repeat(60));
console.log('AI DECISION QUALITY ANALYSIS');
console.log('═'.repeat(60));
console.log(`Simulation: ${filePath}`);
console.log(`Games analyzed: ${results.totalGames}`);

console.log(`\n${'─'.repeat(60)}`);
console.log('RAID OPPORTUNITIES');
console.log('─'.repeat(60));
console.log(`Total opportunities found: ${results.totalOpportunities}`);
console.log(`Per game: ${results.opportunitiesPerGame.toFixed(1)}`);

console.log(`\n${'─'.repeat(60)}`);
console.log('AI CHOICES');
console.log('─'.repeat(60));
console.log(`✅ Raided: ${results.raidChoices} (${(results.raidChoices/results.totalOpportunities*100).toFixed(1)}%)`);
console.log(`✅ Justified fortify: ${results.justifiedFortifyChoices} (${(results.justifiedFortifyChoices/results.totalOpportunities*100).toFixed(1)}%)`);
console.log(`❌ Battled instead: ${results.battleChoices} (${(results.battleChoices/results.totalOpportunities*100).toFixed(1)}%)`);
console.log(`❌ Over-fortified: ${results.overFortifyChoices} (${(results.overFortifyChoices/results.totalOpportunities*100).toFixed(1)}%)`);
console.log(`⚠️  Other action: ${results.otherChoices} (${(results.otherChoices/results.totalOpportunities*100).toFixed(1)}%)`);

console.log(`\n${'─'.repeat(60)}`);
console.log('SMART CHOICE RATE');
console.log('─'.repeat(60));
console.log(`${results.smartChoices} / ${results.totalOpportunities} = ${results.smartChoiceRate.toFixed(1)}%`);

if (results.smartChoiceRate >= 80) {
  console.log(`✅ EXCELLENT - AI makes smart choices most of the time`);
} else if (results.smartChoiceRate >= 60) {
  console.log(`✓ GOOD - AI makes smart choices more often than not`);
} else if (results.smartChoiceRate >= 40) {
  console.log(`⚠️  POOR - AI makes suboptimal choices frequently`);
} else {
  console.log(`❌ TERRIBLE - AI makes more bad choices than good ones`);
}

console.log(`\n${'═'.repeat(60)}`);
console.log('INTERPRETATION');
console.log('═'.repeat(60));
console.log(`A "raid opportunity" is when the AI has:`);
console.log(`  1. A soldier card (3-10) in hand`);
console.log(`  2. Royals in the matching suit castle`);
console.log(`  3. An unfortified enemy castle to raid`);
console.log(``);
console.log(`In this situation, raiding is ALWAYS the best choice because:`);
console.log(`  - Raids deal permanent damage (bringing enemy closer to defeat)`);
console.log(`  - Battles only chip at fortifications (temporary)`);
console.log(`  - Over-fortifying wastes a card on an already-protected castle`);
console.log(``);
console.log(`The "smart choice rate" measures how often the AI chooses optimally.`);
console.log(`Target: 80%+ (accounts for some strategic fortification)`);
