"""Builds a schema reference PDF for the Gaia costing database.

    python3 docs/build-schema-pdf.py          # reads $DATABASE_URL or costing_erp

Needs reportlab: pip install reportlab
"""
import os
import subprocess
import tempfile
from collections import OrderedDict, defaultdict
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, NextPageTemplate,
                               PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle)

DB = os.environ.get("PGDATABASE", "costing_erp")
HERE = tempfile.mkdtemp(prefix="schema-pdf-")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "costing-schema.pdf")

QUERIES = {
    "columns.txt": """
        select c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
               case when a.attnotnull then 'yes' else '' end,
               coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
               coalesce((select string_agg(distinct con.contype::text, ',')
                           from pg_constraint con
                          where con.conrelid = c.oid and a.attnum = any(con.conkey)
                            and con.contype in ('p','f','u')), ''),
               coalesce((select cl2.relname from pg_constraint con
                           join pg_class cl2 on cl2.oid = con.confrelid
                          where con.conrelid = c.oid and con.contype='f'
                            and a.attnum = any(con.conkey) limit 1), '')
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
         where n.nspname='public' and c.relkind='r'
         order by c.relname, a.attnum""",
    "checks.txt": """
        select c.relname, con.conname, pg_get_constraintdef(con.oid)
          from pg_constraint con join pg_class c on c.oid = con.conrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname='public' and con.contype in ('c','u')
         order by c.relname, con.conname""",
    "counts.txt": "select relname, n_live_tup from pg_stat_user_tables order by relname",
    "views.txt": "select viewname from pg_views where schemaname='public' order by viewname",
}

for filename, sql in QUERIES.items():
    subprocess.run(["psql", "-d", DB, "-t", "-A", "-F", "\t", "-o",
                    os.path.join(HERE, filename), "-c", sql], check=True)

BLUE = colors.HexColor("#4A6FA5")
DARKBLUE = colors.HexColor("#3E5FA0")
DEEP = colors.HexColor("#2B4C86")
GREEN = colors.HexColor("#3E9B4F")
INK = colors.HexColor("#16181D")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E3E6EA")
BAND = colors.HexColor("#F2F6FD")

# ---------------------------------------------------------------- source data
def read(name):
    with open(f"{HERE}/{name}") as fh:
        return [line.rstrip("\n").split("\t") for line in fh if line.strip()]

columns = defaultdict(list)
for row in read("columns.txt"):
    tbl, col, typ, notnull, default, contype, ref = (row + [""] * 7)[:7]
    columns[tbl].append(dict(col=col, typ=typ, notnull=notnull, default=default,
                             contype=contype, ref=ref))

checks = defaultdict(list)
for tbl, name, defn in read("checks.txt"):
    checks[tbl].append((name, defn))

counts = {t: int(n) for t, n in read("counts.txt")}
views = [v[0] for v in read("views.txt")]

# ---------------------------------------------------------------- narrative
SECTIONS = OrderedDict([
    ("The cost model", (
        "The rate card: what a unit should cost. Nothing here is fixed by the schema - the kinds "
        "of things you cost, the columns each carries, and the formulas behind them are all rows "
        "you can change while the app runs.",
        ["scenario", "parameter", "object_class", "field_group", "field_def",
         "field_rollup_tag", "cost_object", "field_value", "bom_line"])),
    ("Daily production", (
        "What a day actually cost. The day supplies the milk processed and the shared costs; "
        "divide one by the other and every product carries that rate in proportion to the milk "
        "inside it.",
        ["production_day", "overhead_head", "daily_overhead", "daily_production",
         "daily_material_use", "daily_product_cost"])),
    ("Calculation and audit", (
        "How the numbers were reached, and who changed what.",
        ["calc_run", "dependency_edge", "change_log"])),
    ("Reference and access", (
        "Units, and the people who can sign in.",
        ["uom", "app_user"])),
])

