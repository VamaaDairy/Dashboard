/** Report file name prefix -> what it holds. */
export const REPORT_FILES = {
  CITY_MASTER: "cities",
  PRODUCT_MASTER: "products",
  CUSTOMER_MASTER: "customers",
  EMPLOYEE_MASTER: "employees",
  CUSTOMER_WISE_ROUTE_MAPPING: "routes",
  CHANNEL_PRICE_REPORT: "rates",
  SLAB_RATE_MASTER_REPORT: "slabs",
} as const;

export const EMPLOYEE_SHEETS = { active: "Employee Master", gone: "Deactivated Employees" } as const;

/** Rows per statement when writing. */
export const CHUNK = 1000;
/** The exports are in IST. */
export const SOURCE_UTC_OFFSET = "+05:30";
/** GST came into force; used when a tax code has no product date to take. */
export const DEFAULT_TAX_START = "2017-07-01";
export const COUNTRY_CODE = 91;

export const COMPANY_CHANNEL = "CMP";
export const COMPANY_FIRM_CODE = "VAM";
/** The portal's own login; owns images and slabs when the export doesn't say who made them. */
export const ADMIN_EMAIL = "admin@vamaadairy.com";
export const ADMIN_DESIGNATION = "MIS ADMIN";

/** state -> [short code, GST code, region]. Spellings follow the exports (WESTBENGAL, TAMILNADU ...). */
export const STATES: Record<string, [string, string, string]> = {
  "ANDAMAN AND NICOBAR ISLANDS": ["AN", "35", "SOUTH"], "ANDHRA PRADESH": ["AP", "37", "SOUTH"],
  "ARUNACHAL PRADESH": ["AR", "12", "EAST"], ASSAM: ["AS", "18", "EAST"], BIHAR: ["BR", "10", "EAST"],
  CHANDIGARH: ["CH", "04", "NORTH"], CHHATTISGARH: ["CG", "22", "EAST"], "DADRA AND NAGAR HAVELI": ["DN", "26", "WEST"],
  "DAMAN AND DIU": ["DD", "25", "WEST"], DELHI: ["DL", "07", "NORTH"], GOA: ["GA", "30", "WEST"], GUJARAT: ["GJ", "24", "WEST"],
  HARYANA: ["HR", "06", "NORTH"], "HIMACHAL PRADESH": ["HP", "02", "NORTH"], "JAMMU AND KASHMIR": ["JK", "01", "NORTH"],
  JHARKHAND: ["JH", "20", "EAST"], KARNATAKA: ["KA", "29", "SOUTH"], KERALA: ["KL", "32", "SOUTH"], LAKSHADWEEP: ["LD", "31", "SOUTH"],
  "MADHYA PRADESH": ["MP", "23", "WEST"], MAHARASHTRA: ["MH", "27", "WEST"], MANIPUR: ["MN", "14", "EAST"], MEGHALAYA: ["ML", "17", "EAST"],
  MIZORAM: ["MZ", "15", "EAST"], NAGALAND: ["NL", "13", "EAST"], ODISHA: ["OD", "21", "EAST"], PUDUCHERRY: ["PY", "34", "SOUTH"],
  PUNJAB: ["PB", "03", "NORTH"], RAJASTHAN: ["RJ", "08", "NORTH"], SIKKIM: ["SK", "11", "EAST"], TAMILNADU: ["TN", "33", "SOUTH"],
  TELANGANA: ["TS", "36", "SOUTH"], TRIPURA: ["TR", "16", "EAST"], "UTTAR PRADESH": ["UP", "09", "NORTH"], UTTARAKHAND: ["UK", "05", "NORTH"],
  WESTBENGAL: ["WB", "19", "EAST"], OTHERS: ["OT", "00", "EAST"],
};

/** Channel code -> [name, level, parent code]. DISTRIBUTOR / RETAIL are the names the price report uses; the rest are as exported. */
export const CHANNELS: Record<string, [string, number, string | null]> = {
  CMP: ["COMPANY", 1, null], SS: ["SUPER STOCKIST", 2, "CMP"], DB: ["DISTRIBUTOR", 3, "SS"],
  RT: ["RETAIL", 4, "DB"], MFS: ["MFS", 4, "DB"], PT: ["PT", 4, "DB"], IT: ["INSTITUTION", 4, "DB"],
};
