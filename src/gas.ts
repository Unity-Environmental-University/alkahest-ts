/**
 * Ideal gas law for repositories.
 *
 * PV = nRT
 *
 *   P — pressure: accumulated age × uncertainty (days since last commit, unresolved edges)
 *   V — volume:   number of files touched (surface area of the work)
 *   n — amount:   lines of code changed (density of the substance)
 *   R — constant: calibrated per repo from known-good states
 *   T — temperature: activity rate (commits per day, recent window)
 *
 * Derived:
 *   R = PV / nT          (solve for R given a known state)
 *   phase = f(P, T)      (volatile: high P or T; salt: low P, stable T)
 *
 * T maps directly onto ThermalNode.temperature.
 * P is the new quantity — thermodynamic pressure, not just heat.
 *
 * Physical intuition:
 *   - Dense code in few files (high n, low V) → high pressure per unit volume
 *   - Spread thin (low n, high V) → low pressure, diffuse, may not cook
 *   - Right ratio + right temperature → fluid, cooking, ready to transition
 *   - Pressure relief = commit. The valve opens. Salt precipitates.
 */

import type { PhaseMarker } from "./thermal.js"

export interface GasState {
  /** Days since last commit (primary pressure driver) */
  daysSinceCommit: number
  /** Unresolved edges or open questions (secondary pressure) */
  unresolvedCount: number
  /** Number of files with uncommitted changes */
  fileCount: number
  /** Lines added + deleted in working tree */
  lineCount: number
  /** Commits per day over recent window (default: 7 days) */
  activityRate: number
}

export interface GasReading {
  P: number   // pressure
  V: number   // volume
  n: number   // amount
  T: number   // temperature
  R: number   // constant (PV/nT)
  phase: PhaseMarker
  /** Human-readable diagnosis */
  diagnosis: string
}

/**
 * Compute pressure from age and unresolved state.
 * Pressure accumulates nonlinearly with age — a week-old change
 * is more than 7× the pressure of a one-day change.
 */
function computePressure(daysSinceCommit: number, unresolvedCount: number): number {
  const agePressure = Math.pow(daysSinceCommit + 1, 1.4)
  const uncertaintyPressure = unresolvedCount * 0.5
  return agePressure + uncertaintyPressure
}

/**
 * Solve PV = nRT for phase and R.
 *
 * R is the repo's characteristic constant — calibrate by calling this
 * on a known-good fluid state and storing the result.
 */
export function readGas(state: GasState, knownR?: number): GasReading {
  const P = computePressure(state.daysSinceCommit, state.unresolvedCount)
  const V = Math.max(state.fileCount, 1)
  const n = Math.max(state.lineCount, 1)
  const T = Math.max(state.activityRate, 0.01)

  const R = (P * V) / (n * T)

  // Phase from pressure and temperature together
  const phase = classifyPhase(P, T, knownR ?? R)

  const diagnosis = diagnose(state, P, V, n, T, phase)

  return { P, V, n, T, R, phase, diagnosis }
}

function classifyPhase(P: number, T: number, R: number): PhaseMarker {
  // High pressure or very high temperature → volatile (gas)
  if (P > 40 || T > 5) return "volatile"
  // Low pressure, moderate temperature → salt (solid, ready)
  if (P < 8 && T < 2) return "salt"
  // In between → fluid (liquid, cooking)
  return "fluid"
}

function diagnose(
  state: GasState,
  P: number,
  V: number,
  n: number,
  T: number,
  phase: PhaseMarker,
): string {
  const lines: string[] = []

  if (phase === "volatile") {
    if (state.daysSinceCommit > 14) lines.push(`${state.daysSinceCommit}d without a commit — pressure is high`)
    if (T > 5) lines.push(`high activity rate (${T.toFixed(1)} commits/day) without commits landing`)
    if (n / V > 200) lines.push(`dense — ${Math.round(n/V)} lines/file — small container, high pressure`)
  } else if (phase === "fluid") {
    lines.push(`cooking — P=${P.toFixed(1)}, T=${T.toFixed(2)}, ratio healthy`)
    if (n / V < 20) lines.push(`spread thin (${Math.round(n/V)} lines/file) — may need consolidation`)
  } else {
    lines.push(`ready to precipitate — low pressure, stable temperature`)
    lines.push(`open the channel`)
  }

  return lines.join(". ")
}

/**
 * Read gas state directly from a git repo.
 * Requires git CLI available.
 */
export async function readRepoGas(repoPath: string, knownR?: number): Promise<GasReading> {
  const { execSync } = await import("child_process")
  const exec = (cmd: string) => execSync(cmd, { cwd: repoPath, encoding: "utf8" }).trim()

  // Days since last commit
  const lastCommitTs = parseInt(exec(`git log -1 --format=%ct`), 10)
  const daysSinceCommit = (Date.now() / 1000 - lastCommitTs) / 86400

  // Files and lines changed in working tree
  const diffStat = exec(`git diff --shortstat HEAD 2>/dev/null || echo ""`)
  const filesMatch = diffStat.match(/(\d+) file/)
  const insertMatch = diffStat.match(/(\d+) insertion/)
  const deleteMatch = diffStat.match(/(\d+) deletion/)
  const fileCount = filesMatch ? parseInt(filesMatch[1], 10) : 0
  const lineCount = (insertMatch ? parseInt(insertMatch[1], 10) : 0)
                  + (deleteMatch ? parseInt(deleteMatch[1], 10) : 0)

  // Activity rate: commits in last 7 days / 7
  const recentLog = exec(`git log --oneline --since="7 days ago" | wc -l`)
  const activityRate = parseInt(recentLog, 10) / 7

  const state: GasState = {
    daysSinceCommit,
    unresolvedCount: 0, // caller can inject from rhizome-alkahest
    fileCount,
    lineCount,
    activityRate,
  }

  return readGas(state, knownR)
}
