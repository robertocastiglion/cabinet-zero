#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCKLIST = [
  'pac-man','pacman','tetris','space invaders','donkey kong','galaga',
  'asteroids','frogger','mario','sonic','street fighter','arkanoid',
  'breakout','centipede','defender','pong','nintendo','sega','atari',
  'konami','capcom','namco','taito','rom','mame','emulator',
];

let files;
try {
  files = execSync('git ls-files src public *.md scripts', { encoding: 'utf8' })
    .split('\n').filter(Boolean);
} catch {
  // fallback when not in a git repo (CI with shallow clone)
  files = [];
}

let violations = 0;
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8').toLowerCase(); }
  catch { continue; }

  for (const term of BLOCKLIST) {
    if (text.includes(term)) {
      console.error(`❌  ${f}: riferimento vietato "${term}"`);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log('✅  legal-lint: nessuna violazione trovata');
}
process.exit(violations ? 1 : 0);
