"use server";

import { getSessionUser } from "@/auth/request";
import { checkAccess } from "@/auth/guard";
import {
  applyScoreDelta, setStatus, correctScore, undoLast, addEvent, reopenMatch, getPublicMatch, matchLog,
  ForbiddenError, RuleError, type EventKind, type LogLine, type PublicMatch,
} from "@/data/matches";
import type { SessionUser, Side } from "@/domain/types";

export type MatchResult = { ok: true; match: PublicMatch; log: LogLine[] } | { ok: false; error: string };

/** Runs one command as the signed-in staff member and turns rule failures into messages. */
async function run(matchId: string, fn: (u: SessionUser) => unknown): Promise<MatchResult> {
  const user = await getSessionUser();
  if (checkAccess(user, "staff") !== "ok") return { ok: false, error: "Your session has ended. Sign in again." };
  try {
    fn(user!);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof RuleError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true, match: getPublicMatch(matchId)!, log: matchLog(matchId) };
}

export async function scoreDelta(matchId: string, side: Side, delta: 1 | -1, requestId: string) {
  return run(matchId, (u) => applyScoreDelta(u, matchId, side, delta, requestId));
}

export async function changeStatus(matchId: string, to: "live" | "paused" | "half_time" | "full_time", opts: { winner?: string; reason?: string } = {}) {
  return run(matchId, (u) => setStatus(u, matchId, to, opts));
}

export async function correct(matchId: string, scoreA: number, scoreB: number, reason: string) {
  return run(matchId, (u) => correctScore(u, matchId, scoreA, scoreB, reason));
}

export async function undo(matchId: string) {
  return run(matchId, (u) => undoLast(u, matchId));
}

export async function addMatchEvent(matchId: string, e: { kind: EventKind; team?: string | null; detail: string; minuteLabel: string }) {
  return run(matchId, (u) => addEvent(u, matchId, e));
}

export async function reopen(matchId: string, reason: string) {
  return run(matchId, (u) => reopenMatch(u, matchId, reason));
}
