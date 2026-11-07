/** Colours shared by the route maps (server pages and the client map), kept out of the "use client" file. */
export const NAVY = "#2B3990";
export const GREEN = "#1E8E3E";
export const AMBER = "#D97706";
export const GREY = "#6B7280";

export interface MapMarker { lng: number; lat: number; label: string; color: string; popup?: string }
