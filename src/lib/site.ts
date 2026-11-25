/** The portal's public address and how it is named in search results. */
export const SITE_URL = "https://production.vamadairy.in";
export const SITE_NAME = "Gaia Dairy";
export const COMPANY = "Vamaa Dairy Private Limited";

/** The only pages search engines may list: the rest of the portal is behind sign-in or not meant to be found. */
export const SEARCH_PAGES = ["/login", "/login/forgot", "/privacy-policy", "/delete-account"] as const;
