import * as React from "react"
import type { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

/**
 * Matches Supabase Studio's own PageHeader/Scaffold: a bare icon (no chip,
 * no ring - just tertiary-toned like their `text-foreground-light` icon
 * slot), an h1, and a muted description line. No card, no border - spacing
 * alone separates it from the content below, same as their ScaffoldHeader
 * (`flex-col gap-3 py-6`, nothing else).
 * https://github.com/supabase/supabase/blob/master/apps/studio/components/layouts/Scaffold.tsx
 */
export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-tertiary-foreground" strokeWidth={1.5} />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-tertiary-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
