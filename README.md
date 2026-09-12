# Costing

Product costing for a dairy plant, rebuilt from `COST OF PRODUCTS_26Dec25_27Feb24TptRvisd.xlsx`
as a database-backed app where **nothing is hard-coded**: the kinds of things you cost, the
columns each one carries, the formulas behind those columns, the global rates and the
bill-of-material lines are all rows you can add, edit or delete while the app runs.

`npm run db:verify` compares the model against the numbers Excel itself calculated — all 569 of
them, across the product grid, the batch rates, the milk-pricing block and the shrikhand recipe.
566 match to 1e-6; the other three are places where the sheet disagrees with itself, listed below.
Run it with `NO_SKIP=1` to see those three compared rather than excused.

## Running it

```bash
createdb costing_erp
psql -d costing_erp -f db/001_schema.sql
npm run db:seed      # loads the workbook's model and calculates it
npm run dev
```

Sign in with the account the seed creates: **darshan@vamaadairy.com / costing123**
(override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before seeding).

`.env` holds `DATABASE_URL` (defaults to `postgres://localhost:5432/costing_erp`) and
`JWT_SECRET`, which signs the session cookie.

## The shell

The chrome is the same design system as the stock app: Gaia palette and tokens, the shadcn/
base-ui collapsible sidebar, the blue gradient `PageHeader`, and the same split-screen login with
the clipboard illustration. Auth works the same way too - bcrypt password hashes, a `jose`-signed
JWT in an httpOnly `session` cookie, and a `proxy.ts` (Next 16's renamed middleware) that bounces
signed-out visitors to `/login`. Users live in this app's own Postgres `app_user` table rather
than the stock app's database, so the two stay independent.

| Script | What it does |
| --- | --- |
| `npm run db:seed` | **Wipes** and reloads the model from `db/seed.ts`, then calculates |
| `npm run db:verify` | Checks every value against `db/excel-expected.json` |

## Daily production cost

The cost card above says what a piece *should* cost. The daily side says what it *did* cost, on
the day it was made:

1. Enter the day's **milk processed** and the day's **shared costs** — coal, electricity, labour,
   plant staff, transport, or any head you add. Enter an amount, or a quantity and a rate.
2. Shared cost ÷ milk processed = that day's **conversion cost per litre**. This replaces the
   workbook's standing 3.56/L with what the plant actually spent, so a low-volume day correctly
   shows a higher cost per litre.
3. Enter **what was produced**. Each product carries the conversion rate in proportion to the milk
   embodied in it — worked out by walking its bill of material down to the milk, so a shrikhand cup
   is charged for the curd inside it, not just its own weight — and adds its own raw material and
   packing on top.
4. The result is **frozen** into `daily_product_cost` when the day is saved, so changing a rate
   next month never rewrites what last month cost.

The day page also reports **milk accounted for by production** against milk processed, which is a
quick check on whether the day's entries add up.

| Table | Holds |
| --- | --- |
| `production_day` | The day, and the milk processed that is the divisor for every shared cost |
| `overhead_head` | The cost heads you spend on daily. Add or remove them freely |
| `daily_overhead` | What each head cost that day - amount, or quantity x rate |
| `daily_production` | What was produced, per product |
| `daily_product_cost` | The frozen answer: cost per unit and total, split into material / conversion / packing |

## How the model is put together

| Table | Holds |
| --- | --- |
| `scenario` | One complete versioned cost model. Clone it to run a what-if. |
| `parameter` | Global rates — base milk rate, GST, commission %, markups. |
| `object_class` | The *kinds* of costed things: milk batch, product, packaging, ingredient, recipe. Add your own. |
| `field_def` | The *columns* of a class, each with a default formula or default value. |
| `cost_object` | The rows: a SKU, a batch type, a carton. |
| `field_value` | The cells. A row can override the column's formula, or pin a literal. |
| `bom_line` | Recipe / packaging build-ups: component, qty, rate, divisor. |
| `dependency_edge` | What reads what — rebuilt on every calculation, drives the impact view. |
| `change_log` | Every human edit, old and new. Recalculations are not logged. |

A cell resolves in this order: **row formula → row literal → column formula → column roll-up →
column default**. So a column can carry the standard formula while any single row breaks
ranks — exactly what the workbook did per row, without the workbook's copy-paste.

### Formula language

Spreadsheet-shaped, evaluated by `src/lib/formula`:

```
qty_per_pc * O.toned_milk.total_cost_per_l     # another object's column
P.base_rate / P.ts_divisor                     # a global parameter
BOM("packaging") + BOM("transport")            # this row's BOM lines, by type
DIV(packing_cost, ex_plant_cost, 0)            # division that can't blow up the sheet
IF(qty_per_pc > 1, 2, 2.25) * qty_per_pc
```

- `P.key` — parameter · `O.code.column` — another object · `O.code` — its unit cost column
- bare `column` — the same row · `SELF.column` — the same, spelled out
- `BOM(type?)`, `LINE(label)` — this row's bill of material
- `SUM MIN MAX AVG ABS ROUND ROUNDUP ROUNDDOWN CEIL FLOOR SQRT POW IF AND OR NOT COALESCE ISBLANK DIV`
- `4%` is `0.04`; `^` is power; comparisons return 1/0

Every edit recalculates the whole scenario (~1,150 values in ~200 ms) and rewrites the
dependency graph, so a number is never stale and "what does this affect?" is always answerable.

### Where the workbook's numbers went

- Rows 45–46 (base rate, landed per litre/kg TS) → parameters
- Rows 48–60 (fat/SNF, commission, procurement transport, utilities, chemicals) → `milk_batch`
- Rows 2–43 (per-SKU cost build-up) → `product`, one BOM line per input, packaging build-ups
  split into their own lines against `packaging` items
- Rows 66–85 (shrikhand recipe) → a `recipe` object with its own BOM; the 80 g cup consumes it

Judgement calls worth knowing: ghee is costed off butter rather than fat/SNF, so its batch row
overrides the solids-rate formula; pack-material transport for ghee is a `transport` line folded
into packing cost, matching the sheet. Sweet Lassi in a glass and Milk Peda keep the standing
estimates the workbook gave them — it never built those two up either, so neither does this.

### The three places the sheet disagrees with itself

- **15 kg buckets, plain and kadhi** — input credit is typed as `0`, while every other row runs
  `packing - packing / 1.18`. On the same packing cost of 82 that formula gives **12.51**, and the
  5 kg bucket beside it does use the formula. The model computes it; if those buckets genuinely
  carry no credit, pin the cell to 0 and it stays pinned.
- **Shrikhand 80 g cup** — market transport appears twice: `0.166` per kg in the grid, and 4% of
  ex-plant cost inside the recipe block. Only the second one reaches the landed cost the sheet
  actually reports, so that is what the model uses.

Everything else in the file is accounted for: the loose cells that no formula referenced
(`100/5.8` beside masala chaach, `((420×15)+200)/15` beside the ghee tin) and the margin notes
(curd dilution ratios, the ghee pack-transport derivations, "assumption random, no basis" against
the shrikhand making charge) are carried as notes on the rows they belong to rather than dropped.
