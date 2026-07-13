#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Scan only actual game code + public assets + ASSETS.md.
// Deliberately excludes: scripts/, tests/, *.test.ts — they legitimately reference
// IP names (blocklist definition, negative test cases, etc.).
const TARGETS = ['src/games', 'public', 'ASSETS.md'];

const BLOCKLIST = [
  'pac-man','pacman','tetris','space invaders','donkey kong','galaga',
  'asteroids','frogger','mario','sonic','street fighter','arkanoid',
  'breakout','centipede','defender','pong','nintendo','sega','atari',
  'konami','capcom','namco','taito','mame','emulator',
];

// "rom" is 3 chars — use word boundary to avoid matching "from", "chrome", "random"
const ROM_RE = /\brom\b/i;

let files;
try {
  files = execSync(`git ls-files ${TARGETS.join(' ')}`, { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.js'));
} catch {
  files = [];
}

let violations = 0;
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); }
  catch { continue; }

  const lower = text.toLowerCase();

  for (const term of BLOCKLIST) {
    if (lower.includes(term)) {
      console.error(`❌  ${f}: riferimento vietato "${term}"`);
      violations++;
    }
  }

  if (ROM_RE.test(lower)) {
    console.error(`❌  ${f}: riferimento vietato "rom"`);
    violations++;
  }
}

if (violations === 0) {
  console.log('✅  legal-lint: nessuna violazione trovata');
}
process.exit(violations ? 1 : 0);
