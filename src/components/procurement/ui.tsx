export function Section({
  title, description, actions, children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-[12px] text-tertiary-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Th({
  children, align = "right", className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`h-10 px-3 font-mono text-[10px] font-medium uppercase tracking-wide text-tertiary-foreground ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-secondary">{children}</tr>
    </thead>
  );
}

export function Empty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-[13px] text-tertiary-foreground">
        {children}
      </td>
    </tr>
  );
}
