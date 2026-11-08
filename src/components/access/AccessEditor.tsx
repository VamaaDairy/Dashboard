"use client";

import { GROUPS, RESOURCES, type AccessMap, type Level } from "@/lib/access";

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };
const NAME: Record<Level, string> = { none: "No access", view: "View", edit: "Edit" };

/**
 * What someone may open, resource by resource, grouped like the access list. With `inherited` (a department's
 * access) it shows what that already gives, and the choices here only add to it.
 */
export function AccessEditor({ value, onChange, inherited, inheritedFrom }: {
  value: AccessMap;
  onChange: (next: AccessMap) => void;
  inherited?: AccessMap;
  inheritedFrom?: string;
}) {
  const setLevel = (map: AccessMap, key: string, level: Level) => {
    const next = { ...map };
    if (level === "none") delete next[key];
    else next[key] = level;
    return next;
  };
  const setGroup = (group: string, level: Level) =>
    onChange(RESOURCES.filter((r) => r.group === group).reduce((m, r) => setLevel(m, r.key, level), value));

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted-foreground">
        &quot;View&quot; opens the page read-only, &quot;Edit&quot; lets them change it.
        {inherited ? <> What {inheritedFrom ?? "the department"} gives is shown on each row; choose more here only where this person needs more.</> : null}
      </p>
      {GROUPS.map((g) => (
        <div key={g} className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-secondary px-3 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary-foreground">{g}</span>
            <span className="flex gap-2 text-[11px]">
              {(["none", "view", "edit"] as Level[]).map((l) => (
                <button key={l} type="button" onClick={() => setGroup(g, l)}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                  all {l === "none" ? "no access" : l}
                </button>
              ))}
            </span>
          </div>
          <div className="divide-y divide-border/70">
            {RESOURCES.filter((r) => r.group === g).map((r) => {
              const from = inherited?.[r.key] ?? "none";
              const own = value[r.key] ?? "none";
              const total = RANK[own] >= RANK[from] ? own : from;
              return (
                <div key={r.key} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                  <span className="text-foreground">{r.label}</span>
                  <span className="flex items-center gap-2">
                    {from !== "none" ? (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-400" title={`Given by ${inheritedFrom ?? "the department"}`}>
                        {inheritedFrom ?? "Department"}: {NAME[from]}
                      </span>
                    ) : null}
                    <select className="rounded-md border border-border bg-input/30 px-2 py-1 text-xs" value={own}
                      onChange={(e) => onChange(setLevel(value, r.key, e.target.value as Level))}
                      aria-label={`${r.label} access`}>
                      <option value="none">{inherited && from !== "none" ? "Nothing extra" : "No access"}</option>
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                    </select>
                    {inherited ? <span className="w-14 text-right text-[11px] text-muted-foreground" title="What they get in all">{NAME[total]}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
