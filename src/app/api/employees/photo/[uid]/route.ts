import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/** An employee's photo for the dashboard: the one they set in the Employee app, else the staff record's picture. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  if (!(await userFromToken((await cookies()).get("session")?.value))) return new NextResponse(null, { status: 401 });
  const { uid } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return new NextResponse(null, { status: 404 });
  const r = await one<{ photo: string | null; pic: string | null }>(
    `select (select p.photo from emp_profile p where p.staff_uid = s.uid) as photo, nullif(trim(s.profile_pic), '') as pic from fp_staff s where s.uid = $1`,
    [uid],
  );
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(r?.photo ?? "");
  if (m) {
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: { "content-type": m[1], "cache-control": "private, max-age=300" },
    });
  }
  if (r?.pic && /^https?:\/\//i.test(r.pic)) return NextResponse.redirect(r.pic);
  return new NextResponse(null, { status: 404 });
}
