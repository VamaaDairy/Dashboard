// Finds the Orders pages that are still empty placeholders (only a title, nothing else)
// and writes their slugs (plus every Orders page slug) to src/lib/nav-unbuilt.json. The sidebar keeps those out of the
// working sections and lists them under "Not in use". Run again after building a page:
//   node scripts/nav-audit.mjs
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/app/orders");
const all = readdirSync(dir).filter((d) => /^[\w-]+$/.test(d) && existsSync(join(dir, d, "page.tsx"))).sort();
const stubs = all
  .filter((d) => /^export default function Page\(\) \{\s*return <h1 className="p-6[^>]*>\{"[^"]*"\}<\/h1>;\s*\}\s*$/.test(readFileSync(join(dir, d, "page.tsx"), "utf8")))
  .sort();
writeFileSync(join(root, "src/lib/nav-unbuilt.json"), JSON.stringify({ stubs, all }, null, 1) + "\n");
console.log(`${stubs.length} placeholder pages written to src/lib/nav-unbuilt.json`);
