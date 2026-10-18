import { MasterPage } from "@/components/masters/MasterPage";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MasterPage slug="billsStatus" searchParams={searchParams} />;
}
