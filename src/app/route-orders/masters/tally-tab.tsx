import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { lastTallyRead, tallyCheck, type NameIssue } from "@/lib/tally/names";
import { readTallyNamesAction } from "../actions";

function Issues({ rows, what }: { rows: NameIssue[]; what: string }) {
  if (!rows.length) return <p className="px-4 py-3 text-sm text-muted-foreground">Every {what} name is in Tally.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
        <tr><th className="px-3 py-2 font-semibold">Name</th><th className="px-3 py-2 font-semibold">Tally name used</th><th className="px-3 py-2 font-semibold">Closest in Tally</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2 text-destructive">{r.tallyName}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.hint ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Tally's names, read from Tally (read only), and every Tally name the Dashboard uses that Tally does not have. A
 * name Tally doesn't know makes Tally reject that voucher when the file is imported, so these are fixed first.
 */
export async function TallyTab({ canEdit }: { canEdit: boolean }) {
  const [check, last] = await Promise.all([tallyCheck(), lastTallyRead()]);
  const { counts } = check;
  return (
    <div className="space-y-5">
      <Panel
        title="Names from Tally"
        description="Reads the ledger, stock item and unit names from Tally on the server. It only reads: nothing is written to Tally. Tally has to be running with the company open."
        actions={canEdit ? (
          <form action={readTallyNamesAction}><Button type="submit" size="sm"><Download /> Read from Tally</Button></form>
        ) : null}
      >
        {counts.readAt ? (
          <p className="text-sm">
            Last read {counts.readAt}{last?.read_by ? ` by ${last.read_by}` : ""}: {counts.ledgers} ledgers ({counts.debtors} customers), {counts.items} stock items, {counts.units} units.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Not read from Tally yet. The Customer Master and Product Master suggest Tally&apos;s names once they are read.</p>
        )}
        {last?.filled.length ? (
          <div className="mt-3">
            <p className="text-sm font-medium">The last read filled or corrected {last.filled.length} Tally names:</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {last.filled.map((f, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{f.what === "customer" ? "Customer" : "Product"}</span> {f.name}: {f.from ? <><s className="text-muted-foreground">{f.from}</s> → </> : null}{f.to} <span className="text-muted-foreground">({f.why})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      {counts.ledgers ? (
        <>
          <Panel title={<>Customers: Tally name not in Tally <Pill tone={check.customers.length ? "danger" : "success"}>{check.customers.length}</Pill></>}
            description="Fix the Tally name in the Customer Master (or on the Customers tab here), using Tally's exact spelling." flush>
            <Issues rows={check.customers} what="customer" />
          </Panel>
          <Panel title={<>Products: Tally name not in Tally <Pill tone={check.products.length ? "danger" : "success"}>{check.products.length}</Pill></>}
            description="Fix the Tally name in the Product Master (or on the Products tab here)." flush>
            <Issues rows={check.products} what="product" />
          </Panel>
          <Panel title={<>Sales ledgers, units, tax ledgers <Pill tone={check.others.length ? "danger" : "success"}>{check.others.length}</Pill></>}
            description="The other Tally names the sales file uses: each product's sales ledger and unit, the GST and round-off ledgers." flush>
            <Issues rows={check.others} what="ledger and unit" />
          </Panel>
          <Panel title={<>Customers ordering with no Tally name <Pill tone={check.noName.length ? "warning" : "success"}>{check.noName.length}</Pill></>}
            description="Ordered in the last 90 days (retailers aside, they are billed through their distributor). Give each its Tally ledger in the Customer Master." flush>
            {check.noName.length ? (
              <ul className="divide-y divide-border text-sm">
                {check.noName.map((f, i) => (
                  <li key={i} className="flex justify-between gap-3 px-4 py-2"><span>{f.name}</span><span className="text-muted-foreground">{f.channel ?? "-"} · {f.code ?? "-"}</span></li>
                ))}
              </ul>
            ) : <p className="px-4 py-3 text-sm text-muted-foreground">Every ordering customer has a Tally name.</p>}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
