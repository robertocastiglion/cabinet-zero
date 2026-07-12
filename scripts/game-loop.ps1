<#
.SYNOPSIS
  Cabinet Zero — Agent Loop via Claude Code CLI

.DESCRIPTION
  Orchestrates three Claude Code sub-agents to design, build and review
  a new arcade game. No Anthropic API key needed — uses the claude CLI
  already running in this session.

  Loop:
    1. Architect  (Opus/Sonnet)  — designs, writes CLAUDE.MD [PROSSIMO TASK]
    2. Executor   (Haiku)        — implements sim.ts, index.ts, tests
    3. Reviewer   (Sonnet)       — QA gate; writes ITERATION_STATUS

.PARAMETER Brief
  Optional one-line brief for the Architect (genre, mechanic, feel).

.PARAMETER MaxIter
  Max Executor→Reviewer cycles before giving up (default: 3).

.PARAMETER ArchModel
  Claude model for Architect (default: claude-sonnet-4-6).
  Use "claude-opus-4-8" for best design quality.

.PARAMETER ExecModel
  Claude model for Executor (default: claude-haiku-4-5-20251001).

.PARAMETER RevModel
  Claude model for Reviewer (default: claude-sonnet-4-6).

.EXAMPLE
  # Free design, default models
  .\scripts\game-loop.ps1

  # With brief, Opus architect for best quality
  .\scripts\game-loop.ps1 -Brief "labirinto con inseguitori geometrici" -ArchModel "claude-opus-4-8"

  # Via pnpm
  pnpm game:new
#>
param(
    [string]$Brief    = "",
    [int]   $MaxIter  = 3,
    [string]$ArchModel = "claude-sonnet-4-6",
    [string]$ExecModel = "claude-haiku-4-5-20251001",
    [string]$RevModel  = "claude-sonnet-4-6"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── helpers ────────────────────────────────────────────────────────────────────
function Banner($text, $char = "─") {
    $line = $char * 60
    Write-Host "`n$line" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host $line -ForegroundColor Cyan
}

function ReadFile($path) {
    if (Test-Path $path) { return Get-Content $path -Raw -Encoding UTF8 }
    return ""
}

function GetStatus {
    $md = ReadFile "CLAUDE.MD"
    if ($md -match "ITERATION_STATUS:\s*(\w+)") { return $Matches[1] }
    return "UNKNOWN"
}

function RunAgent($role, $model, $systemFile, $userMessage) {
    Banner "$role  [$model]"

    $system  = ReadFile $systemFile
    $tmpUser = [System.IO.Path]::GetTempFileName()
    $tmpSys  = [System.IO.Path]::GetTempFileName()

    # Write prompt files (avoids arg-length limits on Windows)
    [System.IO.File]::WriteAllText($tmpSys,  $system,      [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($tmpUser, $userMessage, [System.Text.Encoding]::UTF8)

    try {
        # claude --dangerously-skip-permissions so the sub-agent can write files freely
        # --model sets the specific model for this sub-agent
        # -p sends the user message; system prompt via --system-prompt file
        $proc = Start-Process -FilePath "claude" `
            -ArgumentList @(
                "--dangerously-skip-permissions",
                "--model", $model,
                "--system-prompt", $tmpSys,
                "-p", (Get-Content $tmpUser -Raw)
            ) `
            -NoNewWindow -Wait -PassThru

        if ($proc.ExitCode -ne 0) {
            Write-Warning "Agent '$role' exited with code $($proc.ExitCode)"
        }
    } finally {
        Remove-Item $tmpUser, $tmpSys -ErrorAction SilentlyContinue
    }
}

# ── check claude CLI available ─────────────────────────────────────────────────
if (-not (Get-Command "claude" -ErrorAction SilentlyContinue)) {
    Write-Error "claude CLI not found. Make sure Claude Code is installed and 'claude' is in PATH."
    exit 1
}

# ── banner ─────────────────────────────────────────────────────────────────────
Banner "CABINET ZERO — AGENT LOOP" "═"
Write-Host "  Architect : $ArchModel"
Write-Host "  Executor  : $ExecModel"
Write-Host "  Reviewer  : $RevModel"
Write-Host "  Max iters : $MaxIter"
if ($Brief) { Write-Host "  Brief     : $Brief" -ForegroundColor Yellow }

# ── PHASE 1: Architect ─────────────────────────────────────────────────────────
$claudeMd = ReadFile "CLAUDE.MD"
$catalog  = ReadFile "src/catalog.ts"

$archMessage = @"
$(if ($Brief) { "User brief: $Brief`n`n" })
Current CLAUDE.MD:
``````
$claudeMd
``````

Current catalog:
``````ts
$catalog
``````

Design a new original arcade game that fits the COSTITUZIONE.
Update CLAUDE.MD sections [PROSSIMO TASK] and [NOTE DI PASSAGGIO] with
the full architecture (types, stepSim signature, 5 test specs, palette,
fun-factor reasoning). Then stop — do not implement code.
"@

RunAgent "ARCHITECT" $ArchModel "prompts/architect.md" $archMessage

# ── PHASE 2+3: Executor → Reviewer loop ───────────────────────────────────────
for ($iter = 1; $iter -le $MaxIter; $iter++) {
    Banner "ITERATION $iter / $MaxIter" "═"

    # ── Executor (Haiku — cheap and fast) ──────────────────────────────────────
    $claudeMd = ReadFile "CLAUDE.MD"

    $execMessage = @"
Iteration $iter.

CLAUDE.MD:
``````
$claudeMd
``````

Implement the game described in [PROSSIMO TASK] following [NOTE DI PASSAGGIO].
Write all files (sim.ts, sim.test.ts, index.ts, index.test.ts, catalog.ts entry).
Run the verification commands. Report result in [REPORT ESECUZIONE] with
ITERATION_STATUS: READY_FOR_REVIEW  or  ITERATION_STATUS: NEEDS_ARCHITECT.
"@

    RunAgent "EXECUTOR" $ExecModel "prompts/executor.md" $execMessage

    # ── Reviewer (Sonnet — quality gate) ──────────────────────────────────────
    $claudeMd = ReadFile "CLAUDE.MD"

    $revMessage = @"
Iteration $iter.

CLAUDE.MD:
``````
$claudeMd
``````

Review the implementation. Run all verification commands autonomously.
Check code quality (RNG, destroy, no IP refs, fun factor).
Write REPORT VERIFICA with ITERATION_STATUS: APPROVED or ITERATION_STATUS: BACK_TO_EXECUTOR.
If APPROVED also create the git branch and PR.
"@

    RunAgent "REVIEWER" $RevModel "prompts/reviewer.md" $revMessage

    # ── check exit condition ───────────────────────────────────────────────────
    $status = GetStatus
    Write-Host "`n  ► ITERATION_STATUS: $status" -ForegroundColor $(
        if ($status -eq "APPROVED") { "Green" } else { "Yellow" }
    )

    if ($status -eq "APPROVED") {
        Banner "GAME APPROVED — PR created" "✓"
        exit 0
    }

    if ($iter -eq $MaxIter) {
        Write-Warning "Max iterations reached without approval. Check CLAUDE.MD manually."
        exit 1
    }

    Write-Host "  → Looping back to Executor..." -ForegroundColor DarkCyan
}
