"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return <Button variant="primary" size="sm" onClick={() => window.print()}><Printer /> Print</Button>;
}
