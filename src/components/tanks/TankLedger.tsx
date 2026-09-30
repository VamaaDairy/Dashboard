"use client";

import { Section } from "./ui";
import { MovementTable } from "./TankDayBoard";
import type { MovementRow, TankRow } from "@/lib/tanks/data";

/** Everything this tank has taken in and given out, newest first, as two lists. */
export function TankLedger({
  tank, movements, kgPerLitre,
}: {
  tank: TankRow;
  movements: MovementRow[];
  kgPerLitre: number;
}) {
  const props = {
    movements,
    kgPerLitre,
    first: { label: "Date", cell: (m: MovementRow) => m.movement_date },
    tankIdOf: () => tank.id,
  };
  return (
    <>
      <Section title="All added" description="Newest first. To move or undo one, change its tank on Milk in.">
        <MovementTable kind="in" emptyText="Nothing added yet." {...props} />
      </Section>
      <Section title="All removed" description="Newest first. Delete a wrong one and take it out again.">
        <MovementTable kind="out" emptyText="Nothing removed yet." {...props} />
      </Section>
    </>
  );
}
