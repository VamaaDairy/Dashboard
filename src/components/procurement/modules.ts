import { HandCoins, LayoutGrid, Truck, Wallet } from "lucide-react";

/**
 * The three cost blocks that make up the landed price of milk, plus the page
 * that adds them up. Plain module rather than part of ModuleNav so the server
 * pages can read the list too - only components survive a client boundary.
 */
export const PROCUREMENT_MODULES = [
  {
    href: "/procurement",
    label: "Overview",
    icon: LayoutGrid,
    blurb: "The three cost blocks and the landed rate they add up to",
  },
  {
    href: "/procurement/farmer",
    label: "Price to farmer",
    icon: Wallet,
    blurb: "Paid on the fat and SNF in the weight taken, not on litres",
  },
  {
    href: "/procurement/transport",
    label: "Tanker to plant",
    icon: Truck,
    blurb: "What the run cost, spread over the milk it carried",
  },
  {
    href: "/procurement/commission",
    label: "Sachiv commission",
    icon: HandCoins,
    blurb: "What each society's secretary earns for collecting",
  },
] as const;
