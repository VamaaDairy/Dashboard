import "server-only";
import { DEBTORS_ROOT, getTree } from "./tally";

export interface TreeNode {
  name: string;
  kind: "group" | "ledger";
  /** debit-positive: how Tally prints it on the Balance Sheet; negative = credit balance */
  balance: number;
  hasChildren: boolean;
  email: string;
  phone: string;
}

export interface TreeLevel {
  company: string;
  fetchedAt: number;
  /** ancestors below the root down to the current group */
  breadcrumb: string[];
  current: { name: string; balance: number };
  children: TreeNode[];
  /** sum of the rows shown, to cross-check against `current` */
  childrenTotal: number;
  totals: { groups: number; parties: number };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One level of the Sundry Debtors tree. No group = the root itself. */
export async function loadLevel(groupName: string | undefined, force = false): Promise<TreeLevel> {
  const tree = await getTree(force);
  const byName = new Map(tree.groups.map((g) => [g.name, g]));
  const name = groupName && byName.has(groupName) ? groupName : DEBTORS_ROOT;
  const current = byName.get(name);

  const parents = new Set<string>([...tree.groups.map((g) => g.parent), ...tree.ledgers.map((l) => l.parent)]);
  const groupNodes: TreeNode[] = tree.groups
    .filter((g) => g.parent === name)
    .map((g) => ({ name: g.name, kind: "group", balance: r2(g.balance), hasChildren: parents.has(g.name), email: "", phone: "" }));
  const ledgerNodes: TreeNode[] = tree.ledgers
    .filter((l) => l.parent === name)
    .map((l) => ({ name: l.name, kind: "ledger", balance: r2(l.balance), hasChildren: false, email: l.email, phone: l.phone }));
  const children = [...groupNodes.sort((a, b) => a.name.localeCompare(b.name)), ...ledgerNodes.sort((a, b) => a.name.localeCompare(b.name))];

  // chain from this group up to (but not including) the root; guarded against a looping parent chain
  const breadcrumb: string[] = [];
  for (let cursor = current, hops = 0; cursor && cursor.name !== DEBTORS_ROOT && hops < 32; hops++) {
    breadcrumb.unshift(cursor.name);
    cursor = byName.get(cursor.parent);
  }

  return {
    company: tree.company,
    fetchedAt: tree.fetchedAt,
    breadcrumb,
    current: { name, balance: r2(current?.balance ?? 0) },
    children,
    childrenTotal: r2(children.reduce((s, c) => s + c.balance, 0)),
    totals: { groups: tree.groups.length, parties: tree.ledgers.length },
  };
}
