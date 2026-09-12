/**
 * Seeds the costing model from "COST OF PRODUCTS_26Dec25_27Feb24TptRvisd.xlsx".
 *
 * Everything the workbook hard-coded becomes either a parameter, an object, a
 * field formula or a BOM line - so it can all be changed from the UI later.
 * Formulas mirror the workbook exactly, which lets `npm run db:verify` prove the
 * engine reproduces the sheet cell for cell.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../src/lib/db";

type Num = number | string; // string = formula

interface FieldSpec {
  key: string;
  label: string;
  group?: string;
  formula?: string;
  value?: number;
  rollup?: string;
  tags?: string[];
  total?: boolean;
  decimals?: number;
  suffix?: string;
  description?: string;
  dataType?: "number" | "text";
}

interface LineSpec {
  type?: "input" | "packaging" | "additive" | "labour" | "overhead" | "transport" | "other";
  label?: string;
  comp?: string;
  qty?: Num;
  rate?: Num;
  divisor?: Num;
  notes?: string;
}

interface ObjSpec {
  code: string;
  name: string;
  values?: Record<string, Num | null>;
  lines?: LineSpec[];
  notes?: string;
}

const isFormula = (v: Num | null | undefined): v is string => typeof v === "string";

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------
const PARAMETERS: Array<{
  key: string; label: string; group: string; value?: number; formula?: string;
  suffix?: string; description?: string;
}> = [
  // Milk pricing basis
  { key: "base_rate", label: "Base rate per kg total solids", group: "Milk Pricing", value: 297, suffix: "₹/kg TS",
    description: "In line with the milk tanker and SMP purchase price as at 24.02.24" },
  { key: "ts_divisor", label: "TS divisor (kg TS per 100 L basis)", group: "Milk Pricing", value: 103 },
  { key: "base_rate_escalation", label: "Base rate escalation factor", group: "Milk Pricing", value: 1.03 },
  { key: "ts_pct", label: "Total solids fraction used for landed rate", group: "Milk Pricing", value: 0.125 },
  { key: "smp_freight_pct", label: "SMP / tanker freight loading", group: "Milk Pricing", value: 0.04 },
  { key: "landed_handling", label: "Landed handling per litre", group: "Milk Pricing", value: 2.25 },
  { key: "landed_misc", label: "Landed misc per litre", group: "Milk Pricing", value: 0.6 },
  { key: "escalated_base_rate", label: "Escalated base rate", group: "Milk Pricing", formula: "P.base_rate * P.base_rate_escalation" },
  { key: "ts_value_per_litre", label: "TS value per litre", group: "Milk Pricing", formula: "P.escalated_base_rate * P.ts_pct" },
  { key: "landed_per_litre", label: "Landed cost per litre (4.0 / 8.5)", group: "Milk Pricing", formula: "P.ts_value_per_litre + P.ts_value_per_litre * P.smp_freight_pct + P.landed_handling + P.landed_misc" },
  { key: "landed_per_kg_ts", label: "Landed cost per kg TS", group: "Milk Pricing", formula: "P.landed_per_litre / P.ts_pct" },

  // Procurement
  { key: "sachiv_commission_pct", label: "Sachiv commission", group: "Procurement", value: 0.04, suffix: "%" },
  { key: "proc_transport_rate", label: "Procurement transport rate", group: "Procurement", value: 2.5 },
  { key: "proc_transport_basis", label: "Procurement transport basis (kg TS)", group: "Procurement", value: 12.5 },

  // Conversion
  { key: "utilities_default", label: "Coal + labour + power + plant staff", group: "Conversion", value: 3.56 },
  { key: "chemicals_default", label: "Chemicals (culture, cleaning, lab)", group: "Conversion", value: 0.15 },
  { key: "chemicals_fermented", label: "Chemicals - fermented products", group: "Conversion", formula: "P.chemicals_default + 1 + 0.2" },

  // Market
  { key: "market_transport_rate", label: "Market transport per kg / litre", group: "Market", value: 2 },
  { key: "market_transport_pct", label: "Market transport as % of ex-plant", group: "Market", value: 0.04, suffix: "%",
    description: "Used where transport is charged on value rather than weight" },
  { key: "markup_default", label: "Default markup on landed cost", group: "Market", value: 1.05 },
  { key: "markup_ghee", label: "Ghee markup on landed cost", group: "Market", value: 1.12 },

  // Tax
  { key: "gst_packing", label: "GST on packing material", group: "Tax", value: 0.18, suffix: "%" },
  { key: "gst_output", label: "GST on outward supply", group: "Tax", value: 0.17, suffix: "%" },

  // Input rates
  { key: "butter_rate", label: "Butter basic rate", group: "Input Rates", value: 355, description: "@ butter 325 basic" },
  { key: "butter_ghee_yield", label: "Ghee yield from butter", group: "Input Rates", value: 0.82 },
  { key: "ghee_conv_factor", label: "Ghee conversion loading", group: "Input Rates", value: 1.01 },
  { key: "ghee_processing_cost", label: "Ghee processing cost per kg", group: "Input Rates", value: 10 },
  { key: "ghee_density", label: "Ghee density (kg per litre)", group: "Input Rates", value: 0.9 },
  { key: "sugar_rate", label: "Sugar rate per kg", group: "Input Rates", value: 40.7 },
  { key: "lassi_mix_rate", label: "Flavoured lassi mix rate per litre", group: "Input Rates", value: 64.58 },
  { key: "lassi_curd_fraction", label: "Curd fraction in sweet lassi", group: "Recipes", value: 120 / 300,
    description: "120 parts curd in 300 parts lassi" },
  { key: "chaach_curd_fraction", label: "Curd fraction in masala chaach", group: "Recipes", value: 100 / 300,
    description: "100 parts curd in 300 parts chaach" },
  { key: "lassi_sugar_rate", label: "Sugar rate for lassi", group: "Recipes", value: 16.8 },
  { key: "lassi_sugar_per_300l", label: "Sugar used per 300 L lassi", group: "Recipes", value: 40, suffix: "kg" },
  { key: "lassi_flavour_cost", label: "Lassi flavour per piece", group: "Recipes", value: 0.06 },
  { key: "khowa_milk_per_kg", label: "Milk per kg khowa", group: "Recipes", value: 5, suffix: "L" },
  { key: "khowa_ts_ratio", label: "Khowa TS ratio", group: "Input Rates", value: 0.55 },
  { key: "khowa_processing_cost", label: "Khowa processing cost per kg", group: "Input Rates", value: 20 },
  { key: "paneer_yield_per_100l", label: "Paneer yield per 100 L milk", group: "Input Rates", value: 15, suffix: "kg" },
  { key: "paneer_additive_rate", label: "Paneer additives per kg (citric, cloth)", group: "Input Rates", value: 1.5 },
];

// ---------------------------------------------------------------------------
// Classes and their columns
// ---------------------------------------------------------------------------
const CLASSES: Array<{
  code: string; name: string; plural: string; costField: string;
  groups: Array<{ code: string; label: string }>;
  fields: FieldSpec[];
}> = [
  {
    code: "milk_batch",
    name: "Milk / Batch Rate",
    plural: "Milk & Batch Rates",
    costField: "total_cost_per_l",
    groups: [
      { code: "composition", label: "Composition" },
      { code: "build_up", label: "Cost build-up per litre" },
    ],
    fields: [
      { key: "fat", label: "Fat", group: "composition", value: 0, suffix: "%" },
      { key: "snf", label: "SNF", group: "composition", value: 0, suffix: "%" },
      {
        key: "solids_rate", label: "Solids rate", group: "build_up",
        formula: "(fat + snf) * P.base_rate / P.ts_divisor", tags: ["batch_cost"],
        description: "(Fat + SNF) × base rate ÷ TS divisor",
      },
      { key: "commission", label: "Sachiv commission", group: "build_up", formula: "solids_rate * P.sachiv_commission_pct", tags: ["batch_cost"] },
      { key: "proc_transport", label: "Procurement transport", group: "build_up", formula: "P.proc_transport_rate / P.proc_transport_basis * (fat + snf)", tags: ["batch_cost"] },
      { key: "utilities", label: "Coal + labour + power + staff", group: "build_up", formula: "P.utilities_default", tags: ["batch_cost"] },
      { key: "chemicals", label: "Chemicals", group: "build_up", formula: "P.chemicals_default", tags: ["batch_cost"] },
      { key: "total_cost_per_l", label: "Total batch cost / litre", group: "build_up", rollup: "batch_cost", total: true, decimals: 4 },
    ],
  },
  {
    code: "ingredient",
    name: "Ingredient",
    plural: "Ingredients",
    costField: "rate",
    groups: [{ code: "rates", label: "Rates" }],
    fields: [
      { key: "rate", label: "Rate per unit", group: "rates", value: 0, decimals: 4, total: true },
      { key: "unit", label: "Unit", group: "rates", dataType: "text" },
    ],
  },
  {
    code: "packaging",
    name: "Packaging Item",
    plural: "Packaging",
    costField: "rate",
    groups: [{ code: "rates", label: "Rates" }],
    fields: [
      { key: "rate", label: "Rate per piece", group: "rates", value: 0, decimals: 4, total: true },
      { key: "rate_with_gst", label: "Rate incl. GST", group: "rates", formula: "rate * (1 + P.gst_packing)", decimals: 4 },
      { key: "unit", label: "Unit", group: "rates", dataType: "text" },
    ],
  },
  {
    code: "recipe",
    name: "Recipe / Intermediate",
    plural: "Recipes",
    costField: "cost_per_kg",
    groups: [{ code: "build_up", label: "Build-up" }],
    fields: [
      { key: "ingredient_cost", label: "Ingredient cost (batch)", group: "build_up", formula: 'BOM("input")' },
      { key: "yield_qty", label: "Yield", group: "build_up", value: 1, decimals: 3 },
      { key: "cost_per_kg_ingredients", label: "Ingredient cost per kg", group: "build_up", formula: "DIV(ingredient_cost, yield_qty, 0)" },
      { key: "making_charges", label: "Making charges per kg", group: "build_up", value: 0 },
      { key: "cost_per_kg", label: "Cost per kg", group: "build_up", formula: "cost_per_kg_ingredients + making_charges", total: true },
    ],
  },
  {
    code: "product",
    name: "Product",
    plural: "Products",
    costField: "landed_cost",
    groups: [
      { code: "basis", label: "Basis" },
      { code: "build_up", label: "Ex-plant cost build-up" },
      { code: "packing", label: "Secondary packing" },
      { code: "market", label: "Market" },
      { code: "pricing", label: "Pricing" },
      { code: "analysis", label: "Analysis" },
    ],
    fields: [
      { key: "pack_size", label: "Pack size (L or kg)", group: "basis", value: 0, decimals: 4, description: "Litres or kilos the pack holds" },
      { key: "fill_overrun", label: "Filling overrun", group: "basis", value: 1, decimals: 8, description: "Ratio of material drawn to pack size - 1.034 means 3.4% overfill" },
      { key: "qty_per_pc", label: "Product qty / pc", group: "basis", value: 0, decimals: 4, description: "Litres or kg of batch material per piece, including overrun" },
      { key: "material_cost", label: "Product cost / pc", group: "build_up", formula: 'BOM("input")', tags: ["ex_plant"] },
      { key: "packing_cost", label: "Packing material / pc", group: "build_up", formula: 'BOM("packaging")', tags: ["ex_plant"] },
      { key: "additives_cost", label: "Additives (citric, cloth, masala)", group: "build_up", formula: 'BOM("additive")', tags: ["ex_plant"] },
      { key: "ex_plant_cost", label: "Final cost / pc (ex-plant)", group: "build_up", rollup: "ex_plant", total: true },
      { key: "unit_conv_factor", label: "Pieces per litre / kg", group: "build_up", formula: "DIV(1, qty_per_pc, 0)", decimals: 4 },
      { key: "cost_per_unit", label: "Cost per litre or kg", group: "build_up", formula: "ex_plant_cost * unit_conv_factor" },
      { key: "sec_pack_qty", label: "Pieces per crate / box", group: "packing", value: 12, decimals: 0 },
      { key: "sec_pack_cost", label: "Cost per secondary pack", group: "packing", formula: "ex_plant_cost * sec_pack_qty" },
      { key: "market_transport_rate", label: "Market transport rate", group: "market", formula: "P.market_transport_rate" },
      { key: "market_transport", label: "Market transport / pc", group: "market", formula: "market_transport_rate * qty_per_pc" },
      { key: "landed_cost", label: "Final market landed cost / pc", group: "market", formula: "ex_plant_cost + market_transport", total: true },
      { key: "markup_factor", label: "Markup factor", group: "pricing", formula: "P.markup_default", decimals: 3 },
      { key: "selling_price", label: "Selling price / pc", group: "pricing", formula: "landed_cost * markup_factor" },
      { key: "gst_output_rate", label: "Output GST", group: "pricing", formula: "P.gst_output", suffix: "%", decimals: 3 },
      { key: "price_with_tax", label: "Price incl. GST", group: "pricing", formula: "selling_price * (1 + gst_output_rate)" },
      { key: "input_credit", label: "Input credit on packing", group: "analysis", formula: "packing_cost - packing_cost / (1 + P.gst_packing)", decimals: 4 },
      { key: "packing_share", label: "Packing share of ex-plant", group: "analysis", formula: "DIV(packing_cost, ex_plant_cost, 0)", decimals: 4, suffix: "%" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Milk / batch rates  (workbook rows 48-60)
// ---------------------------------------------------------------------------
const FERMENTED = { chemicals: "P.chemicals_fermented" };

const MILK_BATCHES: ObjSpec[] = [
  { code: "toned_milk", name: "Toned Milk", values: { fat: 3.05, snf: 8.55 } },
  { code: "toned_plus", name: "Toned + Milk", values: { fat: 3.55, snf: 8.55 } },
  { code: "double_toned", name: "Double Toned Milk", values: { fat: 1.55, snf: 9.05 } },
  { code: "cow_milk", name: "Cow Milk", values: { fat: 4, snf: 8.5 } },
  { code: "standard_milk", name: "Standard Milk", values: { fat: 4.55, snf: 8.55 } },
  { code: "tea_plus", name: "Tea +", values: { fat: 2.8, snf: 9.7 } },
  { code: "plain_dahi", name: "Plain Dahi", values: { fat: 3, snf: 11.5, ...FERMENTED } },
  { code: "plain_dahi_bulk", name: "Plain Dahi (5 kg)", values: { fat: 3, snf: 11.5, ...FERMENTED } },
  { code: "pd_bucket", name: "Plain Dahi (Bucket)", values: { fat: 1, snf: 10, ...FERMENTED } },
  { code: "kadhi_dahi", name: "Kadhi Dahi", values: { fat: 0, snf: 10, ...FERMENTED } },
  { code: "flavoured_dahi", name: "Flavoured Dahi", values: { fat: 3, snf: 11.5, ...FERMENTED } },
  { code: "paneer_milk", name: "Paneer Milk", values: { fat: 4.5, snf: 8.5 } },
  {
    code: "ghee_base",
    name: "Ghee (raw material basis)",
    notes: "Costed off butter, not fat/SNF - hence the overridden solids rate.",
    values: {
      fat: 100,
      snf: 0,
      solids_rate: "P.butter_rate / P.butter_ghee_yield * P.ghee_conv_factor",
      commission: 0,
      proc_transport: 0,
      utilities: "P.ghee_processing_cost",
      chemicals: 0,
    },
  },
];

// ---------------------------------------------------------------------------
// Ingredients and packaging
// ---------------------------------------------------------------------------
const INGREDIENTS: ObjSpec[] = [
  { code: "sugar", name: "Sugar", values: { rate: "P.sugar_rate", unit: "kg" } },
  { code: "kesar_colour", name: "Kesar colour", values: { rate: 1, unit: "g" } },
  { code: "kesar_flavour", name: "Kesar flavour", values: { rate: 1, unit: "ml" } },
  { code: "elaichi_seed", name: "Elaichi seed", values: { rate: 1, unit: "g" } },
  { code: "elaichi_oil", name: "Elaichi oil", values: { rate: 1, unit: "ml" } },
];

const PACKAGING: ObjSpec[] = [
  { code: "cup_dahi_90", name: "Cup - dahi 90 g", values: { rate: 1.59, unit: "pc" } },
  { code: "lid_dahi_90", name: "Foil lid - 90 g cup", values: { rate: 0.49, unit: "pc" } },
  { code: "carton_dahi_90", name: "Carton - 90 g cup (12s)", values: { rate: 6.5, unit: "box" } },
  { code: "cup_dahi_200", name: "Cup - dahi 200 g", values: { rate: 2.59, unit: "pc" } },
  { code: "lid_dahi_200", name: "Foil lid - 200 g cup", values: { rate: 0.45, unit: "pc" } },
  { code: "carton_dahi_200", name: "Carton - 200 g cup (12s)", values: { rate: 7.84, unit: "box" } },
  { code: "cup_dahi_180", name: "Cup - dahi 180 g", values: { rate: 1.95, unit: "pc" } },
  { code: "lid_dahi_180", name: "Foil lid - 180 g cup", values: { rate: 0.14, unit: "pc" } },
  { code: "sleeve_dahi_180", name: "Sleeve / label - 180 g cup", values: { rate: 0.74, unit: "pc" } },
  { code: "carton_dahi_180", name: "Carton - 180 g cup (8s)", values: { rate: 11.2, unit: "box" } },
  { code: "cup_flavoured_90", name: "Cup - flavoured dahi 90 g", values: { rate: 1.38, unit: "pc" } },
  { code: "bucket_5kg", name: "Bucket - 5 kg", values: { rate: 29.5, unit: "pc" } },
  { code: "bucket_5kg_lid", name: "Bucket lid - 5 kg", values: { rate: 1.5, unit: "pc" } },
  { code: "bucket_15kg", name: "Bucket - 15 kg", values: { rate: 79, unit: "pc" } },
  { code: "bucket_15kg_lid", name: "Bucket lid - 15 kg", values: { rate: 3, unit: "pc" } },
  { code: "glass_180", name: "Glass - 180 ml", values: { rate: 2.8, unit: "pc" } },
  { code: "lid_glass_180", name: "Lid - 180 ml glass", values: { rate: 0.14, unit: "pc" } },
  { code: "straw_label_180", name: "Straw + label - 180 ml glass", values: { rate: 0.5, unit: "pc" } },
  { code: "carton_glass_180", name: "Carton - 180 ml glass (8s)", values: { rate: 8.68, unit: "box" } },
  { code: "cup_shrikhand_80", name: "Cup - shrikhand 80 g", values: { rate: 3, unit: "pc" } },
  { code: "lid_shrikhand_80", name: "Foil lid - shrikhand", values: { rate: 0.42, unit: "pc" } },
  { code: "carton_shrikhand", name: "Carton - shrikhand (12s)", values: { rate: 5.5, unit: "box" } },
  { code: "jar_ghee_100", name: "Jar - ghee 100 ml", values: { rate: 6.12, unit: "pc" } },
  { code: "carton_ghee_100", name: "Carton - ghee 100 ml (120s)", values: { rate: 68.75, unit: "box" } },
  { code: "jar_ghee_200", name: "Jar - ghee 200 ml", values: { rate: 7.8, unit: "pc" } },
  { code: "carton_ghee_200", name: "Carton - ghee 200 ml (80s)", values: { rate: 74, unit: "box" } },
  { code: "jar_ghee_500", name: "Jar - ghee 500 ml", values: { rate: 12.25, unit: "pc" } },
  { code: "carton_ghee_500", name: "Carton - ghee 500 ml (24s)", values: { rate: 48.5, unit: "box" } },
  { code: "jar_ghee_1l", name: "Jar - ghee 1 L", values: { rate: 21, unit: "pc" } },
  { code: "carton_ghee_1l", name: "Carton - ghee 1 L (16s)", values: { rate: 58, unit: "box" } },
  { code: "jar_ghee_5l", name: "Jar - ghee 5 L", values: { rate: 49.5, unit: "pc" } },
  { code: "carton_ghee_5l", name: "Carton - ghee 5 L (4s)", values: { rate: 45, unit: "box" } },
  { code: "tin_ghee_15kg", name: "Tin - ghee 15 kg", values: { rate: 131, unit: "pc" } },
  { code: "tin_lid_15kg", name: "Tin lid - 15 kg", values: { rate: 17, unit: "pc" } },
  { code: "carton_ghee_15kg", name: "Carton - ghee 15 kg", values: { rate: 27.27, unit: "pc" } },
];

// ---------------------------------------------------------------------------
// Recipes (workbook rows 66-85)
// ---------------------------------------------------------------------------
const RECIPES: ObjSpec[] = [
  {
    code: "shrikhand_base",
    name: "Kesar Elaichi Shrikhand base",
    notes: "5 kg curd yields 2 kg chakka; + 1.4 kg sugar = 3.4 kg. Making charge is an assumption with no costed basis yet.",
    values: { yield_qty: 3.4, making_charges: 20 },
    lines: [
      { type: "input", label: "Curd", comp: "plain_dahi", qty: 5 },
      { type: "input", label: "Sugar", comp: "sugar", qty: 1.4 },
      { type: "input", label: "Kesar colour", comp: "kesar_colour", qty: 0.2 },
      { type: "input", label: "Kesar flavour", comp: "kesar_flavour", qty: 10 },
      { type: "input", label: "Elaichi seed", comp: "elaichi_seed", qty: 2 },
      { type: "input", label: "Elaichi oil", comp: "elaichi_oil", qty: 4 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Products (workbook rows 2-43)
// gst-loaded packaging lines use rate_with_gst on the packaging object.
// ---------------------------------------------------------------------------
const gst = (comp: string, divisor: Num = 1, label?: string): LineSpec => ({
  type: "packaging", comp, divisor, label, qty: 1, rate: `O.${comp}.rate_with_gst`,
});
const pack = (comp: string, divisor: Num = 1, label?: string): LineSpec => ({
  type: "packaging", comp, divisor, label, qty: 1,
});

const PRODUCTS: ObjSpec[] = [
  // ---- liquid milk pouches -------------------------------------------------
  {
    code: "tm_500", name: "TM 500 ml Pouch",
    values: { qty_per_pc: 0.517, packing_cost: 0.6, additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty", selling_price: 21.6 },
    lines: [{ type: "input", comp: "toned_milk", qty: "qty_per_pc" }],
  },
  {
    code: "tm_200", name: "TM 200 ml Pouch",
    values: { qty_per_pc: 0.207, packing_cost: 0.24, additives_cost: 0, unit_conv_factor: 5, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty", market_transport_rate: 2.25 },
    lines: [{ type: "input", comp: "toned_milk", qty: "qty_per_pc" }],
  },
  {
    code: "tm_plus_500", name: "TM Plus 500 ml Pouch",
    values: { qty_per_pc: 0.517, packing_cost: 0.6, additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty", selling_price: 22.91 },
    lines: [{ type: "input", comp: "toned_plus", qty: "qty_per_pc" }],
  },
  {
    code: "dtm_500", name: "DTM 500 ml Pouch",
    values: { qty_per_pc: 0.517, packing_cost: 0.55, additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "double_toned", qty: "qty_per_pc" }],
  },
  {
    code: "dtm_200", name: "DTM 200 ml Pouch",
    values: { qty_per_pc: 0.207, packing_cost: 0.36, additives_cost: 0, unit_conv_factor: 5, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "double_toned", qty: "qty_per_pc" }],
  },
  {
    code: "cow_milk_500", name: "Cow Milk 500 ml Pouch",
    values: { qty_per_pc: 0.517, packing_cost: 0.6, additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "cow_milk", qty: "qty_per_pc" }],
  },
  {
    code: "sm_500", name: "Standard Milk 500 ml Pouch",
    values: { qty_per_pc: 0.517, packing_cost: 0.6, additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "standard_milk", qty: "qty_per_pc" }],
  },
  {
    code: "sm_200", name: "Standard Milk 200 ml Pouch",
    values: { qty_per_pc: 0.207, packing_cost: 0.24, additives_cost: 0, unit_conv_factor: 5, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "standard_milk", qty: "qty_per_pc" }],
  },
  {
    code: "tea_plus_500", name: "Tea + 500 ml Pouch",
    values: { qty_per_pc: 0.517, packing_cost: 0.6, additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "tea_plus", qty: "qty_per_pc" }],
  },

  // ---- dahi ----------------------------------------------------------------
  {
    code: "plain_dahi_90g_cup", name: "Plain Dahi 90 g Cup",
    values: { qty_per_pc: 0.092, additives_cost: 0, unit_conv_factor: "1000 / 90", sec_pack_qty: 12 },
    lines: [
      { type: "input", comp: "plain_dahi", qty: "qty_per_pc" },
      gst("cup_dahi_90"), gst("lid_dahi_90"), gst("carton_dahi_90", 12),
    ],
  },
  {
    code: "plain_dahi_200g_cup", name: "Plain Dahi 200 g Cup",
    notes: "Was a 100 g cup, changed to 200 g.",
    values: { qty_per_pc: 0.203, additives_cost: 0, sec_pack_qty: 12, market_transport_rate: 2.25 },
    lines: [
      { type: "input", comp: "plain_dahi", qty: "qty_per_pc" },
      pack("cup_dahi_200"), pack("lid_dahi_200"), pack("carton_dahi_200", 12),
    ],
  },
  {
    code: "plain_dahi_180g_cup", name: "Plain Dahi 180 g Cup",
    values: { qty_per_pc: 0.183, additives_cost: 0, unit_conv_factor: "1000 / 180", sec_pack_qty: 8 },
    lines: [
      { type: "input", comp: "plain_dahi", qty: "qty_per_pc" },
      pack("cup_dahi_180"), pack("lid_dahi_180"), pack("sleeve_dahi_180"), pack("carton_dahi_180", 8),
    ],
  },
  {
    code: "plain_dahi_200g_pouch", name: "Plain Dahi 200 g Pouch",
    values: { qty_per_pc: 0.203, packing_cost: 0.36, additives_cost: 0, unit_conv_factor: 5, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "plain_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "plain_dahi_400g_pouch", name: "Plain Dahi 400 g Pouch",
    values: { qty_per_pc: 0.403, packing_cost: 0.55, additives_cost: 0, unit_conv_factor: 2.5, sec_pack_qty: 24 },
    lines: [{ type: "input", comp: "plain_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "plain_dahi_1kg_pouch", name: "Plain Dahi 1 kg Pouch",
    values: { qty_per_pc: 1.003, packing_cost: 0.9, additives_cost: 0, unit_conv_factor: 1, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "plain_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "plain_dahi_5kg_pouch", name: "Plain Dahi 5 kg Pouch",
    values: { qty_per_pc: 5.01, packing_cost: 5.3, additives_cost: 0, sec_pack_qty: 2, sec_pack_cost: "cost_per_unit * qty_per_pc * sec_pack_qty" },
    lines: [{ type: "input", comp: "plain_dahi_bulk", qty: "qty_per_pc" }],
  },
  {
    code: "plain_dahi_5kg_bucket", name: "Plain Dahi 5 kg Bucket",
    values: { qty_per_pc: 5.01, additives_cost: 0, sec_pack_qty: 5, sec_pack_cost: "cost_per_unit * sec_pack_qty", market_transport_rate: 2.25 },
    lines: [
      { type: "input", comp: "pd_bucket", qty: "qty_per_pc" },
      pack("bucket_5kg"), pack("bucket_5kg_lid"),
    ],
  },
  {
    code: "plain_dahi_15kg_bucket", name: "Plain Dahi 15 kg Bucket",
    values: { qty_per_pc: 15.01, additives_cost: 0, sec_pack_qty: 15, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [
      { type: "input", comp: "pd_bucket", qty: "qty_per_pc" },
      pack("bucket_15kg"), pack("bucket_15kg_lid"),
    ],
  },
  {
    code: "kadhi_dahi_200g_pouch", name: "Kadhi Dahi 200 g Pouch",
    values: { qty_per_pc: 0.203, packing_cost: 0.36, additives_cost: 0, sec_pack_qty: 40 },
    lines: [{ type: "input", comp: "kadhi_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "kadhi_dahi_1kg_pouch", name: "Kadhi Dahi 1 kg Pouch",
    values: { qty_per_pc: 1.003, packing_cost: 0.9, additives_cost: 0, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "kadhi_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "kadhi_dahi_5kg_pouch", name: "Kadhi Dahi 5 kg Pouch",
    values: { qty_per_pc: 5.01, packing_cost: 5.3, additives_cost: 0, sec_pack_qty: 2, sec_pack_cost: "cost_per_unit * qty_per_pc * sec_pack_qty" },
    lines: [{ type: "input", comp: "kadhi_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "kadhi_dahi_5kg_bucket", name: "Kadhi Dahi 5 kg Bucket",
    values: { qty_per_pc: 5.01, packing_cost: "O.plain_dahi_5kg_bucket.packing_cost", additives_cost: 0, sec_pack_qty: 5, sec_pack_cost: "cost_per_unit * sec_pack_qty", market_transport_rate: 2.25 },
    lines: [{ type: "input", comp: "kadhi_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "kadhi_dahi_15kg_bucket", name: "Kadhi Dahi 15 kg Bucket",
    values: { qty_per_pc: 15.01, packing_cost: "O.plain_dahi_15kg_bucket.packing_cost", additives_cost: 0, sec_pack_qty: 15, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "kadhi_dahi", qty: "qty_per_pc" }],
  },
  {
    code: "flavoured_dahi_90g_cup", name: "Flavoured Dahi 90 g Cup (Melon & Lychee)",
    values: { qty_per_pc: 0.092, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty * pack_size" },
    lines: [
      { type: "input", comp: "flavoured_dahi", qty: "qty_per_pc" },
      gst("cup_flavoured_90"), gst("lid_dahi_90"), gst("carton_dahi_90", 12),
      { type: "additive", label: "Fruit prep (melon / lychee)", rate: 0.8, qty: 1 },
    ],
  },

  // ---- lassi / chaach ------------------------------------------------------
  {
    code: "sweet_lassi_180ml_pouch", name: "Sweet Lassi 180 ml Pouch",
    notes: "Workbook note: 120 parts curd in 300 - the dilution behind the input quantity.",
    values: { qty_per_pc: 0.187, packing_cost: 0.36, sec_pack_qty: 12 },
    lines: [
      { type: "input", label: "Curd base (120 of 300 parts)", comp: "plain_dahi", qty: "qty_per_pc * P.lassi_curd_fraction" },
      { type: "additive", label: "Sugar / flavour blend", qty: 1, rate: "(P.lassi_sugar_rate * P.lassi_sugar_per_300l / 300 * qty_per_pc) + P.lassi_flavour_cost" },
    ],
  },
  {
    code: "sweet_lassi_180ml_glass", name: "Sweet Lassi 180 ml Glass",
    notes: "Ex-plant cost is a standing estimate in the workbook, not yet built up from inputs.",
    values: { qty_per_pc: 0.187, ex_plant_cost: 13, sec_pack_qty: 8 },
  },
  {
    code: "mango_lassi_180ml_glass", name: "Mango Lassi 180 ml Glass",
    values: { qty_per_pc: 0.187, additives_cost: 0, sec_pack_qty: 8 },
    lines: [
      { type: "input", label: "Lassi mix", qty: "qty_per_pc", rate: "P.lassi_mix_rate" },
      pack("glass_180"), pack("lid_glass_180"), pack("straw_label_180"), pack("carton_glass_180", 8),
    ],
  },
  {
    code: "strawberry_lassi_180ml_glass", name: "Strawberry Lassi 180 ml Glass",
    values: { qty_per_pc: 0.187, additives_cost: 0, sec_pack_qty: 8 },
    lines: [
      { type: "input", label: "Lassi mix", qty: "qty_per_pc", rate: "P.lassi_mix_rate" },
      pack("glass_180"), pack("lid_glass_180"), pack("straw_label_180"), pack("carton_glass_180", 8),
    ],
  },
  {
    code: "masala_chaach_200ml_pouch", name: "Masala Chaach 200 ml Pouch",
    notes: "Workbook notes: 100 parts curd in 300; a loose cell alongside held 100/5.8 = 17.24, "
      + "which no formula referenced.",
    values: { qty_per_pc: 0.207, packing_cost: 0.36, sec_pack_qty: 12, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [
      { type: "input", label: "Curd base (100 of 300 parts)", comp: "plain_dahi", qty: "qty_per_pc * P.chaach_curd_fraction" },
      { type: "additive", label: "Masala blend", qty: 1, rate: 0.57 },
    ],
  },

  // ---- shrikhand -----------------------------------------------------------
  {
    code: "shrikhand_80g_cup", name: "Kesar Elaichi Shrikhand 80 g Cup",
    notes: "Filled at 83 g. Market transport is charged at 4% of ex-plant cost, not per kg.",
    values: { qty_per_pc: 0.083, additives_cost: 0, sec_pack_qty: 12, market_transport: "ex_plant_cost * P.market_transport_pct" },
    lines: [
      { type: "input", comp: "shrikhand_base", qty: "qty_per_pc" },
      pack("cup_shrikhand_80"), pack("lid_shrikhand_80"), pack("carton_shrikhand", 12),
    ],
  },

  // ---- paneer --------------------------------------------------------------
  {
    code: "paneer_1kg", name: "Paneer 1 kg",
    notes: "Milk requirement reflects the current production method and moisture standard.",
    values: { qty_per_pc: "100 / P.paneer_yield_per_100l", packing_cost: 4, additives_cost: "P.paneer_additive_rate * pack_size", unit_conv_factor: 1, sec_pack_qty: 1, sec_pack_cost: "cost_per_unit" },
    lines: [{ type: "input", comp: "paneer_milk", qty: "qty_per_pc" }],
  },
  {
    code: "paneer_200g", name: "Paneer 200 g",
    values: { qty_per_pc: "O.paneer_1kg.qty_per_pc / 5", packing_cost: 2.5, additives_cost: "P.paneer_additive_rate * pack_size", unit_conv_factor: 5, sec_pack_qty: 5, sec_pack_cost: "cost_per_unit / sec_pack_qty" },
    lines: [{ type: "input", comp: "paneer_milk", qty: "qty_per_pc" }],
  },
  {
    code: "paneer_500g", name: "Paneer 500 g",
    values: { qty_per_pc: "O.paneer_1kg.qty_per_pc / 2", packing_cost: 3.5, additives_cost: "P.paneer_additive_rate * pack_size", unit_conv_factor: 2, sec_pack_qty: 2, sec_pack_cost: "cost_per_unit / sec_pack_qty" },
    lines: [{ type: "input", comp: "paneer_milk", qty: "qty_per_pc" }],
  },
  {
    code: "paneer_5kg_loose", name: "Paneer 5 kg (Loose)",
    values: { qty_per_pc: "O.paneer_1kg.qty_per_pc * 5", packing_cost: 5.5, additives_cost: "P.paneer_additive_rate * pack_size", unit_conv_factor: "1 / 5", sec_pack_qty: 5, sec_pack_cost: "cost_per_unit * sec_pack_qty" },
    lines: [{ type: "input", comp: "paneer_milk", qty: "qty_per_pc" }],
  },

  // ---- khowa / peda --------------------------------------------------------
  {
    code: "khowa_brown_1kg", name: "Khowa Brown (Unsweetened) 1 kg",
    values: {
      qty_per_pc: 5,
      material_cost: "P.landed_per_kg_ts * P.khowa_ts_ratio + P.khowa_processing_cost",
      packing_cost: 2.8, additives_cost: 0, unit_conv_factor: 1, sec_pack_qty: 1, sec_pack_cost: "cost_per_unit",
    },
  },
  {
    code: "milk_peda_200g", name: "Milk Peda 200 g (Plastic Box)",
    notes: "Standing landed cost from the workbook - no quantity, material or packing costed for this SKU yet.",
    values: { landed_cost: 60, sec_pack_qty: 12 },
  },

  // ---- ghee ----------------------------------------------------------------
  {
    code: "ghee_100ml", name: "Ghee 100 ml",
    values: { qty_per_pc: "0.1 * P.ghee_density * 1.01", packing_cost: 'BOM("packaging") + BOM("transport")', additives_cost: 0, unit_conv_factor: 10, sec_pack_qty: 120, markup_factor: "P.markup_ghee" },
    lines: [
      { type: "input", comp: "ghee_base", qty: "qty_per_pc" },
      pack("carton_ghee_100", 120), pack("jar_ghee_100"),
      { type: "transport", label: "Primary + secondary transport on pack material", qty: 1, rate: 0.226,
        notes: "Workbook derived this as half the 200 ml rate" },
    ],
  },
  {
    code: "ghee_200ml", name: "Ghee 200 ml",
    values: { qty_per_pc: "0.2 * P.ghee_density * 1.008", packing_cost: 'BOM("packaging") + BOM("transport")', additives_cost: 0, unit_conv_factor: 5, sec_pack_qty: 80, markup_factor: "P.markup_ghee" },
    lines: [
      { type: "input", comp: "ghee_base", qty: "qty_per_pc" },
      pack("carton_ghee_200", 80), pack("jar_ghee_200"),
      { type: "transport", label: "Primary + secondary transport on pack material", qty: 1, rate: 0.452,
        notes: "Workbook derived this as (2.06 + 0.20) / 5 per pack" },
    ],
  },
  {
    code: "ghee_500ml", name: "Ghee 500 ml",
    values: { qty_per_pc: "0.5 * P.ghee_density * 1.004", packing_cost: 'BOM("packaging") + BOM("transport")', additives_cost: 0, unit_conv_factor: 2, sec_pack_qty: 32, markup_factor: "P.markup_ghee" },
    lines: [
      { type: "input", comp: "ghee_base", qty: "qty_per_pc" },
      pack("carton_ghee_500", 24), pack("jar_ghee_500"),
      { type: "transport", label: "Primary + secondary transport on pack material", qty: 1, rate: 1.13,
        notes: "Workbook derived this as (2.06 + 0.20) / 2 per pack" },
    ],
  },
  {
    code: "ghee_1l", name: "Ghee 1 L",
    values: { qty_per_pc: "1 * P.ghee_density * 1.003", packing_cost: 'BOM("packaging") + BOM("transport")', additives_cost: 0, unit_conv_factor: 1, sec_pack_qty: 16, markup_factor: "P.markup_ghee" },
    lines: [
      { type: "input", comp: "ghee_base", qty: "qty_per_pc" },
      pack("carton_ghee_1l", 16), pack("jar_ghee_1l"),
      { type: "transport", label: "Primary + secondary transport on pack material", qty: 1, rate: 2.05,
        notes: "Workbook derived this as 1.65 + 0.40 per pack" },
    ],
  },
  {
    code: "ghee_5l", name: "Ghee 5 L",
    values: { qty_per_pc: "5 * P.ghee_density * 1.002", packing_cost: 'BOM("packaging") + BOM("transport")', additives_cost: 0, unit_conv_factor: "1 / 5", sec_pack_qty: 4, markup_factor: "P.markup_ghee" },
    lines: [
      { type: "input", comp: "ghee_base", qty: "qty_per_pc" },
      pack("carton_ghee_5l", 4), pack("jar_ghee_5l"),
      { type: "transport", label: "Primary + secondary transport on pack material", qty: 1, rate: 3 },
    ],
  },
  {
    code: "ghee_15kg_tin", name: "Ghee 15 kg (Tin)",
    notes: "A loose workbook cell held an alternative per-kg figure, ((420 x 15) + 200) / 15 = "
      + "433.33, which no formula referenced.",
    values: { qty_per_pc: "15 * 1.002", packing_cost: 'BOM("packaging") + BOM("transport")', additives_cost: 0, sec_pack_qty: 1, markup_factor: "P.markup_ghee" },
    lines: [
      { type: "input", comp: "ghee_base", qty: "qty_per_pc" },
      pack("tin_ghee_15kg"), pack("tin_lid_15kg"), pack("carton_ghee_15kg"),
      { type: "transport", label: "Primary + secondary transport on pack material", qty: 1, rate: 10.94 },
    ],
  },
];


// ---------------------------------------------------------------------------
// Pack size and filling overrun, so qty_per_pc stops being a magic number:
// a 500 ml pouch holds 0.5 L and is filled 3.4% over, hence 0.517.
// `qty` overrides the default formula where the draw is not simply pack x overrun.
// ---------------------------------------------------------------------------
const MILK_QTY = "pack_size * fill_overrun";
const PANEER_QTY = "pack_size * 100 / P.paneer_yield_per_100l";
const GHEE_QTY = "pack_size * P.ghee_density * fill_overrun";

const PACKS: Record<string, { size: number; overrun?: number; qty?: string }> = {
  tm_500: { size: 0.5, overrun: 1.034 },
  tm_200: { size: 0.2, overrun: 1.035 },
  tm_plus_500: { size: 0.5, overrun: 1.034 },
  dtm_500: { size: 0.5, overrun: 1.034 },
  dtm_200: { size: 0.2, overrun: 1.035 },
  cow_milk_500: { size: 0.5, overrun: 1.034 },
  sm_500: { size: 0.5, overrun: 1.034 },
  sm_200: { size: 0.2, overrun: 1.035 },
  tea_plus_500: { size: 0.5, overrun: 1.034 },
  plain_dahi_90g_cup: { size: 0.09, overrun: 1.02222222 },
  plain_dahi_200g_cup: { size: 0.2, overrun: 1.015 },
  plain_dahi_180g_cup: { size: 0.18, overrun: 1.01666667 },
  plain_dahi_200g_pouch: { size: 0.2, overrun: 1.015 },
  plain_dahi_400g_pouch: { size: 0.4, overrun: 1.0075 },
  plain_dahi_1kg_pouch: { size: 1, overrun: 1.003 },
  plain_dahi_5kg_pouch: { size: 5, overrun: 1.002 },
  plain_dahi_5kg_bucket: { size: 5, overrun: 1.002 },
  plain_dahi_15kg_bucket: { size: 15, overrun: 1.00066667 },
  kadhi_dahi_200g_pouch: { size: 0.2, overrun: 1.015 },
  kadhi_dahi_1kg_pouch: { size: 1, overrun: 1.003 },
  kadhi_dahi_5kg_pouch: { size: 5, overrun: 1.002 },
  kadhi_dahi_5kg_bucket: { size: 5, overrun: 1.002 },
  kadhi_dahi_15kg_bucket: { size: 15, overrun: 1.00066667 },
  flavoured_dahi_90g_cup: { size: 0.09, overrun: 1.02222222 },
  sweet_lassi_180ml_pouch: { size: 0.18, overrun: 1.03888889 },
  sweet_lassi_180ml_glass: { size: 0.18, overrun: 1.03888889 },
  mango_lassi_180ml_glass: { size: 0.18, overrun: 1.03888889 },
  strawberry_lassi_180ml_glass: { size: 0.18, overrun: 1.03888889 },
  masala_chaach_200ml_pouch: { size: 0.2, overrun: 1.035 },
  shrikhand_80g_cup: { size: 0.08, overrun: 1.0375 },
  paneer_1kg: { size: 1, qty: PANEER_QTY },
  paneer_200g: { size: 0.2, qty: PANEER_QTY },
  paneer_500g: { size: 0.5, qty: PANEER_QTY },
  paneer_5kg_loose: { size: 5, qty: PANEER_QTY },
  khowa_brown_1kg: { size: 1, qty: "pack_size * P.khowa_milk_per_kg" },
  milk_peda_200g: { size: 0.2, qty: "" },
  ghee_100ml: { size: 0.1, overrun: 1.01, qty: GHEE_QTY },
  ghee_200ml: { size: 0.2, overrun: 1.008, qty: GHEE_QTY },
  ghee_500ml: { size: 0.5, overrun: 1.004, qty: GHEE_QTY },
  ghee_1l: { size: 1, overrun: 1.003, qty: GHEE_QTY },
  ghee_5l: { size: 5, overrun: 1.002, qty: GHEE_QTY },
  ghee_15kg_tin: { size: 15, overrun: 1.002 },
};

/** Folds pack size and overrun into each product, replacing hard-coded quantities. */
function applyPacks() {
  for (const product of PRODUCTS) {
    const pack = PACKS[product.code];
    if (!pack) continue;
    const values = (product.values ??= {});
    values.pack_size = pack.size;
    if (pack.overrun !== undefined) values.fill_overrun = pack.overrun;
    const qty = pack.qty ?? MILK_QTY;
    if (qty === "") delete values.qty_per_pc;
    else values.qty_per_pc = qty;
    // pieces per litre or kg follows the pack, not the overfilled draw
    if (values.unit_conv_factor !== undefined) values.unit_conv_factor = "DIV(1, pack_size, 0)";
  }
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------
async function main() {
  applyPacks();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local app.actor = 'seed'");
    await client.query("truncate scenario, app_user, uom restart identity cascade");

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "darshan@vamaadairy.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "costing123";
    const user = await client.query<{ id: string }>(
      `insert into app_user (email, name, role, password_hash)
       values ($1, $2, 'owner', $3) returning id`,
      [adminEmail, "Darshan", await bcrypt.hash(adminPassword, 10)],
    );

    for (const [i, u] of [
      ["l", "Litre", "volume"], ["kg", "Kilogram", "mass"], ["g", "Gram", "mass"],
      ["ml", "Millilitre", "volume"], ["pc", "Piece", "count"], ["box", "Box", "count"],
    ].entries()) {
      await client.query(
        `insert into uom (code, name, dimension, sort_order) values ($1, $2, $3, $4)`,
        [u[0], u[1], u[2], i],
      );
    }

    const scenario = await client.query<{ id: string }>(
      `insert into scenario (code, name, description, effective_from, status, created_by)
       values ('base_2026', 'Base costing 2026', $1, current_date, 'active', $2) returning id`,
      ["Imported from COST OF PRODUCTS_26Dec25_27Feb24TptRvisd.xlsx", user.rows[0].id],
    );
    const sid = scenario.rows[0].id;

    // parameters
    for (const [i, p] of PARAMETERS.entries()) {
      await client.query(
        `insert into parameter (scenario_id, key, label, group_name, value_num, formula,
                                suffix, description, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [sid, p.key, p.label, p.group, p.value ?? null, p.formula ?? null,
         p.suffix ?? null, p.description ?? null, i],
      );
    }

    // classes, groups, fields
    const classId = new Map<string, string>();
    const fieldId = new Map<string, string>(); // `${classCode}.${key}`
    for (const [ci, c] of CLASSES.entries()) {
      const row = await client.query<{ id: string }>(
        `insert into object_class (scenario_id, code, name, plural_name, cost_field, is_locked, sort_order)
         values ($1,$2,$3,$4,$5,true,$6) returning id`,
        [sid, c.code, c.name, c.plural, c.costField, ci],
      );
      classId.set(c.code, row.rows[0].id);

      const groupId = new Map<string, string>();
      for (const [gi, g] of c.groups.entries()) {
        const gr = await client.query<{ id: string }>(
          `insert into field_group (scenario_id, class_id, code, label, sort_order)
           values ($1,$2,$3,$4,$5) returning id`,
          [sid, row.rows[0].id, g.code, g.label, gi],
        );
        groupId.set(g.code, gr.rows[0].id);
      }

      for (const [fi, f] of c.fields.entries()) {
        const fr = await client.query<{ id: string }>(
          `insert into field_def (scenario_id, class_id, key, label, data_type, group_id, default_value,
                                  default_formula, rollup_group, is_total, decimals, suffix, description, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
          [sid, row.rows[0].id, f.key, f.label, f.dataType ?? "number",
           f.group ? groupId.get(f.group) : null, f.value ?? null, f.formula ?? null,
           f.rollup ?? null, f.total ?? false, f.decimals ?? 2, f.suffix ?? null,
           f.description ?? null, fi],
        );
        fieldId.set(`${c.code}.${f.key}`, fr.rows[0].id);
        for (const tag of f.tags ?? []) {
          await client.query(
            `insert into field_rollup_tag (field_def_id, tag) values ($1,$2)`,
            [fr.rows[0].id, tag],
          );
        }
      }
    }

    // objects
    const objectId = new Map<string, string>();
    const objectClass = new Map<string, string>();
    const groups: Array<[string, ObjSpec[]]> = [
      ["milk_batch", MILK_BATCHES],
      ["ingredient", INGREDIENTS],
      ["packaging", PACKAGING],
      ["recipe", RECIPES],
      ["product", PRODUCTS],
    ];

    for (const [classCode, specs] of groups) {
      for (const [i, o] of specs.entries()) {
        const row = await client.query<{ id: string }>(
          `insert into cost_object (scenario_id, class_id, code, name, notes, sort_order)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [sid, classId.get(classCode), o.code, o.name, o.notes ?? null, i],
        );
        objectId.set(o.code, row.rows[0].id);
        objectClass.set(o.code, classCode);
      }
    }

    // field values
    for (const [classCode, specs] of groups) {
      for (const o of specs) {
        for (const [key, raw] of Object.entries(o.values ?? {})) {
          const fid = fieldId.get(`${classCode}.${key}`);
          if (!fid) throw new Error(`Unknown field ${classCode}.${key} on ${o.code}`);
          if (raw === null) continue;
          const isText = CLASSES.find((c) => c.code === classCode)!
            .fields.find((f) => f.key === key)!.dataType === "text";
          await client.query(
            `insert into field_value (object_id, field_def_id, formula, value_num, value_text)
             values ($1,$2,$3,$4,$5)`,
            isText
              ? [objectId.get(o.code), fid, null, null, String(raw)]
              : [objectId.get(o.code), fid,
                 isFormula(raw) ? raw : null,
                 isFormula(raw) ? null : raw, null],
          );
        }
      }
    }

    // bom lines
    for (const [, specs] of groups) {
      for (const o of specs) {
        for (const [i, l] of (o.lines ?? []).entries()) {
          if (l.comp && !objectId.has(l.comp)) throw new Error(`Unknown component ${l.comp} on ${o.code}`);
          await client.query(
            `insert into bom_line (scenario_id, parent_object_id, component_object_id, line_type, label,
                                   qty, qty_formula, rate, rate_formula, divisor, divisor_formula, notes, sort_order)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [sid, objectId.get(o.code), l.comp ? objectId.get(l.comp) : null,
             l.type ?? "input", l.label ?? null,
             isFormula(l.qty) ? null : l.qty ?? null, isFormula(l.qty) ? l.qty : null,
             isFormula(l.rate) ? null : l.rate ?? null, isFormula(l.rate) ? l.rate : null,
             isFormula(l.divisor) ? 1 : l.divisor ?? 1, isFormula(l.divisor) ? l.divisor : null,
             l.notes ?? null, i],
          );
        }
      }
    }

    // daily shared-cost heads
    for (const [i, h] of [
      ["coal", "Coal / fuel", "kg"],
      ["electricity", "Electricity", "units"],
      ["labour", "Labour", "hours"],
      ["plant_staff", "Plant staff salary", "day"],
      ["chemicals_daily", "Chemicals (culture, cleaning, lab)", "day"],
      ["plant_transport", "Transport", "trips"],
      ["other_overhead", "Other plant cost", "day"],
    ].entries()) {
      await client.query(
        `insert into overhead_head (scenario_id, code, label, unit, sort_order)
         values ($1,$2,$3,$4,$5)`,
        [sid, h[0], h[1], h[2], i],
      );
    }

    await client.query("commit");
    console.log(`Seeded scenario ${sid}`);
    console.log(`  sign in as ${adminEmail} / ${adminPassword}`);
    console.log(
      `  ${PARAMETERS.length} parameters, ${CLASSES.length} classes, ` +
      `${CLASSES.reduce((n, c) => n + c.fields.length, 0)} fields, ` +
      `${groups.reduce((n, [, s]) => n + s.length, 0)} objects`,
    );
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  const { recompute } = await import("../src/lib/model/recompute");
  const scenarioRow = await pool.query<{ id: string }>(`select id from scenario limit 1`);
  const { result, durationMs } = await recompute(scenarioRow.rows[0].id, "seed");
  console.log(`  calculated ${result.nodes.size} nodes in ${durationMs} ms, ${result.errorCount} errors`);
  for (const [key, r] of result.nodes) {
    if (r.error) console.log(`    ! ${key}: ${r.error}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
