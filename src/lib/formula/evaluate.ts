import { FormulaError, type Node } from "./parser";

export type Value = number | string | boolean | null;

export interface EvalContext {
  /** Resolve a dotted reference such as P.base_rate, O.toned_milk.total, or a bare field key. */
  ref(path: string[]): Value;
  /** Sum of the current object's BOM lines, optionally filtered by line_type. */
  bom(lineType?: string): number;
  /** A single BOM line amount by label or component code. */
  line(label: string): number;
}

const num = (v: Value): number => {
  if (v === null || v === "" || v === false) return 0;
  if (v === true) return 1;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new FormulaError(`"${v}" is not a number`);
  return n;
};

const truthy = (v: Value): boolean => (typeof v === "string" ? v.length > 0 : num(v) !== 0);

type Fn = (args: Value[], ctx: EvalContext) => Value;

const FUNCTIONS: Record<string, Fn> = {
  sum: (a) => a.reduce<number>((s, v) => s + num(v), 0),
  min: (a) => Math.min(...a.map(num)),
  max: (a) => Math.max(...a.map(num)),
  avg: (a) => (a.length ? a.reduce<number>((s, v) => s + num(v), 0) / a.length : 0),
  abs: (a) => Math.abs(num(a[0])),
  round: (a) => {
    const d = a.length > 1 ? num(a[1]) : 0;
    const f = 10 ** d;
    return Math.round((num(a[0]) + Number.EPSILON) * f) / f;
  },
  roundup: (a) => {
    const f = 10 ** (a.length > 1 ? num(a[1]) : 0);
    return Math.ceil(num(a[0]) * f) / f;
  },
  rounddown: (a) => {
    const f = 10 ** (a.length > 1 ? num(a[1]) : 0);
    return Math.floor(num(a[0]) * f) / f;
  },
  ceil: (a) => Math.ceil(num(a[0])),
  floor: (a) => Math.floor(num(a[0])),
  sqrt: (a) => Math.sqrt(num(a[0])),
  pow: (a) => num(a[0]) ** num(a[1]),
  if: (a) => (truthy(a[0]) ? a[1] ?? null : a[2] ?? null),
  and: (a) => a.every(truthy),
  or: (a) => a.some(truthy),
  not: (a) => !truthy(a[0]),
  coalesce: (a) => a.find((v) => v !== null && v !== undefined && v !== "") ?? null,
  isblank: (a) => a[0] === null || a[0] === undefined || a[0] === "",
  /** Guarded division - returns 0 instead of blowing up the whole sheet. */
  div: (a) => {
    const d = num(a[1]);
    return d === 0 ? num(a[2] ?? 0) : num(a[0]) / d;
  },
  bom: (a, ctx) => ctx.bom(a[0] == null ? undefined : String(a[0])),
  line: (a, ctx) => ctx.line(String(a[0] ?? "")),
};

export function evaluate(node: Node, ctx: EvalContext): Value {
  switch (node.kind) {
    case "num":
      return node.value;
    case "str":
      return node.value;
    case "ref":
      return ctx.ref(node.path);
    case "unary": {
      const v = evaluate(node.arg, ctx);
      if (node.op === "-") return -num(v);
      if (node.op === "+") return num(v);
      return !truthy(v);
    }
    case "binary": {
      const { op } = node;
      if (op === "and") return truthy(evaluate(node.left, ctx)) && truthy(evaluate(node.right, ctx));
      if (op === "or") return truthy(evaluate(node.left, ctx)) || truthy(evaluate(node.right, ctx));

      const l = evaluate(node.left, ctx);
      const r = evaluate(node.right, ctx);
      switch (op) {
        case "+": return num(l) + num(r);
        case "-": return num(l) - num(r);
        case "*": return num(l) * num(r);
        case "/": {
          const d = num(r);
          if (d === 0) throw new FormulaError("Division by zero");
          return num(l) / d;
        }
        case "^": return num(l) ** num(r);
        case "=": return typeof l === "string" || typeof r === "string" ? l === r : num(l) === num(r);
        case "<>": return typeof l === "string" || typeof r === "string" ? l !== r : num(l) !== num(r);
        case "<": return num(l) < num(r);
        case "<=": return num(l) <= num(r);
        case ">": return num(l) > num(r);
        case ">=": return num(l) >= num(r);
      }
      throw new FormulaError(`Unknown operator ${op}`);
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new FormulaError(`Unknown function ${node.name.toUpperCase()}()`);
      return fn(node.args.map((a) => evaluate(a, ctx)), ctx);
    }
  }
}

export const FUNCTION_NAMES = Object.keys(FUNCTIONS).sort();
export const toNumber = num;
