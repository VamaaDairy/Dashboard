/**
 * Screens that are a set of master lists behind tabs (the portal's "Organization Settings" is one screen
 * with ~20 lists). Each tab is one entity edited with the generic grid.
 */
export interface TabDef { key: string; label: string; entity: string }

export const TABBED: Record<string, TabDef[]> = {
  masters: [
    { key: "designation", label: "Designations", entity: "designation" },
    { key: "channel", label: "Channels", entity: "channel" },
    { key: "expenseType", label: "Expense types", entity: "expenseType" },
    { key: "approvals", label: "Expense approval workflows", entity: "approvals" },
    { key: "leaveType", label: "Leave types", entity: "leaveType" },
    { key: "ticketType", label: "Ticket types", entity: "ticketType" },
    { key: "category", label: "Categories", entity: "category" },
    { key: "subCategory", label: "Sub categories", entity: "subCategory" },
    { key: "chain", label: "Chains", entity: "chain" },
    { key: "division", label: "Divisions", entity: "division" },
    { key: "cluster", label: "Clusters", entity: "cluster" },
    { key: "outletType", label: "Outlet types", entity: "outletType" },
    { key: "branchType", label: "Branch types", entity: "branchType" },
    { key: "bank", label: "Banks", entity: "bank" },
    { key: "city", label: "Cities", entity: "city" },
    { key: "team", label: "Branches / teams", entity: "team" },
    { key: "state", label: "States", entity: "state" },
    { key: "country", label: "Countries", entity: "country" },
    { key: "unit", label: "Units", entity: "unit" },
    { key: "taxConfiguration", label: "Tax codes", entity: "taxConfiguration" },
    { key: "pincodeRtoMapping", label: "Pincode RTO mapping", entity: "pincodeRtoMapping" },
    { key: "configuration", label: "Settings", entity: "configuration" },
  ],
  calendar: [
    { key: "calendar", label: "Holidays & events", entity: "calendar" },
    { key: "eventtype", label: "Event types", entity: "eventtype" },
  ],
  lms: [
    { key: "quiz", label: "Quizzes", entity: "quiz" },
    { key: "quizQuestion", label: "Questions", entity: "quizQuestion" },
    { key: "quizUserQuiz", label: "Attempts", entity: "quizUserQuiz" },
  ],
  reportType: [
    { key: "reportSchedule", label: "Schedules", entity: "reportSchedule" },
    { key: "reportType", label: "Report types", entity: "reportType" },
  ],
  ticketType: [
    { key: "ticketType", label: "Ticket types", entity: "ticketType" },
    { key: "ticketTask", label: "Ticket tasks", entity: "ticketTask" },
  ],
  fpchannelrates: [
    { key: "channelRate", label: "Channel margins", entity: "ChannelRate" },
    { key: "stateChannelMargin", label: "State channel margins", entity: "stateChannelMargin" },
  ],
  schemes: [
    { key: "scheme", label: "Product schemes", entity: "scheme" },
    { key: "schemeInput", label: "Scheme rules", entity: "schemeInput" },
  ],
  schemesQPS: [
    { key: "schemeQPS", label: "QPS schemes", entity: "schemeQPS" },
    { key: "schemeQPSInput", label: "Slabs", entity: "schemeQPSInput" },
  ],
  priceSlabs: [
    { key: "slab", label: "Slabs", entity: "slab" },
    { key: "slabRate", label: "Slab rates", entity: "slabRate" },
    { key: "slabFirmMapping", label: "Customers on slab", entity: "slabFirmMapping" },
  ],
  vanMaster: [
    { key: "vanMaster", label: "Vans", entity: "vanMaster" },
    { key: "staffVanMapping", label: "Employee-van mapping", entity: "staffVanMapping" },
  ],
  hiringDeployment: [
    { key: "staff", label: "Employees", entity: "staff" },
  ],
};

export const tabEntities = (routeKey: string): string[] => (TABBED[routeKey] ?? []).map((t) => t.entity);
