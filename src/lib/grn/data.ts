import "server-only";
import { query } from "@/lib/db";

export interface Grn {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  /** YYYY-MM-DD the delivery / POD belongs to */
  pod_date: string;
  /** Cloudinary link, or null for an older image kept in the database. */
  image_url: string | null;
  created_by: string | null;
  created_at: string;
}

/** Newest date first; `q` matches the invoice number or customer, `date` narrows to one day. */
export async function listGrns(q: string, date = ""): Promise<Grn[]> {
  return query<Grn>(
    `select id, invoice_no, customer_name, to_char(pod_date, 'YYYY-MM-DD') as pod_date, image_url, created_by,
            to_char(created_at at time zone 'Asia/Kolkata', 'DD-MM-YYYY HH24:MI') as created_at
       from grn
      where ($1 = '' or invoice_no ilike '%' || $1 || '%' or customer_name ilike '%' || $1 || '%')
        and ($2 = '' or pod_date = $2::date)
      order by pod_date desc, id desc
      limit 500`,
    [q, date],
  );
}

export async function grnImage(id: number): Promise<{ bytes: Buffer; mime: string } | null> {
  const rows = await query<{ image: Buffer; image_mime: string }>(`select image, image_mime from grn where id = $1`, [id]);
  return rows[0] ? { bytes: rows[0].image, mime: rows[0].image_mime } : null;
}
