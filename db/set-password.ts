/**
 * Resets one user's password. Dev helper for when the seeded hash no longer
 * matches the password you expect - it touches app_user and nothing else, so
 * the cost model is left alone (unlike db:seed, which truncates).
 *
 *   npx tsx db/set-password.ts <email> <new password>
 */
import "dotenv/config";
import { pool, query } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("usage: tsx db/set-password.ts <email> <new password>");
    process.exit(1);
  }

  const rows = await query<{ email: string }>(
    `update app_user set password_hash = $2 where lower(email) = lower($1) returning email`,
    [email, await bcrypt.hash(password, 10)],
  );

  console.log(rows.length ? `password set for ${rows[0].email}` : `no user with email ${email}`);
  await pool.end();
  process.exit(rows.length ? 0 : 1);
}

main();
