import { notFound } from "next/navigation";
import { FarmerProfile, type RangeKey } from "@/components/farmers/FarmerProfile";
import { farmerKey, getFarmerDays, getFarmerTransportDays, getFarmerTransporters } from "@/lib/farmers/data";
import { getTransporters } from "@/lib/transport/data";
import { kgPerLitre } from "@/lib/procurement/data";
import { addDays, today } from "@/lib/dates";
import { query } from "@/lib/db";
import { centers, ensureDays, ensureFarmers, storedFarmers } from "@/lib/vamaa/sync";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DAYS: Record<Exclude<RangeKey, "all" | "custom">, number> = { "30d": 30, "90d": 90, "6m": 182, "1y": 365 };

export default async function FarmerPage({ params, searchParams }: PageProps<"/farmers/[code]">) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const sp = await searchParams;
  const now = today();

  // Codes repeat across centres, so the farmer is the centre + code. A link
  // without a centre lands on the first centre that has this code.
  const centreList = await centers();
  const farmers = await storedFarmers();
  const asked = typeof sp.center === "string" ? sp.center : null;
  const farmer = farmers.find((f) => f.code === code && (asked === null || f.center === asked));
  if (!farmer) notFound();
  const center = farmer.center;
  const centre = centreList.find((c) => c.center === center);

  // The period: a preset, all time, or a custom from / to.
  const want = typeof sp.range === "string" ? sp.range : "1y";
  let range: RangeKey = want in PRESET_DAYS || want === "all" || want === "custom" ? (want as RangeKey) : "1y";
  let from: string, to: string;
  if (range === "custom" && typeof sp.from === "string" && ISO.test(sp.from) && typeof sp.to === "string" && ISO.test(sp.to)) {
    [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
  } else if (range === "all") {
    const first = await query<{ d: string | null }>(
      `select to_char(min(day), 'YYYY-MM-DD') as d from vamaa_collection where center = $1 and farmer_code = $2`,
      [center, code],
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

  const k = await kgPerLitre();
  const key = farmerKey(center, code);
  const [days, assigned, transportDays, transporters] = await Promise.all([
    getFarmerDays(center, code, from, to, k),
    getFarmerTransporters(),
    getFarmerTransportDays(center, code, from, to),
    getTransporters("milk_to_plant"),
  ]);

  return (
    <FarmerProfile
      farmer={{
        center,
        centerName: centre?.name ?? center,
        isTanker: centre?.kind === "tanker",
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
        current: assigned[key],
        options: transporters.filter((t) => t.is_active || t.id === assigned[key]).map((t) => ({ id: t.id, name: t.name })),
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
