import "server-only";

/**
 * Thin client for the Vamaa Dairy mobile-app API (proamcu.mobiledairy.co.in).
 * Every export endpoint needs two things at once: the fixed `api_key` query
 * param, and an `Authorization: Token <jwt>` header from a logged-in user -
 * the api_key alone gets a 401. The login token barely expires (~5 years), so
 * it is cached in a module-level global and only refreshed on a 401.
 */

export interface VamaaCollection {
  date: string;
  farmer_code: string;
  farmer_unique_code: number;
  center_code: string;
  center_unique_code: string;
  shift: "M" | "E";
  type: string;
  sample: number;
  sample_status: number;
  quantity: number;
  fat: number;
  snf: number;
  clr: number;
  temp: number;
  water: number;
  protein: number;
  qty_time: string;
  qty_mode: number;
  qlty_time: string;
  qlty_mode: number;
  status: number;
  rate: number;
  amount: number;
  bottle_no: number;
  reject_reasons: unknown[];
  no_of_cans: number;
  no_of_bad_cans: number;
  bad_quantity: number;
  created: string;
  updated: string;
}

export interface VamaaFarmer {
  center_unique_code: string;
  center_code: string;
  unique_code: number;
  code: string;
  first_name: string;
  last_name: string;
  name_en: string;
  mobile: string;
  gender: string | null;
  milk_type: string;
  bank_name: string;
  bank_branch: string;
  bank_account: string;
  bank_ifsc: string;
  status: number;
  created: string;
  name_in_bank: string;
  cb_passbook_photo: string;
  potential_volume: string;
  aadhar_number: string;
  cb_aadhaar_photo: string;
  cb_aadhaar_photo_back: string;
}

function config() {
  const baseUrl = process.env.VAMAA_API_BASE_URL;
  const apiKey = process.env.VAMAA_API_KEY;
  const orgId = process.env.VAMAA_ORG_ID;
  const username = process.env.VAMAA_USERNAME;
  const password = process.env.VAMAA_PASSWORD;
  if (!baseUrl || !apiKey || !orgId || !username || !password) {
    throw new Error(
      "Vamaa API is not configured - set VAMAA_API_BASE_URL, VAMAA_API_KEY, VAMAA_ORG_ID, " +
        "VAMAA_USERNAME and VAMAA_PASSWORD in .env",
    );
  }
  return { baseUrl, apiKey, orgId, username, password };
}

const globalForVamaa = globalThis as unknown as { vamaaToken?: string };

async function login(): Promise<string> {
  const { baseUrl, username, password } = config();
  const res = await fetch(`${baseUrl}/api/auth_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Vamaa login failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { token: string };
  globalForVamaa.vamaaToken = data.token;
  return data.token;
}

async function authedGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { baseUrl, apiKey, orgId } = config();
  const token = globalForVamaa.vamaaToken ?? (await login());

  const call = async (tok: string) => {
    const qs = new URLSearchParams({ api_key: apiKey, org_id: orgId, ...params });
    return fetch(`${baseUrl}${path}?${qs.toString()}`, {
      headers: { Authorization: `Token ${tok}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
  };

  let res = await call(token);
  if (res.status === 401) {
    // Token expired or was never valid for this process - log in fresh, once.
    res = await call(await login());
  }
  if (!res.ok) {
    throw new Error(`Vamaa API ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** All collection records for one centre on one calendar day, unfiltered. */
export function fetchCollections(shortName: string, date: string): Promise<VamaaCollection[]> {
  return authedGet<VamaaCollection[]>("/api/v1/export_collection", { short_name: shortName, date });
}

/** Every farmer registered at one centre. */
export function fetchFarmers(shortName: string): Promise<VamaaFarmer[]> {
  return authedGet<VamaaFarmer[]>("/api/v1/export_farmer", { short_name: shortName });
}
