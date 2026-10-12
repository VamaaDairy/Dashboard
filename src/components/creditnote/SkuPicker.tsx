"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SkuOption } from "@/lib/creditnote/data";

/**
 * Type to search the SKU list, click one to fill it in. The list is drawn by us
 * (white, dark text) rather than the browser's own, and positioned against the
 * viewport so the card around the form cannot clip it.
 */
export function SkuPicker({ value, onChange, skus }: { value: string; onChange: (v: string) => void; skus: SkuOption[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);

  // the list is fixed to the viewport, so it must not stay behind when the page scrolls
  useEffect(() => {
    if (!box) return;
    const close = () => setBox(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [box]);

  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setBox({ left: r.left, top: r.bottom + 4, width: r.width });
  };
  const q = value.trim().toLowerCase();
  const shown = (q ? skus.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) : skus).slice(0, 60);

  return (
    <>
      <Input
        ref={ref}
        value={value}
        autoComplete="off"
        placeholder="Search or pick from the SKU list"
        onFocus={open}
        onChange={(e) => { onChange(e.target.value); open(); }}
        onBlur={() => setBox(null)}
        onKeyDown={(e) => { if (e.key === "Escape") setBox(null); }}
      />
      {box && shown.length > 0 ? (
        <ul
          role="listbox"
          style={{ position: "fixed", left: box.left, top: box.top, width: box.width }}
          className="z-50 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-sm text-neutral-900 shadow-lg"
        >
          {shown.map((s) => (
            <li
              key={s.code}
              role="option"
              aria-selected={s.name === value}
              // mouse-down, not click: the input's blur would close the list before a click lands
              onMouseDown={(e) => { e.preventDefault(); onChange(s.name); setBox(null); }}
              className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 hover:bg-neutral-100"
            >
              <span>{s.name}</span>
              <span className="shrink-0 text-[11px] text-neutral-500">{s.pcs_per_case > 1 ? `${s.case_unit} of ${s.pcs_per_case}` : s.case_unit}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
