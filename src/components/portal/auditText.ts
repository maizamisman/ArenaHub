import type { AuditRow } from "@/data/audit";

const STATUS: Record<string, string> = { upcoming: "Upcoming", live: "Live", paused: "Paused", half_time: "Half Time", full_time: "Full Time" };
const ACTIONS: Record<string, string> = {
  password_changed: "changed their password", pic_create: "created a PIC account", pic_update: "edited a PIC", pic_password_reset: "reset a PIC password",
  pic_activate: "activated a PIC", pic_deactivate: "deactivated a PIC", assignments: "changed PIC assignments", settings: "changed Screen Configuration",
  sport_create: "added a sport", sport_update: "edited a sport", sport_delete: "deleted a sport", medal_rules: "changed scoring rules",
  team_create: "added a team", team_update: "edited a team", team_delete: "deleted a team", court_create: "added a court", court_update: "edited a court", court_delete: "deleted a court",
  match_create: "created a match", match_update: "edited a match", match_delete: "deleted a match", medal_result_create: "recorded a medal result",
  medal_result_update: "changed a medal result", medal_result_delete: "deleted a medal result", bracket_create: "created a bracket", bracket_clear: "cleared a bracket",
  bracket_slot: "changed match mapping", announcement_create: "published an announcement", announcement_update: "edited an announcement", announcement_delete: "deleted an announcement",
  photo_approve: "approved a photo", photo_remove: "removed a photo", photo_restore: "put a photo back", advance: "moved a winner to the next round", event: "added a match event",
};

/** One readable line for an audit row, e.g. "updated UM Laut vs UMT Laut to 3-1". */
export function describeAudit(a: AuditRow): string {
  const b = a.before ? JSON.parse(a.before) : {};
  const x = a.after ? JSON.parse(a.after) : {};
  const sc = (o: { score_a?: number; score_b?: number }) => `${o.score_a}-${o.score_b}`;
  const on = a.match ? ` ${a.match}` : "";
  switch (a.action) {
    case "score_delta": return `updated${on} to ${sc(x)}`;
    case "score_correct": return `corrected${on} from ${sc(b)} to ${sc(x)}`;
    case "score_undo": return `undid a change on${on}, now ${sc(x)}`;
    case "status": return `set${on} to ${STATUS[x.status] ?? x.status}`;
    case "reopen": return `reopened${on}`;
    default: return `${ACTIONS[a.action] ?? a.action}${on && a.action.startsWith("match") ? `:${on}` : ""}`;
  }
}
