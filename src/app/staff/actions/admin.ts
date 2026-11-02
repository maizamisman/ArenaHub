"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/auth/request";
import { checkAccess } from "@/auth/guard";
import { ForbiddenError, RuleError } from "@/data/matches";
import * as catalog from "@/data/catalog";
import * as people from "@/data/people";
import * as content from "@/data/content";
import { saveSettings, type Settings } from "@/data/settings";
import { saveLogo } from "@/data/logo";
import type { SessionUser } from "@/domain/types";

type Values = Record<string, string | number | boolean | string[] | null>;
type Result = { ok: true; message?: string; reveal?: string } | { ok: false; error: string };

async function adminRun(fn: (me: SessionUser) => void | { message?: string; reveal?: string }, message = "Saved."): Promise<Result> {
  const me = await getSessionUser();
  if (checkAccess(me, "admin") !== "ok") return { ok: false, error: "Only the Admin can do this. Sign in again if your session has ended." };
  try {
    const out = fn(me!) || {};
    revalidatePath("/", "layout");
    return { ok: true, message: out.message ?? message, reveal: out.reveal };
  } catch (e) {
    if (e instanceof RuleError || e instanceof ForbiddenError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const s = (v: unknown) => (v == null ? "" : String(v));
const b = (v: unknown) => v === true || v === "true" || v === "on";
/** datetime-local values are Malaysia time (UTC+8). */
const myt = (v: unknown) => (s(v) ? new Date(`${s(v)}:00+08:00`).toISOString() : "");

export async function saveSportAction(id: string | null, v: Values) {
  return adminRun((me) => { catalog.saveSport(me, { id: id ?? undefined, name: s(v.name), name_bm: s(v.name_bm), format: s(v.format), scoring: s(v.scoring), active: b(v.active), sort: Number(v.sort) || 0 }); }, "Sport saved.");
}
export async function deleteSportAction(id: string) { return adminRun((me) => { catalog.deleteSport(me, id); }, "Sport deleted."); }
export async function saveMedalRulesAction(sportId: string, rules: { round: string; medal: "gold" | "silver" | "bronze"; outcome: "winner" | "loser" }[]) {
  return adminRun((me) => { catalog.saveMedalRules(me, sportId, rules); }, "Scoring rules saved.");
}

export async function saveTeamAction(id: string | null, v: Values) {
  return adminRun((me) => { catalog.saveTeam(me, { id: id ?? undefined, short_name: s(v.short_name), institution: s(v.institution), manager: s(v.manager), active: b(v.active) }); }, "Team saved.");
}
export async function deleteTeamAction(id: string) { return adminRun((me) => { catalog.deleteTeam(me, id); }, "Team deleted."); }

export async function saveCourtAction(id: string | null, v: Values) {
  return adminRun((me) => { catalog.saveCourt(me, { id: id ?? undefined, name: s(v.name), name_bm: s(v.name_bm), lat: Number(v.lat), lng: Number(v.lng), notes: s(v.notes) }); }, "Court saved.");
}
export async function deleteCourtAction(id: string) { return adminRun((me) => { catalog.deleteCourt(me, id); }, "Court deleted."); }

export async function saveMatchAction(id: string | null, v: Values) {
  return adminRun((me) => {
    const m = catalog.saveMatch(me, { id: id ?? undefined, sport_id: s(v.sport_id), round: s(v.round), group_name: s(v.group_name) || null, team_a: s(v.team_a) || null, team_b: s(v.team_b) || null, court_id: s(v.court_id), starts_at: myt(v.starts_at) });
    const pic = s(v.pic);
    if (pic) {
      const cur = people.listPics().find((p) => p.id === pic);
      if (cur && !cur.matchIds.includes(m.id)) people.setAssignments(me, pic, { matchIds: [...cur.matchIds, m.id], courtIds: cur.courtIds });
    }
  }, "Match saved.");
}
export async function deleteMatchAction(id: string) { return adminRun((me) => { catalog.deleteMatch(me, id); }, "Match deleted."); }

export async function saveMedalResultAction(id: string | null, v: Values) {
  return adminRun((me) => { catalog.saveMedalResult(me, { id: id ?? undefined, sport_id: s(v.sport_id), event_name: s(v.event_name), gold: s(v.gold) || null, silver: s(v.silver) || null, bronze: s(v.bronze) || null }); }, "Result saved. Standings are updated.");
}
export async function deleteMedalResultAction(id: string) { return adminRun((me) => { catalog.deleteMedalResult(me, id); }, "Result deleted."); }

export async function createBracketAction(sportId: string, firstRound: number) { return adminRun((me) => { catalog.createBracket(me, sportId, firstRound); }, "Bracket created."); }
export async function clearBracketAction(sportId: string) { return adminRun((me) => { catalog.clearBracket(me, sportId); }, "Bracket cleared."); }
export async function setSlotMatchAction(slotId: string, matchId: string | null) { return adminRun((me) => { catalog.setSlotMatch(me, slotId, matchId); }, "Bracket updated."); }

export async function savePicAction(id: string | null, v: Values) {
  return adminRun((me) => {
    if (id) {
      people.updatePic(me, id, { name: s(v.name), email: s(v.email) });
      people.setAssignments(me, id, { matchIds: (v.matchIds as string[]) ?? [], courtIds: (v.courtIds as string[]) ?? [] });
      return { message: "PIC saved." };
    }
    const { id: newId, tempPassword } = people.createPic(me, { name: s(v.name), email: s(v.email) });
    people.setAssignments(me, newId, { matchIds: (v.matchIds as string[]) ?? [], courtIds: (v.courtIds as string[]) ?? [] });
    return { message: "PIC account created.", reveal: tempPassword };
  });
}
export async function resetPicPasswordAction(id: string) {
  return adminRun((me) => ({ message: "Password reset.", reveal: people.resetPicPassword(me, id).tempPassword }));
}
export async function deactivatePicAction(id: string) { return adminRun((me) => { people.setPicActive(me, id, false); }, "PIC deactivated and signed out."); }
export async function activatePicAction(id: string) { return adminRun((me) => { people.setPicActive(me, id, true); }, "PIC activated."); }

export async function saveAnnouncementAction(id: string | null, v: Values) {
  return adminRun((me) => { content.saveAnnouncement(me, { id: id ?? undefined, title: s(v.title), body: s(v.body), lang: s(v.lang), published: b(v.published) }); }, "Announcement saved.");
}
export async function deleteAnnouncementAction(id: string) { return adminRun((me) => { content.deleteAnnouncement(me, id); }, "Announcement deleted."); }

export async function saveSettingsAction(patch: Partial<Settings>) {
  return adminRun((me) => { saveSettings(me, patch); }, "Settings saved. The public website is updated.");
}

export async function uploadLogoAction(form: FormData) {
  const file = form.get("logo");
  if (!(file instanceof Blob)) return { ok: false as const, error: "Choose an image first." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return adminRun((me) => { saveLogo(me, bytes); }, "Logo updated.");
}
