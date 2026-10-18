import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { MasterForm } from "@/components/masters/MasterForm";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { formOptions, loadRecord } from "@/lib/masters/entity/service";
import { MASTERS } from "@/lib/masters/schemas";

/** Add (id null) or edit page of an editable master. People without edit access are sent back to the list. */
export async function EntityFormPage({ slug, id }: { slug: string; id: string | null }) {
  const def = MASTERS[slug];
  if (!def?.entity) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, `fp.${slug}`), "edit")) redirect(`/orders/${slug}`);

  const values = id === null ? {} : await loadRecord(def, id);
  if (!values) notFound();
  const options = await formOptions(def);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-4xl space-y-4">
        <PageHeader icon={def.icon} title={`${id === null ? "Add" : "Edit"} ${def.entity.noun}`} subtitle={def.title} />
        <MasterForm
          slug={slug}
          id={id}
          fields={def.entity.fields}
          refs={options.refs}
          suggestions={options.suggestions}
          values={values}
        />
      </div>
    </div>
  );
}
