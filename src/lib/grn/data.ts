import "server-only";
import { query } from "@/lib/db";

export interface Grn {
  id: number;
  invoice_no: string;
  /** Cloudinary link, or null for an older image kept in the database. */
  image_url: string | null;
  created_by: string | null;
  created_at: string;
}

/** Newest first; `q` matches any part of the invoice number. */
export async function listGrns(q: string): Promise<Grn[]> {
  return query<Grn>(
    `select id, invoice_no, image_url, created_by, to_char(created_at at time zone 'Asia/Kolkata', 'DD-MM-YYYY HH24:MI') as created_at
       from grn
      where $1 = '' or invoice_no ilike '%' || $1 || '%'
      order by id desc
      limit 200`,
    [q],
  );
}

export async function grnImage(id: number): Promise<{ bytes: Buffer; mime: string } | null> {
  const rows = await query<{ image: Buffer; image_mime: string }>(`select image, image_mime from grn where id = $1`, [id]);
  return rows[0] ? { bytes: rows[0].image, mime: rows[0].image_mime } : null;
}
