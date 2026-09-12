import * as React from "react"
import type { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

/**
 * Shared page header used across all top-level pages (Products, Sales,
 * Sales Return, Production, Demand, Dashboard, ...).
 * Matches the Gaia logo palette: solid blue card, white title, green subtitle.
 */
export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#4A6FA5] to-[#3E5FA0] p-5 pl-6 shadow-md">
      <div className="flex items-center gap-4">
        {/* Icon chip */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
          <Icon className="h-6 w-6 text-white" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#8FE3A0] mt-1 font-semibold">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="self-start lg:self-auto [&_input]:bg-white/95 [&_select]:bg-white/95 [&_button]:bg-white [&_button]:text-[#3E5FA0]">
          {actions}
        </div>
      )}
    </div>
  )
}
