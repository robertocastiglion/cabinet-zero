#!/usr/bin/env node
/**
 * Cabinet Zero — Agent Loop
 *
 * Orchestrates three Claude agents to design, build, and review a new game:
 *   1. Architect  (claude-opus-4-8  or claude-sonnet-4-6) — designs the game
 *   2. Executor   (claude-haiku-4-5-20251001)              — implements the code
 *   3. Reviewer   (claude-sonnet-4-6)                      — QA + quality gate
 *
 * Each agent reads/writes CLAUDE.MD as shared state bus.
 * Loop ends when Reviewer writes APPROVED or max iterations reached.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/game-loop.mjs [--brief "brief text"] [--max-iter 3]
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const client = new Anthropic({ apiKey: API_KEY });

// ── models ───────────────────────────────────────────────────────────────────
const MODELS = {
  architect: 'claude-sonnet-4-6',   // upgrade to claude-opus-4-8 for better designs
  executor:  'claude-haiku-4-5-20251001',
  reviewer:  'claude-sonnet-4-6',
};

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const briefArg = args.includes('--brief') ? args[args.indexOf('--brief') + 1] : null;
const maxIter  = args.includes('--max-iter') ? parseInt(args[args.indexOf('--max-iter') + 1] ?? '3', 10) : 3;

function readFile(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readPrompt(name) {
  return readFileSync(`prompts/${name}.md`, 'utf8');
}

function readContext() {
  return {
    claudeMd:   readFile('CLAUDE.MD'),
    engineTypes: readFile('src/engine/types.ts'),
    catalog:    readFile('src/catalog.ts'),
    gameBrief:  readFile('GAMEBRIEF.md'),
    decisions:  readFile('DECISIONS.md'),
  };
}

// ── call Claude with tool: write_file ─────────────────────────────────────────
async function callAgent({ role, model, systemPrompt, userMessage, maxTokens = 8096 }) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${role.toUpperCase()} [${model}]`);
  console.log('─'.repeat(60));

  const tools = [
    {
      name: 'write_file',
      description: 'Write or overwrite a file in the project. Use this to create/update source files and CLAUDE.MD.',
      input_schema: {
        type: 'object',
        properties: {
          path:    { type: 'string', description: 'Relative file path from project root' },
          content: { type: 'string', description: 'Full file content' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'read_file',
      description: 'Read a file from the project.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
    },
    {
      name: 'run_command',
      description: 'Run a shell command (typecheck, test, build, legal-lint). Only these commands are allowed.',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            enum: [
              '.\\node_modules\\.bin\\tsc --noEmit',
              '.\\node_modules\\.bin\\vitest run',
              'node scripts/legal-lint.mjs',
              '.\\node_modules\\.bin\\vite build',
            ],
          },
        },
        required: ['command'],
      },
    },
  ];

  const messages = [{ role: 'user', content: userMessage }];
  let response;
  let iterations = 0;

  while (true) {
    iterations++;
    if (iterations > 20) { console.error('Too many tool iterations'); break; }

    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools,
      messages,
    });

    // collect text output
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        process.stdout.write(block.text);
      }
    }

    if (response.stop_reason !== 'tool_use') break;

    // handle tool calls
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let result = '';

      if (block.name === 'write_file') {
        const { path, content } = block.input;
        // safety: only allow writing inside project, block secrets
        if (path.includes('..') || path.includes('.env') || path.includes('.dev.vars')) {
          result = `ERROR: path "${path}" is not allowed`;
        } else {
          // ensure parent dirs exist (simple)
          const parts = path.split('/');
          if (parts.length > 1) {
            try {
              execSync(`mkdir -p "${parts.slice(0, -1).join('/')}"`, { stdio: 'ignore' });
            } catch { /* Windows fallback */ }
          }
          writeFileSync(path, content, 'utf8');
          result = `OK: wrote ${content.length} chars to ${path}`;
          console.log(`\n  📝 write: ${path}`);
        }
      } else if (block.name === 'read_file') {
        const { path } = block.input;
        result = readFile(path) || `ERROR: file not found: ${path}`;
      } else if (block.name === 'run_command') {
        const { command } = block.input;
        console.log(`\n  ⚙  run: ${command}`);
        try {
          result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
          console.log(`  ✅ OK`);
        } catch (e) {
          result = `EXIT ${e.status}\nSTDOUT: ${e.stdout}\nSTDERR: ${e.stderr}`;
          console.log(`  ❌ FAIL`);
        }
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }

  return response;
}

// ── extract iteration status from CLAUDE.MD ───────────────────────────────────
function getIterationStatus() {
  const md = readFile('CLAUDE.MD');
  const m = md.match(/ITERATION_STATUS:\s*(\w+)/);
  return m?.[1] ?? 'UNKNOWN';
}

// ── main loop ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🕹  CABINET ZERO — AGENT LOOP');
  console.log(`   max iterations: ${maxIter}`);
  console.log(`   architect: ${MODELS.architect}`);
  console.log(`   executor:  ${MODELS.executor}`);
  console.log(`   reviewer:  ${MODELS.reviewer}`);

  const ctx = readContext();
  const architectPrompt = readPrompt('architect');
  const executorPrompt  = readPrompt('executor');
  const reviewerPrompt  = readPrompt('reviewer');

  // ── FASE 1: Architect designs the game ──────────────────────────────────────
  await callAgent({
    role: 'architect',
    model: MODELS.architect,
    systemPrompt: architectPrompt,
    userMessage: [
      briefArg ? `User brief:\n${briefArg}\n\n` : '',
      'Current CLAUDE.MD:\n```\n', ctx.claudeMd, '\n```\n\n',
      'Current catalog:\n```ts\n', ctx.catalog, '\n```\n\n',
      'Design a new original arcade game. Update CLAUDE.MD [PROSSIMO TASK] and [NOTE DI PASSAGGIO] with the architecture. Then stop.',
    ].join(''),
  });

  // ── FASE 2+3: Executor implements → Reviewer approves (loop) ───────────────
  for (let i = 1; i <= maxIter; i++) {
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log(`ITERATION ${i}/${maxIter}`);
    console.log('═'.repeat(60));

    // Executor
    const freshCtx = readContext();
    await callAgent({
      role: 'executor',
      model: MODELS.executor,
      systemPrompt: executorPrompt,
      userMessage: [
        `Iteration ${i}. Implement the game described in CLAUDE.MD.\n\n`,
        'CLAUDE.MD:\n```\n', freshCtx.claudeMd, '\n```\n\n',
        'Follow the steps in [PROSSIMO TASK] and [NOTE DI PASSAGGIO] exactly. Write files, run tests, report result.',
      ].join(''),
    });

    // Reviewer
    const afterExecCtx = readContext();
    await callAgent({
      role: 'reviewer',
      model: MODELS.reviewer,
      systemPrompt: reviewerPrompt,
      userMessage: [
        `Iteration ${i}. Review the implementation.\n\n`,
        'CLAUDE.MD:\n```\n', afterExecCtx.claudeMd, '\n```\n\n',
        'Run the verification commands. Check quality. Write REPORT VERIFICA with ITERATION_STATUS.',
      ].join(''),
    });

    const status = getIterationStatus();
    console.log(`\n\n  ► ITERATION_STATUS: ${status}`);

    if (status === 'APPROVED') {
      console.log('\n✅  GAME APPROVED — PR created (or ready to push)');
      break;
    }
    if (i === maxIter) {
      console.log('\n⚠️   Max iterations reached without approval. Review CLAUDE.MD manually.');
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
