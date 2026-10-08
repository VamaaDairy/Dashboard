import { ChatsView } from "@/components/whatsapp/ChatsView";

export const dynamic = "force-dynamic";

/** Every WhatsApp conversation, live. */
export default async function ChatsPage({ searchParams }: PageProps<"/whatsapp/chats">) {
  const { c } = await searchParams;
  return (
    <div className="px-2 pb-2 md:px-4 md:pb-4">
      <ChatsView initialWaId={typeof c === "string" && /^\d+$/.test(c) ? c : null} />
    </div>
  );
}
