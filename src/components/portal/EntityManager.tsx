"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Dialog, useToast } from "./PortalShell";

export type Result = { ok: true; message?: string; reveal?: string } | { ok: false; error: string };
export type Field = {
  key: string; label: string; type: "text" | "number" | "select" | "checkbox" | "datetime" | "textarea" | "multiselect";
  options?: { value: string; label: string }[]; required?: boolean; hint?: string; step?: string; full?: boolean;
};
export type Column = { key: string; label: string; strong?: boolean; sub?: string; pill?: boolean };
export type Row = { id: string; values: Record<string, string | number | boolean | string[] | null>; display: Record<string, string>; canDelete?: boolean; links?: { label: string; href: string }[] };

/** Table with search, filters and sorting, plus add/edit dialogs and delete confirmation. */
export function EntityManager({ noun, rows, columns, fields, filters = [], blank, save, remove, searchPlaceholder, extra }: {
  noun: string; rows: Row[]; columns: Column[]; fields: Field[]; blank: Row["values"];
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  save: (id: string | null, values: Row["values"]) => Promise<Result>;
  remove?: (id: string) => Promise<Result>;
  searchPlaceholder?: string;
  extra?: { label: string; action: (id: string) => Promise<Result>; confirm?: string; when?: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: columns[0].key, dir: 1 });
  const [edit, setEdit] = useState<{ id: string | null; values: Row["values"] } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [confirmExtra, setConfirmExtra] = useState<{ row: Row; i: number } | null>(null);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => !needle || Object.values(r.display).join(" ").toLowerCase().includes(needle))
      .filter((r) => Object.entries(f).every(([k, v]) => !v || String(r.values[k]) === v))
      .sort((a, b) => String(a.display[sort.key] ?? "").localeCompare(String(b.display[sort.key] ?? ""), undefined, { numeric: true }) * sort.dir);
  }, [rows, q, f, sort]);

  async function done(r: Result, close: () => void) {
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    close();
    setError("");
    if (r.reveal) setReveal(r.reveal);
    toast(r.message ?? "Saved.");
    router.refresh();
  }

  return (
    <>
      <div className="tools">
        <input className="inp srch" type="search" placeholder={searchPlaceholder ?? `Search ${noun.toLowerCase()}s`} aria-label={`Search ${noun.toLowerCase()}s`} value={q} onChange={(e) => setQ(e.target.value)} />
        {filters.map((fl) => (
          <select key={fl.key} className="inp" aria-label={fl.label} value={f[fl.key] ?? ""} onChange={(e) => setF({ ...f, [fl.key]: e.target.value })}>
            <option value="">{fl.label}: all</option>
            {fl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        <button className="btn p" onClick={() => { setError(""); setEdit({ id: null, values: { ...blank } }); }}>Add {noun.toLowerCase()}</button>
      </div>
      <div className="twrap">
        <table>
          <thead><tr>
            {columns.map((c) => (
              <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button className={`sb${sort.key === c.key ? " on" : ""}`} onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? (sort.dir === 1 ? -1 : 1) : 1 })}>
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
            <th><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.key} className={c.strong ? "w" : undefined} data-l={c.label}>
                    {c.pill ? <span className={`pill st-${String(r.values[c.key] ?? r.display[c.key]).toLowerCase().replace(/ /g, "_")}`}>{r.display[c.key]}</span> : r.display[c.key]}
                    {c.sub && r.display[c.sub] ? <small>{r.display[c.sub]}</small> : null}
                  </td>
                ))}
                <td className="a"><div className="acts">
                  {r.links?.map((l) => <a key={l.href} className="btn s sm" href={l.href}>{l.label}</a>)}
                  {extra?.filter((x) => !x.when || r.values[x.when]).map((x) => (
                    <button key={x.label} className="btn s sm" onClick={() => setConfirmExtra({ row: r, i: extra.indexOf(x) })}>{x.label}</button>
                  ))}
                  <button className="btn s sm" onClick={() => { setError(""); setEdit({ id: r.id, values: { ...r.values } }); }}>Edit</button>
                  {remove && r.canDelete !== false && <button className="btn dl sm" onClick={() => { setError(""); setDel(r); }}>Delete</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <div className="none">Nothing matches. Clear the search or filters.</div>}
      </div>

      {edit && (
        <Dialog title={`${edit.id ? "Edit" : "Add"} ${noun.toLowerCase()}`} onClose={() => setEdit(null)}
          footer={<><button className="btn s" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn p" disabled={busy} onClick={async () => { setBusy(true); done(await save(edit.id, edit.values), () => setEdit(null)); }}>Save</button></>}>
          <form className="g-f" onSubmit={(e) => e.preventDefault()}>
            {fields.map((fd) => <FieldInput key={fd.key} f={fd} value={edit.values[fd.key]} onChange={(v) => setEdit({ ...edit, values: { ...edit.values, [fd.key]: v } })} />)}
          </form>
          {error && <div className="err" role="alert">{error}</div>}
        </Dialog>
      )}
      {del && remove && (
        <Dialog title={`Delete ${noun.toLowerCase()}?`} alert onClose={() => setDel(null)}
          footer={<><button className="btn s" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn d" disabled={busy} onClick={async () => { setBusy(true); done(await remove(del.id), () => setDel(null)); }}>Delete</button></>}>
          <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>Delete <b>{Object.values(del.display)[0]}</b>? This cannot be undone. It is saved in the Audit Log.</p>
          {error && <div className="err" role="alert">{error}</div>}
        </Dialog>
      )}
      {confirmExtra && extra && (
        <Dialog title={`${extra[confirmExtra.i].label}?`} alert onClose={() => setConfirmExtra(null)}
          footer={<><button className="btn s" onClick={() => setConfirmExtra(null)}>Cancel</button>
            <button className="btn p" disabled={busy} onClick={async () => { setBusy(true); done(await extra[confirmExtra.i].action(confirmExtra.row.id), () => setConfirmExtra(null)); }}>{extra[confirmExtra.i].label}</button></>}>
          <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>{extra[confirmExtra.i].confirm ?? "Are you sure?"} <b>{Object.values(confirmExtra.row.display)[0]}</b></p>
          {error && <div className="err" role="alert">{error}</div>}
        </Dialog>
      )}
      {reveal && (
        <Dialog title="Temporary password" onClose={() => setReveal("")} footer={<button className="btn p" onClick={() => setReveal("")}>Done</button>}>
          <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>Give this to the PIC privately. It is shown only once. They must choose their own password when they first sign in.</p>
          <div className="secret" data-testid="temp-password">{reveal}</div>
        </Dialog>
      )}
    </>
  );
}

export function FieldInput({ f, value, onChange }: { f: Field; value: Row["values"][string]; onChange: (v: Row["values"][string]) => void }) {
  const id = `f-${f.key}`;
  const span = f.full || f.type === "textarea" || f.type === "multiselect" ? { gridColumn: "1 / -1" } : undefined;
  if (f.type === "checkbox") {
    return <label className="ck" style={span}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />{f.label}</label>;
  }
  if (f.type === "multiselect") {
    const set = new Set((value as string[]) ?? []);
    return (
      <fieldset className="fld" style={{ ...span, border: 0, padding: 0, margin: 0 }}>
        <legend className="lab" style={{ marginBottom: 4 }}>{f.label}</legend>
        <div style={{ maxHeight: 220, overflow: "auto", border: "1.5px solid #B8C4D3", borderRadius: 8, padding: "4px 10px" }}>
          {f.options?.map((o) => (
            <label key={o.value} className="ck" style={{ minHeight: 40 }}>
              <input type="checkbox" checked={set.has(o.value)} onChange={(e) => { const n = new Set(set); if (e.target.checked) n.add(o.value); else n.delete(o.value); onChange([...n]); }} />{o.label}
            </label>
          ))}
        </div>
        {f.hint && <small>{f.hint}</small>}
      </fieldset>
    );
  }
  return (
    <div className="fld" style={span}>
      <label htmlFor={id}>{f.label}{f.required ? "" : " (optional)"}</label>
      {f.type === "select" ? (
        <select id={id} className="inp" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">None</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : f.type === "textarea" ? (
        <textarea id={id} className="inp" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="inp" type={f.type === "datetime" ? "datetime-local" : f.type} step={f.step} inputMode={f.type === "number" ? "decimal" : undefined}
          value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.hint && <small>{f.hint}</small>}
    </div>
  );
}