TABLE_NOTES = {
    "scenario": "One complete, versioned cost model - a workbook. Clone it to run a what-if without touching the live numbers.",
    "parameter": "Every rate, percentage and factor the model leans on: base milk rate, GST, commission, markups. A parameter may itself be a formula over other parameters.",
    "object_class": "The kinds of costed things - milk batch, product, packaging, ingredient, recipe. Add your own without a migration.",
    "field_group": "Groups columns for display, and gives roll-ups something to sum into.",
    "field_def": "The columns of a class. Each carries a default formula or a default value; any single row may override either.",
    "field_rollup_tag": "Tags a column as feeding a total. One column can feed several totals, and a negative sign subtracts it.",
    "cost_object": "The rows: a SKU, a batch type, a carton, a recipe.",
    "field_value": "The cells. A row's own formula wins, then its own literal, then the column's formula, then the column's default.",
    "bom_line": "Recipe and packaging build-ups: component, quantity, rate, divisor. Amount is qty x rate / divisor unless a formula says otherwise.",
    "production_day": "A day of production. milk_processed_l is the divisor for every shared cost that day.",
    "overhead_head": "The shared cost heads the plant spends on daily - coal, power, labour, transport. Add or remove freely.",
    "daily_overhead": "What each head cost that day. Enter an amount, or a quantity and a rate.",
    "daily_production": "What was produced that day, per product.",
    "daily_material_use": "Raw material actually drawn for a product that day, when it differed from the recipe.",
    "daily_product_cost": "The frozen answer: what each product cost that day, split into material, conversion, packing and other. Written when the day is saved, so later rate changes never rewrite history.",
    "calc_run": "One row per recalculation: how many values, how long, how many errors.",
    "dependency_edge": "What reads what. Rebuilt on every calculation, and drives the impact view.",
    "change_log": "Every human edit, old row and new. Recalculations and cache refreshes are deliberately excluded.",
    "uom": "Units of measure, shared across scenarios.",
    "app_user": "Sign-in accounts. Passwords are bcrypt hashes; sessions are JWTs in an httpOnly cookie.",
}

COLUMN_NOTES = {
    ("parameter", "formula"): "when set, overrides value_num",
    ("parameter", "computed_num"): "cached result of the last calculation",
    ("object_class", "cost_field"): "column holding this class's unit cost",
    ("field_def", "default_formula"): "used by every row that does not override it",
    ("field_def", "rollup_group"): "sums every column carrying this tag",
    ("field_def", "is_total"): "renders as a total column",
    ("field_value", "formula"): "row-level override of the column formula",
    ("field_value", "value_num"): "row-level literal; beats the column formula",
    ("field_value", "computed_num"): "cached result, so the sheet renders without recalculating",
    ("bom_line", "divisor"): "units per pack - a carton of 12 divides by 12",
    ("bom_line", "loss_pct"): "wastage added on top of qty x rate",
    ("bom_line", "computed_qty"): "resolved quantity, reused by daily costing",
    ("cost_object", "parent_id"): "for variants of a parent item",
    ("production_day", "milk_processed_l"): "divisor for every shared cost that day",
    ("daily_overhead", "amount"): "entered directly, or qty x rate",
    ("daily_product_cost", "milk_qty_per_unit"): "litres of milk embodied in one piece",
    ("daily_product_cost", "conversion_rate"): "that day's shared cost per litre",
    ("daily_product_cost", "unit_cost"): "material + conversion + packing + other",
    ("change_log", "old_row"): "the whole row before the edit",
    ("change_log", "new_row"): "the whole row after the edit",
    ("app_user", "password_hash"): "bcrypt",
}

VIEW_NOTES = {
    "v_cell": ("One row per object and column, with the effective formula and the last computed "
               "value. Mirrors the engine's precedence, so what you read is what it will calculate."),
    "v_daily_summary": ("One row per day: milk processed, shared costs, the conversion rate they "
                        "imply, and the production cost that came out."),
}

# ---------------------------------------------------------------- styles
styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                    fontSize=17, leading=21, textColor=DEEP, spaceBefore=2, spaceAfter=4)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=11.5, leading=14, textColor=DARKBLUE, spaceBefore=10, spaceAfter=3)
BODY = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica",
                      fontSize=8.6, leading=11.6, textColor=INK, alignment=TA_LEFT)
