export type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "ref"; path: string[] }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "unary"; op: "-" | "+" | "not"; arg: Node }
  | { kind: "binary"; op: BinOp; left: Node; right: Node };

export type BinOp =
  | "+" | "-" | "*" | "/" | "^"
  | "=" | "<>" | "<" | "<=" | ">" | ">="
  | "and" | "or";

export class FormulaError extends Error {}

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "eof" };

const OPS = ["<=", ">=", "<>", "!=", "==", "+", "-", "*", "/", "^", "(", ")", ",", "<", ">", "="];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, "");
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new FormulaError(`Bad number "${raw}"`);
      i = j;
      if (src[i] === "%") { i++; out.push({ t: "num", v: value / 100 }); }
      else out.push({ t: "num", v: value });
      continue;
    }

    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new FormulaError("Unterminated string");
      out.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }

    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FormulaError(`Unexpected character "${c}"`);
    out.push({ t: "op", v: op === "!=" ? "<>" : op === "==" ? "=" : op });
    i += op.length;
  }
  out.push({ t: "eof" });
  return out;
}

const BINARY_PRECEDENCE: Record<string, number> = {
  or: 1, and: 2,
  "=": 3, "<>": 3, "<": 3, "<=": 3, ">": 3, ">=": 3,
  "+": 4, "-": 4,
  "*": 5, "/": 5,
  "^": 6,
};

/**
 * Formula grammar, spreadsheet-flavoured so a plant accountant can read it:
 *   qty * O.toned_milk.total_cost + P.packing_gst * BOM("packaging")
 * Bare identifiers resolve against the object being evaluated.
 */
export function parse(src: string): Node {
  const toks = lex(src.replace(/^\s*=/, ""));
  let pos = 0;

  const peek = () => toks[pos];
  const next = () => toks[pos++];

  function expectOp(v: string) {
    const t = next();
    if (t.t !== "op" || t.v !== v) throw new FormulaError(`Expected "${v}"`);
  }

  function parseExpr(minPrec = 0): Node {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      let op: string | null = null;
      if (t.t === "op" && BINARY_PRECEDENCE[t.v] !== undefined) op = t.v;
      else if (t.t === "id" && (t.v.toLowerCase() === "and" || t.v.toLowerCase() === "or")) op = t.v.toLowerCase();
      if (!op) break;

      const prec = BINARY_PRECEDENCE[op];
      if (prec < minPrec) break;
      next();
      // ^ is right associative, everything else left
      const right = parseExpr(op === "^" ? prec : prec + 1);
      left = { kind: "binary", op: op as BinOp, left, right };
    }
    return left;
  }

  function parseUnary(): Node {
    const t = peek();
    if (t.t === "op" && (t.v === "-" || t.v === "+")) {
      next();
      return { kind: "unary", op: t.v as "-" | "+", arg: parseUnary() };
    }
    if (t.t === "id" && t.v.toLowerCase() === "not") {
      next();
      return { kind: "unary", op: "not", arg: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary(): Node {
    const t = next();
    if (t.t === "num") return { kind: "num", value: t.v };
    if (t.t === "str") return { kind: "str", value: t.v };
    if (t.t === "op" && t.v === "(") {
      const inner = parseExpr();
      expectOp(")");
      return inner;
    }
    if (t.t === "id") {
      const nxt = peek();
      if (nxt.t === "op" && nxt.v === "(") {
        next();
        const args: Node[] = [];
        if (!(peek().t === "op" && (peek() as { v: string }).v === ")")) {
          for (;;) {
            args.push(parseExpr());
            const sep = peek();
            if (sep.t === "op" && sep.v === ",") { next(); continue; }
            break;
          }
        }
        expectOp(")");
        return { kind: "call", name: t.v.toLowerCase(), args };
      }
      const lower = t.v.toLowerCase();
      if (lower === "true") return { kind: "num", value: 1 };
      if (lower === "false") return { kind: "num", value: 0 };
      return { kind: "ref", path: t.v.split(".").filter(Boolean) };
    }
    throw new FormulaError("Unexpected end of formula");
  }

  const ast = parseExpr();
  if (peek().t !== "eof") throw new FormulaError("Trailing input in formula");
  return ast;
}

/** Every reference and zero-arg-context call in a formula, for dependency tracking. */
export function collectRefs(node: Node, out: Node[] = []): Node[] {
  if (node.kind === "ref" || node.kind === "call") out.push(node);
  if (node.kind === "binary") { collectRefs(node.left, out); collectRefs(node.right, out); }
  if (node.kind === "unary") collectRefs(node.arg, out);
  if (node.kind === "call") node.args.forEach((a) => collectRefs(a, out));
  return out;
}
