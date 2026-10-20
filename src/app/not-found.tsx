import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <p className="text-6xl font-semibold tracking-tight text-muted-foreground/40">404</p>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you are looking for does not exist, or it has moved.
          </p>
        </div>
        <Link href="/" className="inline-flex"><Button variant="primary">Back to dashboard</Button></Link>
      </div>
    </div>
  );
}