LEAD = ParagraphStyle("Lead", parent=BODY, fontSize=9, leading=12.4, textColor=MUTED,
                      spaceAfter=6)
NOTE = ParagraphStyle("Note", parent=BODY, fontSize=8.2, leading=10.6, textColor=MUTED)
CELL = ParagraphStyle("Cell", parent=BODY, fontSize=7.6, leading=9.6)
MONO = ParagraphStyle("Mono", parent=CELL, fontName="Courier", fontSize=7.4, textColor=INK)
MONOMUTED = ParagraphStyle("MonoMuted", parent=MONO, textColor=MUTED)
HEADCELL = ParagraphStyle("HeadCell", parent=CELL, fontName="Helvetica-Bold",
                          fontSize=7, textColor=DEEP)

def key_label(contype, ref):
    bits = []
    if "p" in contype:
        bits.append("PK")
    if "f" in contype:
        bits.append(f"FK to {ref}" if ref else "FK")
    if "u" in contype:
        bits.append("unique")
    return ", ".join(bits)

def short_default(text):
    text = text.replace("::text", "").replace("::jsonb", "")
    if text.startswith("nextval"):
        return "auto"
    return text[:26]

# ---------------------------------------------------------------- page frame
def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 12 * mm, "Gaia Costing - database schema")
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {canvas.getPageNumber()}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
    canvas.restoreState()

def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1] - 96 * mm, A4[0], 96 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 30)
    canvas.drawString(22 * mm, A4[1] - 52 * mm, "Database schema")
    canvas.setFont("Helvetica", 14)
    canvas.drawString(22 * mm, A4[1] - 63 * mm, "Gaia Costing")
    canvas.setFillColor(colors.HexColor("#8FE3A0"))
    canvas.setFont("Helvetica-Bold", 9.5)
    canvas.drawString(22 * mm, A4[1] - 74 * mm,
                      "Product costing and daily production cost - PostgreSQL")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(22 * mm, 20 * mm, date.today().strftime("Generated %d %B %Y"))
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=18 * mm, bottomMargin=20 * mm,
                      title="Gaia Costing - database schema", author="Gaia")
frame_cover = Frame(22 * mm, 26 * mm, A4[0] - 44 * mm, A4[1] - 130 * mm, id="cover")
frame_body = Frame(18 * mm, 20 * mm, A4[0] - 36 * mm, A4[1] - 42 * mm, id="body")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame_cover], onPage=cover),
    PageTemplate(id="body", frames=[frame_body], onPage=decorate),
])

story = []

# ---------------------------------------------------------------- cover text
total_tables = sum(len(t[1]) for t in SECTIONS.values())
total_columns = sum(len(columns[t]) for s in SECTIONS.values() for t in s[1])
story.append(Paragraph(
    "Every table behind the costing app, grouped by what it is for. The model half holds the "
    "rate card - what a unit should cost at a given set of rates. The daily half holds what the "
    "plant actually spent, day by day, and what that made each product cost.", LEAD))
story.append(Spacer(1, 4))

summary = [[Paragraph(x, HEADCELL) for x in ["", "Tables", "Columns", "What it covers"]]]
for name, (blurb, tables) in SECTIONS.items():
    summary.append([
        Paragraph(f"<b>{name}</b>", CELL),
        Paragraph(str(len(tables)), CELL),
        Paragraph(str(sum(len(columns[t]) for t in tables)), CELL),
        Paragraph(blurb.split(".")[0] + ".", CELL),
    ])
summary.append([Paragraph("<b>Views</b>", CELL), Paragraph(str(len(views)), CELL),
                Paragraph("-", CELL), Paragraph("Flattened reads over the tables above.", CELL)])
t = Table(summary, colWidths=[36 * mm, 16 * mm, 18 * mm, 92 * mm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BAND),
    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
]))
story.append(t)
story.append(Spacer(1, 8))
story.append(Paragraph(
    f"<b>{total_tables} tables, {total_columns} columns.</b> Row counts are as at generation time.",
    NOTE))
