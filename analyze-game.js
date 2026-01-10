// Deep analysis of a single game turn by turn
const fs = require('fs');

// Get the latest single-game simulation
const files = fs.readdirSync('./simulation-results').filter(f => f.includes('1games'));
const latestFile = files.sort().pop();
const data = JSON.parse(fs.readFileSync(`./simulation-results/${latestFile}`, 'utf8'));
const game = data.results[0];

console.log('═'.repeat(80));
console.log(`TURN-BY-TURN ANALYSIS: ${game.rounds} Round Game`);
console.log(`Winner: ${game.winner}`);
console.log('═'.repeat(80));

// Group logs by turn
const turns = {};
for (const log of game.logs) {
  const key = `R${log.round}T${log.turn}`;
  if (!turns[key]) turns[key] = [];
  turns[key].push(log);
}

// Track game progression
let turnCount = 0;
let issues = [];

for (const [turnKey, logs] of Object.entries(turns)) {
  // Find the draw and action logs
  const drawLog = logs.find(l => l.message.includes('drew') && !l.message.includes('SURPRISE'));
  const actionLog = logs.find(l => 
    l.message.includes('fielded') || 
    l.message.includes('fortified') ||
    l.message.includes('raided') ||
    l.message.includes('persuaded') ||
    l.message.includes('brought') ||
    l.message.includes('assassinated') ||
    l.message.includes('threatened') ||
    l.message.includes('attacked') ||
    l.message.includes('destroyed fort')
  );
  
  if (!drawLog || !drawLog.state) continue;
  
  const state = drawLog.state;
  turnCount++;
  
  // Skip flop turns
  if (state.phase === 'flop') continue;
  
  const card = state.drawnCard;
  if (!card) continue;
  
  const player = state.currentPlayer;
  const playerName = player === 1 ? 'Starless' : 'Scarlett';
  const myState = player === 1 ? state.p1 : state.p2;
  const enemyState = player === 1 ? state.p2 : state.p1;
  const mySuits = player === 1 ? ['♠', '♣'] : ['♥', '♦'];
  const enemySuits = player === 1 ? ['♥', '♦'] : ['♠', '♣'];
  
  // Parse card
  const cardValue = card.replace(/[♠♣♥♦]/g, '');
  const cardSuit = card.slice(-1);
  const isRoyal = ['K', 'Q', 'J'].includes(cardValue);
  const isAssassin = cardValue === '2';
  const isSoldier = !isRoyal && !isAssassin && cardValue !== 'A' && card !== '🃏';
  const numValue = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13}[cardValue] || 0;
  
  // Determine what action was taken
  let actionTaken = 'unknown';
  if (actionLog) {
    if (actionLog.message.includes('fielded')) actionTaken = 'field';
    else if (actionLog.message.includes('fortified')) actionTaken = 'fortify';
    else if (actionLog.message.includes('raided')) actionTaken = 'raid';
    else if (actionLog.message.includes('persuaded')) actionTaken = 'persuade';
    else if (actionLog.message.includes('brought')) actionTaken = 'bring-to-power';
    else if (actionLog.message.includes('assassinated')) actionTaken = 'assassinate';
    else if (actionLog.message.includes('threatened')) actionTaken = 'threaten';
    else if (actionLog.message.includes('attacked') || actionLog.message.includes('destroyed fort')) actionTaken = 'battle';
  }
  
  // Analyze decision quality
  let analysis = null;
  
  // Check for potential issues
  
  // Issue: Could have persuaded to activate alliance but didn't
  if (isSoldier && cardSuit === mySuits[1] && !myState.alliance.isActive) {
    const wouldActivate = (myState.alliance.persuasion || 0) + numValue >= 20;
    if (wouldActivate && actionTaken !== 'persuade') {
      analysis = {
        type: 'MISSED_ALLIANCE_ACTIVATION',
        detail: `Could have activated alliance with ${card} (${myState.alliance.persuasion}+${numValue}=20+) but chose ${actionTaken}`,
        severity: 'HIGH'
      };
    }
  }
  
  // Issue: Has royals but no fortification, drew matching soldier but didn't fortify
  if (isSoldier && mySuits.includes(cardSuit)) {
    const castle = cardSuit === mySuits[0] ? myState.primary : myState.alliance;
    if (castle && castle.royals && castle.royals.length > 0 && !castle.fortification) {
      if (actionTaken !== 'fortify' && actionTaken !== 'raid' && actionTaken !== 'battle') {
        // Check if there was a better reason
        const enemyRoyals = [...(enemyState.primary.royals || []), ...(enemyState.alliance.royals || [])];
        if (enemyRoyals.length === 0 || actionTaken !== 'assassinate') {
          analysis = {
            type: 'UNPROTECTED_ROYALS',
            detail: `Has ${castle.royals.join(',')} in ${cardSuit} castle with no fort, drew ${card} but chose ${actionTaken}`,
            severity: 'MEDIUM'
          };
        }
      }
    }
  }
  
  // Issue: Drew royal, have active castle, but enemy has lots of royals to assassinate first?
  if (isRoyal && mySuits.includes(cardSuit)) {
    const enemyRoyals = [...(enemyState.primary.royals || []), ...(enemyState.alliance.royals || [])];
    // This is fine - royals are valuable to place
  }
  
  // Issue: Raided without royals (no permanent damage)
  if (actionTaken === 'raid' && actionLog && actionLog.message.includes('no damage')) {
    analysis = {
      type: 'USELESS_RAID',
      detail: `Raided but dealt no permanent damage (no royals in attacking castle)`,
      severity: 'HIGH'
    };
  }
  
  // Issue: Fielded a high-value card when could have used it
  if (actionTaken === 'field' && isSoldier && numValue >= 8) {
    // Check if there were better options
    const couldFortify = mySuits.includes(cardSuit);
    const couldPersuade = cardSuit === mySuits[1] && !myState.alliance.isActive;
    const wouldActivate = couldPersuade && (myState.alliance.persuasion || 0) + numValue >= 20;
    
    if (wouldActivate) {
      analysis = {
        type: 'WASTED_HIGH_CARD',
        detail: `Fielded ${card} (value ${numValue}) when it would have activated alliance!`,
        severity: 'HIGH'
      };
    }
  }
  
  // Print detailed analysis for first 20 turns or any turn with issues
  const showDetail = turnCount <= 20 || analysis;
  
  if (showDetail) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`TURN ${turnCount}: ${turnKey} - ${playerName} (P${player})`);
    console.log('─'.repeat(80));
    
    console.log(`Age: ${state.age} | Deck: ${state.deckSize}`);
    console.log(`Field: [${state.fieldPiles.map(p => p || '∅').join('] [')}]`);
    
    console.log(`\n${playerName}'s Castles:`);
    const pri = player === 1 ? state.p1.primary : state.p2.primary;
    const ali = player === 1 ? state.p1.alliance : state.p2.alliance;
    console.log(`  Primary (${mySuits[0]}): royals=[${pri.royals?.join(',')||'none'}] fort=${pri.fortification||'none'} dmg=${pri.permanentDamage}/20`);
    console.log(`  Alliance (${mySuits[1]}): ${ali.isActive ? 'ACTIVE' : `persuasion=${ali.persuasion||0}/20`} royals=[${ali.royals?.join(',')||'none'}]`);
    
    console.log(`\nEnemy Castles:`);
    const ePri = player === 1 ? state.p2.primary : state.p1.primary;
    const eAli = player === 1 ? state.p2.alliance : state.p1.alliance;
    console.log(`  Primary (${enemySuits[0]}): royals=[${ePri.royals?.join(',')||'none'}] fort=${ePri.fortification||'none'} dmg=${ePri.permanentDamage}/20`);
    console.log(`  Alliance (${enemySuits[1]}): ${eAli.isActive ? 'ACTIVE' : `persuasion=${eAli.persuasion||0}/20`} royals=[${eAli.royals?.join(',')||'none'}]`);
    
    console.log(`\n📥 Drew: ${card}`);
    console.log(`📤 Action: ${actionLog ? actionLog.message : 'unknown'}`);
    
    if (analysis) {
      console.log(`\n⚠️  ISSUE: ${analysis.type} [${analysis.severity}]`);
      console.log(`   ${analysis.detail}`);
      issues.push({ turn: turnKey, ...analysis });
    } else if (turnCount <= 20) {
      console.log(`\n✓ Decision looks reasonable`);
    }
  }
}

// Summary
console.log(`\n\n${'═'.repeat(80)}`);
console.log('ANALYSIS SUMMARY');
console.log('═'.repeat(80));
console.log(`Total turns analyzed: ${turnCount}`);
console.log(`Issues found: ${issues.length}`);

if (issues.length > 0) {
  console.log('\nIssue breakdown:');
  const byType = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }
}

console.log('\n' + '═'.repeat(80));
