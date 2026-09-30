import { notFound } from "next/navigation";
import { FarmerProfile, type RangeKey } from "@/components/farmers/FarmerProfile";
import { getFarmerDays, getFarmerTransportDays, getFarmerTransporters } from "@/lib/farmers/data";
import { getTransporters } from "@/lib/transport/data";
import { kgPerLitre } from "@/lib/procurement/data";
import { addDays, today } from "@/lib/dates";
import { query } from "@/lib/db";
import { centerCode, ensureDays, ensureFarmers, storedFarmers } from "@/lib/vamaa/sync";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DAYS: Record<Exclude<RangeKey, "all" | "custom">, number> = { "30d": 30, "90d": 90, "6m": 182, "1y": 365 };

export default async function FarmerPage({ params, searchParams }: PageProps<"/farmers/[code]">) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const sp = await searchParams;
  const now = today();

  // The period: a preset, all time, or a custom from / to.
  const asked = typeof sp.range === "string" ? sp.range : "1y";
  let range: RangeKey = asked in PRESET_DAYS || asked === "all" || asked === "custom" ? (asked as RangeKey) : "1y";
  let from: string, to: string;
  if (range === "custom" && typeof sp.from === "string" && ISO.test(sp.from) && typeof sp.to === "string" && ISO.test(sp.to)) {
    [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
  } else if (range === "all") {
    const first = await query<{ d: string | null }>(
      `select to_char(min(day), 'YYYY-MM-DD') as d from vamaa_collection where center = $1 and farmer_code = $2`,
      [centerCode(), code],
    );
    from = first[0]?.d ?? addDays(now, -364);
    to = now;
  } else {
    if (range === "custom") range = "1y";
    to = now;
    from = addDays(now, -(PRESET_DAYS[range as keyof typeof PRESET_DAYS] - 1));
  }

  let notice: string | null = null;
  try {
    await Promise.all([ensureFarmers(), ensureDays(from, to)]);
  } catch (e) {
    notice = `Couldn't reach the Vamaa app, so this shows what's saved locally: ${e instanceof Error ? e.message : String(e)}`;
  }

  const farmer = (await storedFarmers()).find((f) => f.code === code);
  if (!farmer) notFound();
  const k = await kgPerLitre();
  const [days, assigned, transportDays, transporters] = await Promise.all([
    getFarmerDays(code, from, to, k),
    getFarmerTransporters(),
    getFarmerTransportDays(code, from, to),
    getTransporters("milk_to_plant"),
  ]);

  return (
    <FarmerProfile
      farmer={{
        code: farmer.code,
        name: farmer.name_en || [farmer.first_name, farmer.last_name].filter(Boolean).join(" "),
        mobile: farmer.mobile,
        milkType: farmer.milk_type,
        bank: farmer.bank_name,
        branch: farmer.bank_branch,
        account: farmer.bank_account,
        ifsc: farmer.bank_ifsc,
        joined: farmer.created,
      }}
      days={days}
      transport={{
        current: assigned[code],
        options: transporters.filter((t) => t.is_active || t.id === assigned[code]).map((t) => ({ id: t.id, name: t.name })),
        byDay: transportDays,
      }}
      range={range}
      from={from}
      to={to}
      today={now}
      kgPerLitre={k}
      notice={notice}
    />
  );
}
