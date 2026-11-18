import { PricingNav } from "@/components/pricing/PricingNav";

/** Every Pricing tab: the title, the tabs, then the tab itself. */
export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background px-4 pt-6 pb-6 md:px-8">
      <div className="w-full">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Prices</h1>
        <p className="mt-1 text-[13px] text-foreground/75">MRP, trade prices and party price lists for every SKU.</p>
        <div className="mt-5"><PricingNav /></div>
        {children}
      </div>
    </div>
  );
}
