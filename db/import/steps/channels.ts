/** fp_channel: the fixed hierarchy (company > super stockist > distributor > retail ...), plus any unknown code the customers use. */
import { CHANNELS } from "../constants";
import { uid } from "../lib/ids";
import { str } from "../lib/parse";
import { patch, upsert } from "../lib/sql";
import type { Row, Step } from "../types";

export const loadChannels: Step = async (ctx) => {
  const rows: Row[] = Object.entries(CHANNELS).map(([c, [name, level]]) => ({
    uid: uid(`channel:${c}`), channel: name, channel_code: c, level, auto_accept: 0, retail: level === 4 ? 1 : 0,
  }));

  const unknown = new Set(ctx.reports.customers.map((r) => str(r["Channel Code"])).filter((c): c is string => !!c && !CHANNELS[c]));
  for (const c of unknown) {
    ctx.warn.push(`channel code "${c}" is not in the built-in list - saved as its own channel at level 4`);
    rows.push({ uid: uid(`channel:${c}`), channel: c, channel_code: c, level: 4, auto_accept: 0, retail: 1 });
  }
  await upsert(ctx, "fp_channel", rows);

  const parents = Object.entries(CHANNELS)
    .filter(([, v]) => v[2])
    .map(([c, v]) => ({ uid: uid(`channel:${c}`), parent_channel_uid: uid(`channel:${v[2]}`) }));
  await patch(ctx, "fp_channel", parents, ["parent_channel_uid"]);
  ctx.summary.push(`channels ${rows.length}`);
};
