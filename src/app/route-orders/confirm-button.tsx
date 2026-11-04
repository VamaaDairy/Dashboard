"use client";

import { Button } from "@/components/ui/button";

/** A submit button that asks first. */
export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="outline" size="sm" onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </Button>
  );
}
