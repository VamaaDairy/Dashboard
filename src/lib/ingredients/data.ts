import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

export interface IngredientRow {
  id: string;
  name: string;
  unit: string | null;
  rate: number;
}

/** Every active ingredient (or packaging item) in the cost model: its name, unit and rate per unit. */
export async function getIngredients(kind: "ingredient" | "packaging" = "ingredient"): Promise<IngredientRow[]> {
  return query<IngredientRow>(
    `select o.id, o.name,
            max(coalesce(v.computed_text, v.input_text)) filter (where v.field_key = 'unit') as unit,
            coalesce(max(coalesce(v.computed_num, v.input_num)) filter (where v.field_key = 'rate'), 0) as rate
       from cost_object o
       join object_class k on k.id = o.class_id and k.code = $2
       left join v_cell v on v.object_id = o.id
      where o.scenario_id = $1 and o.is_active
      group by o.id, o.name
      order by o.name`,
    [await activeScenarioId(), kind],
  );
}
