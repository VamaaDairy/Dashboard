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

Needs a local PostgreSQL server (18 is what this is developed against) and nothing else —
no SQLite, no hosted database, no Docker.

```bash
cp .env.example .env   # then set DATABASE_URL, JWT_SECRET and the admin login
npm install
npm run db:setup       # creates the database, applies every migration, bootstraps
npm run dev
```

`db:setup` leaves you with the **entire structure and none of the content**: all 35 tables,
8 views and 41 functions, and exactly two rows — one empty scenario for the model to hang off,
and the login from `.env`. No classes, fields, parameters, objects, BOM lines, procurement or
daily records. You build those from the app, which is the point: the model lives in the database,
not in the code.

It talks to Postgres through `pg` using `DATABASE_URL`, so it needs neither `psql` on your
PATH nor a database role matching your OS user. **Run it again after every pull** — it applies
only the migrations this database hasn't had yet, each one recorded in `schema_migrations` in the
same transaction (see `db/migrations.ts`), and only inserts the bootstrap rows when missing.
A database built before that ledger existed is recognised on the first run: files whose tables
are already there are recorded, not re-run. `npm run db:reset` is the destructive one: it drops
every table and rebuilds from empty.

Vamaa data (collections and the farmer list) is kept in `vamaa_collection` / `vamaa_farmer` and
read from there by every page; the app is only called for days that aren't stored yet or are
recent enough to have been corrected. Every fetch checks **every centre** listed in
`vamaa_center` (village centres, and the tanker centre where milk from other dairies is entered on
the days a tanker arrives) - add a row there to start reading another centre. With no centres
listed, the single `VAMAA_CENTER_SHORT_NAME` from `.env` is used. On a new database the first page
that needs history fetches it.

Milk prices up to 30 Sep 2026 are kept as the Vamaa app sent them; from 1 Oct 2026 they are
calculated locally from the stored rate chart (`npm run db:seed:rate-chart` loads it). Tanker milk
isn't priced from the farmer chart.

Demo data: `npm run db:seed:demo` fills 1-6 Oct 2026 end to end (real collections into the tanks
plus demo tanker loads, bulk batches drawn from the tanks, SKU packing with packing material,
transport, coal, electricity, labour) and sets typical ingredient and packaging rates. Everything it
inserts or overwrites is recorded in `demo_seed`; `npm run db:seed:demo -- --undo` takes it all out
and puts the old values back.

Tank transfers: on the Tanks page the take-out icon can move milk into another tank. The milk leaves at
the source tank's blend (fat, SNF, ₹/L) and is weighted-averaged into the receiving tank; if the source
is later recomputed, the new blend follows the milk into every tank downstream. The demo data moves raw
milk from RMST1/2 into PMST / HMST / coagulation tanks before production draws it.

SKU packing lists: every SKU has its own standing packing list (items, quantity per piece or per case);
`npm run db:seed:sku-packing` sets the default lists and packaging rates. Saving a day of SKU packing
without material entered fills it from the list at the Packaging master rate.

Costing: a day's shared costs (every overhead head except delivery fuel) are divided over the litres
of milk that went into bulk batches that day; each batch carries its litres' share on top of its milk
(at the tanks' blended ₹/L) and ingredients (at master rates). Delivery fuel goes onto the SKUs packed,
by quantity. See Production → Dashboard.

Sign in with whatever you put in `ADMIN_EMAIL` / `ADMIN_PASSWORD`. `npx tsx db/set-password.ts
<email> <password>` changes it later without touching anything else.

`.env` holds `DATABASE_URL` (e.g. `postgres://postgres:postgres@localhost:5432/costing_erp`),
`JWT_SECRET`, which signs the session cookie, and the bootstrap login.

### Starting from the workbook instead

`npm run db:seed` is the other way in: it **wipes** the database and loads the full model from
`COST OF PRODUCTS_26Dec25_27Feb24TptRvisd.xlsx` — every class, parameter, product and BOM line
described below — then calculates it. Use it if you want the worked example rather than a blank
slate. `npm run db:verify` then checks the result against Excel.

One thing an empty database does not carry is the `milk_kg_per_litre` parameter that
`003_procurement.sql` inserts for scenarios that already exist. Procurement still works — the
`milk_kg_per_litre()` function falls back to 1.03 — but to make the assumption editable, add it
as a parameter on the Parameters page.

## The shell

The chrome is the same design system as the stock app: Gaia palette and tokens, the shadcn/
base-ui collapsible sidebar, the blue gradient `PageHeader`, and the same split-screen login with
the clipboard illustration. Auth works the same way too - bcrypt password hashes, a `jose`-signed
JWT in an httpOnly `session` cookie, and a `proxy.ts` (Next 16's renamed middleware) that bounces
signed-out visitors to `/login`. Users live in this app's own Postgres `app_user` table rather
than the stock app's database, so the two stay independent.

| Script | What it does |
| --- | --- |
| `npm run db:setup` | Creates the database if needed, applies any `db/*.sql` not yet applied, adds the two bootstrap rows |
| `npm run db:apply -- <file>` | Applies one migration and records it (refused if already applied) |
| `npm run db:reset` | The same, but **drops every table first** |
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

## Deploying to Vercel

`vercel.json` runs a plain `npm run build` - no database scripts run during a deploy, and the `db/`
folder is left out of the deployment (`.vercelignore`) and out of the build's type check (`tsconfig.json`).
The build needs no database at all; pages read it when they are requested. Functions run in Cleveland
(`cle1`), next to the Neon database in AWS us-east-2, with up to 60 s per request.

When a new `db/NNN_*.sql` migration is added, apply it to the hosted database by hand from this PC:
`DATABASE_URL="<neon url>" npm run db:setup` (it only applies what that database hasn't had yet).

1. **A hosted Postgres.** The local database on this PC can't be reached from Vercel. Create one on
   Neon, Supabase or Vercel Postgres and copy its connection string (use the pooled one, with
   `?sslmode=require`).
2. **Copy your data across** (optional - a new database starts empty):
   `pg_dump -Fc costing_erp > costing.dump` then `pg_restore --no-owner -d "<hosted url>" costing.dump`.
3. **Environment variables** in the Vercel project (Settings → Environment Variables):
   `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and for Milk in
   `VAMAA_API_BASE_URL`, `VAMAA_API_KEY`, `VAMAA_ORG_ID`, `VAMAA_USERNAME`, `VAMAA_PASSWORD`,
   `VAMAA_CENTER_SHORT_NAME`.
4. Import the GitHub repo in Vercel and deploy.
