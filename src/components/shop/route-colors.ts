/** Colours shared by the route maps (server pages and the client map), kept out of the "use client" file. */
export const NAVY = "#2B3990";
export const GREEN = "#1E8E3E";
export const AMBER = "#D97706";
export const GREY = "#6B7280";

export interface MapMarker { lng: number; lat: number; label: string; color: string; popup?: string }

/**
 * One colour per trip when several share a map (Dispatch Live). Green and amber are left out: they mean delivered and
 * not delivered / off the planned road. They repeat after eight.
 */
export const TRIP_COLOURS = ["#2B3990", "#7C3AED", "#0E7490", "#BE185D", "#1D4ED8", "#9A3412", "#6B21A8", "#B91C1C"];

/** One colour per route when all routes share a map (Dispatch: Routes, the Plan map). They repeat after twelve. */
export const ROUTE_COLOURS = ["#2B3990", "#1E8E3E", "#D97706", "#B91C1C", "#7C3AED", "#0E7490", "#BE185D", "#4D7C0F", "#9A3412", "#1D4ED8", "#047857", "#6B21A8"];