story.append(NextPageTemplate("body"))
story.append(PageBreak())

# ---------------------------------------------------------------- table pages
first = True
for section, (blurb, tables) in SECTIONS.items():
    head = [Paragraph(section, H1), Paragraph(blurb, LEAD)]
    story.append(KeepTogether(head) if first else PageBreak())
    if not first:
        story.append(Paragraph(section, H1))
        story.append(Paragraph(blurb, LEAD))
    first = False

    for tbl in tables:
        block = [Paragraph(f"{tbl}", H2)]
        note = TABLE_NOTES.get(tbl, "")
        rows = counts.get(tbl, 0)
        block.append(Paragraph(
            f"{note} <font color='#9AA3B0'>&nbsp;&nbsp;{rows} row{'' if rows == 1 else 's'}</font>",
            NOTE))
        block.append(Spacer(1, 3))

        data = [[Paragraph(x, HEADCELL) for x in
                 ["Column", "Type", "Req", "Default", "Key", "Notes"]]]
        for c in columns[tbl]:
            data.append([
                Paragraph(c["col"], MONO),
                Paragraph(c["typ"].replace("timestamp with time zone", "timestamptz")
                          .replace("character varying", "varchar"), MONOMUTED),
                Paragraph("yes" if c["notnull"] else "", CELL),
                Paragraph(short_default(c["default"]), MONOMUTED),
                Paragraph(key_label(c["contype"], c["ref"]), CELL),
                Paragraph(COLUMN_NOTES.get((tbl, c["col"]), ""), CELL),
            ])
        t = Table(data, colWidths=[34 * mm, 27 * mm, 9 * mm, 25 * mm, 27 * mm, 52 * mm],
                  repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BAND),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#B9C6EA")),
            ("LINEBELOW", (0, 1), (-1, -1), 0.3, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        block.append(t)

        rules = [d for _, d in checks.get(tbl, []) if d.startswith("CHECK")]
        uniques = [d for _, d in checks.get(tbl, []) if d.startswith("UNIQUE")]
        if uniques or rules:
            lines = []
            for u in uniques:
                lines.append(f"<font face='Courier' size='7.2'>{u}</font>")
            for r in rules:
                body = r[6:-1] if r.endswith(")") else r
                lines.append(f"<font face='Courier' size='7.2'>CHECK {body[:150]}</font>")
            block.append(Spacer(1, 2.5))
            block.append(Paragraph(" &nbsp;·&nbsp; ".join(lines), NOTE))

        story.append(KeepTogether(block) if len(data) <= 18 else block[0])
        if len(data) > 18:
            for piece in block[1:]:
                story.append(piece)
        story.append(Spacer(1, 7))

# ---------------------------------------------------------------- views
story.append(PageBreak())
story.append(Paragraph("Views", H1))
story.append(Paragraph(
    "Read helpers over the tables above. The app reads these rather than reassembling the same "
    "joins in a dozen places.", LEAD))
for v in views:
    story.append(Paragraph(v, H2))
    story.append(Paragraph(VIEW_NOTES.get(v, ""), NOTE))
    story.append(Spacer(1, 4))

story.append(Spacer(1, 6))
story.append(Paragraph("How a cost is reached", H2))
story.append(Paragraph(
    "<b>Standard cost.</b> parameter feeds field_def formulas, which compute field_value cells "
    "for every cost_object; bom_line pulls one object into another, so a product's cost walks "
    "down through its recipe to the milk. dependency_edge records each of those reads, so the "
    "app can answer what a change affects.", BODY))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "<b>Daily cost.</b> production_day holds the milk processed; daily_overhead holds what was "
    "spent. Their ratio is the day's conversion cost per litre. Each product in daily_production "
    "carries that rate in proportion to the milk embodied in it, adds its own material and "
    "packing, and the answer is frozen into daily_product_cost so later rate changes leave "
    "history alone.", BODY))

doc.build(story)
print("wrote", OUT)
