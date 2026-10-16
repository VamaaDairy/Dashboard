/**
 * What the Orders section manages, as data. One Entity = one table, one list
 * screen and one add/edit form; the generic CRUD (crud.ts) and the generic
 * table (EntityTable) are driven entirely by these definitions. Pure - safe to
 * import from client components.
 */
export type ColType = "text" | "textarea" | "number" | "money" | "date" | "time" | "bool" | "select" | "ref";

export interface Col {
  key: string;
  label: string;
  type: ColType;
  required?: boolean;
  options?: string[];
  /** For type "ref": the entity key whose rows this column points at. */
  ref?: string;
  /** Hide from the list (still in the form). */
  hideInList?: boolean;
  /** Hide from the form (list / export only). */
  hideInForm?: boolean;
  /** Pre-filled value on a new row. */
  initial?: string;
  /** Colour the value as a status chip. */
  chip?: boolean;
  /** Read-only column computed in SQL (alias t is the row); never saved. */
  sql?: string;
}

export interface Entity {
  key: string;
  title: string;
  singular: string;
  table: string;
  cols: Col[];
  /** Columns the search box looks in. */
  search: string[];
  /** SQL order by, columns qualified with t. */
  order: string;
  /** Values forced on every row (and used to filter the list), e.g. { kind: "category" }. */
  fixed?: Record<string, string>;
  /** SQL expression for this entity when another entity points at it; the table alias is r. */
  label: string;
  /** Rows can be added/edited/deleted. Default true. */
  editable?: boolean;
}

const STAT = { chip: true } as const;

export const ENTITIES: Record<string, Entity> = {
  // ---- masters -------------------------------------------------------
  category: master("category", "Product categories", "category"),
  brand: master("brand", "Brands", "brand"),
  channel: master("channel", "Customer channels", "channel"),
  designation: master("designation", "Designations", "designation"),
  expense_type: master("expense_type", "Expense types", "expense type"),

  product: {
    key: "product", title: "Products", singular: "product", table: "ord_product",
    search: ["sku", "name"], order: "t.name", label: "r.name",
    cols: [
      { key: "sku", label: "SKU", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "category_id", label: "Category", type: "ref", ref: "category" },
      { key: "brand_id", label: "Brand", type: "ref", ref: "brand" },
      { key: "uom", label: "UoM", type: "select", options: ["pc", "kg", "ltr", "case"], initial: "pc" },
      { key: "units_per_case", label: "Units / case", type: "number", initial: "1" },
      { key: "mrp", label: "MRP", type: "money" },
      { key: "rate", label: "Trade rate", type: "money" },
      { key: "gst_pct", label: "GST %", type: "number", initial: "5" },
      { key: "hsn", label: "HSN", type: "text", hideInList: true },
      { key: "is_focus", label: "Focus", type: "bool" },
      { key: "is_active", label: "Active", type: "bool", initial: "true" },
    ],
  },

  scheme: {
    key: "scheme", title: "Schemes", singular: "scheme", table: "ord_scheme",
    search: ["name"], order: "t.name", label: "r.name",
    cols: [
      { key: "name", label: "Scheme", type: "text", required: true },
      { key: "product_id", label: "Product", type: "ref", ref: "product", required: true },
      { key: "min_qty", label: "Min qty", type: "number" },
      { key: "free_qty", label: "Free qty", type: "number" },
      { key: "discount_pct", label: "Discount %", type: "number" },
      { key: "valid_from", label: "From", type: "date" },
      { key: "valid_to", label: "To", type: "date" },
      { key: "is_active", label: "Active", type: "bool", initial: "true" },
    ],
  },

  customer: {
    key: "customer", title: "Customers", singular: "customer", table: "ord_customer",
    search: ["code", "name", "city", "phone"], order: "t.name", label: "r.name",
    cols: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "type", label: "Type", type: "select", options: ["distributor", "retailer", "institution"], initial: "retailer" },
      { key: "channel_id", label: "Channel", type: "ref", ref: "channel" },
      { key: "parent_id", label: "Distributor", type: "ref", ref: "distributor" },
      { key: "staff_id", label: "Salesman", type: "ref", ref: "staff" },
      { key: "beat_id", label: "Beat", type: "ref", ref: "beat" },
      { key: "contact", label: "Contact person", type: "text", hideInList: true },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text", hideInList: true },
      { key: "address", label: "Address", type: "textarea", hideInList: true },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text", hideInList: true },
      { key: "gst_no", label: "GSTIN", type: "text", hideInList: true },
      { key: "credit_limit", label: "Credit limit", type: "money", hideInList: true },
      { key: "credit_days", label: "Credit days", type: "number", hideInList: true },
      { key: "status", label: "Status", type: "select", options: ["active", "pending", "inactive"], initial: "active", ...STAT },
    ],
  },
  // customers narrowed to distributors, used as a pick-list only
  distributor: {
    key: "distributor", title: "Distributors", singular: "distributor", table: "ord_customer",
    search: ["code", "name"], order: "t.name", label: "r.name", fixed: { type: "distributor" }, editable: false,
    cols: [],
  },

  // ---- field force ---------------------------------------------------
  staff: {
    key: "staff", title: "Employees", singular: "employee", table: "ord_staff",
    search: ["code", "name", "phone", "region"], order: "t.name", label: "r.name",
    cols: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "designation_id", label: "Designation", type: "ref", ref: "designation" },
      { key: "reporting_to", label: "Reports to", type: "ref", ref: "staff" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text", hideInList: true },
      { key: "region", label: "Region", type: "text" },
      { key: "joined_on", label: "Joined", type: "date", hideInList: true },
      { key: "is_active", label: "Active", type: "bool", initial: "true" },
    ],
  },
  beat: {
    key: "beat", title: "Routes / beats", singular: "beat", table: "ord_beat",
    search: ["name"], order: "t.name", label: "r.name",
    cols: [
      { key: "name", label: "Beat", type: "text", required: true },
      { key: "staff_id", label: "Salesman", type: "ref", ref: "staff" },
      { key: "distributor_id", label: "Distributor", type: "ref", ref: "distributor" },
      { key: "weekday", label: "Day", type: "select", options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
      { key: "is_active", label: "Active", type: "bool", initial: "true" },
    ],
  },
  visit: {
    key: "visit", title: "Market visits", singular: "visit", table: "ord_visit",
    search: [], order: "t.visit_date desc, t.created_at desc", label: "r.visit_date::text",
    cols: [
      { key: "visit_date", label: "Date", type: "date", required: true, initial: "today" },
      { key: "staff_id", label: "Employee", type: "ref", ref: "staff", required: true },
      { key: "customer_id", label: "Customer", type: "ref", ref: "customer" },
      { key: "outcome", label: "Outcome", type: "select", options: ["order", "no_order", "closed", "follow_up"], initial: "no_order", ...STAT },
      { key: "order_value", label: "Order value", type: "money" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  attendance: {
    key: "attendance", title: "Attendance", singular: "attendance entry", table: "ord_attendance",
    search: [], order: "t.day desc", label: "r.day::text",
    cols: [
      { key: "day", label: "Date", type: "date", required: true, initial: "today" },
      { key: "staff_id", label: "Employee", type: "ref", ref: "staff", required: true },
      { key: "status", label: "Status", type: "select", options: ["present", "absent", "leave", "half"], initial: "present", ...STAT },
      { key: "check_in", label: "In", type: "time" },
      { key: "check_out", label: "Out", type: "time" },
    ],
  },
  expense: {
    key: "expense", title: "Expenses", singular: "expense", table: "ord_expense",
    search: ["note"], order: "t.day desc", label: "r.day::text",
    cols: [
      { key: "day", label: "Date", type: "date", required: true, initial: "today" },
      { key: "staff_id", label: "Employee", type: "ref", ref: "staff", required: true },
      { key: "type_id", label: "Type", type: "ref", ref: "expense_type" },
      { key: "amount", label: "Amount", type: "money", required: true },
      { key: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"], initial: "pending", ...STAT },
      { key: "note", label: "Note", type: "text" },
    ],
  },
  task: {
    key: "task", title: "Tasks", singular: "task", table: "ord_task",
    search: ["title", "notes"], order: "t.due_date nulls last, t.title", label: "r.title",
    cols: [
      { key: "title", label: "Task", type: "text", required: true },
      { key: "staff_id", label: "Assigned to", type: "ref", ref: "staff" },
      { key: "due_date", label: "Due", type: "date" },
      { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high"], initial: "medium", ...STAT },
      { key: "status", label: "Status", type: "select", options: ["open", "in_progress", "done"], initial: "open", ...STAT },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
    ],
  },
  kpi_target: {
    key: "kpi_target", title: "KPI targets", singular: "target", table: "ord_kpi_target",
    search: ["period"], order: "t.period desc", label: "r.period",
    cols: [
      { key: "staff_id", label: "Employee", type: "ref", ref: "staff", required: true },
      { key: "period", label: "Month (YYYY-MM)", type: "text", required: true, initial: "thismonth" },
      { key: "metric", label: "Metric", type: "select", options: ["sales", "orders", "visits", "new_outlets"], initial: "sales" },
      { key: "target", label: "Target", type: "number", required: true },
    ],
  },

  // ---- collections ---------------------------------------------------
  invoice: {
    key: "invoice", title: "Invoices", singular: "invoice", table: "ord_invoice", editable: false,
    search: ["invoice_no"], order: "t.invoice_date desc, t.invoice_no desc", label: "r.invoice_no",
    cols: [
      { key: "invoice_no", label: "Invoice", type: "text" },
      { key: "customer_id", label: "Customer", type: "ref", ref: "customer" },
      { key: "invoice_date", label: "Date", type: "date" },
      { key: "due_date", label: "Due", type: "date" },
      { key: "amount", label: "Amount", type: "money" },
      { key: "paid", label: "Paid", type: "money", sql: "coalesce((select sum(p.amount) from ord_payment p where p.invoice_id = t.id and p.status = 'cleared'),0) + coalesce((select sum(n.amount) from ord_credit_note n where n.invoice_id = t.id and n.status = 'approved'),0)" },
      { key: "outstanding", label: "Outstanding", type: "money", sql: "t.amount - coalesce((select sum(p.amount) from ord_payment p where p.invoice_id = t.id and p.status = 'cleared'),0) - coalesce((select sum(n.amount) from ord_credit_note n where n.invoice_id = t.id and n.status = 'approved'),0)" },
      { key: "overdue_days", label: "Overdue days", type: "number", sql: "greatest(0, current_date - t.due_date)" },
    ],
  },
  payment: {
    key: "payment", title: "Payments", singular: "payment", table: "ord_payment",
    search: ["reference"], order: "t.pay_date desc, t.created_at desc", label: "r.reference",
    cols: [
      { key: "pay_date", label: "Date", type: "date", required: true, initial: "today" },
      { key: "customer_id", label: "Customer", type: "ref", ref: "customer", required: true },
      { key: "invoice_id", label: "Against invoice", type: "ref", ref: "invoice" },
      { key: "amount", label: "Amount", type: "money", required: true },
      { key: "mode", label: "Mode", type: "select", options: ["cash", "upi", "cheque", "neft"], initial: "cash" },
      { key: "reference", label: "Reference", type: "text" },
      { key: "collected_by", label: "Collected by", type: "ref", ref: "staff" },
      { key: "status", label: "Status", type: "select", options: ["pending", "cleared", "bounced"], initial: "pending", ...STAT },
    ],
  },
  credit_note: {
    key: "credit_note", title: "Credit notes", singular: "credit note", table: "ord_credit_note",
    search: ["cn_no", "reason"], order: "t.cn_date desc", label: "r.cn_no",
    cols: [
      { key: "cn_no", label: "CN no", type: "text", hideInForm: true },
      { key: "cn_date", label: "Date", type: "date", required: true, initial: "today" },
      { key: "customer_id", label: "Customer", type: "ref", ref: "customer", required: true },
      { key: "invoice_id", label: "Against invoice", type: "ref", ref: "invoice" },
      { key: "amount", label: "Amount", type: "money", required: true },
      { key: "reason", label: "Reason", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"], initial: "pending", ...STAT },
    ],
  },

  // ---- logistics -----------------------------------------------------
  delivery: {
    key: "delivery", title: "Deliveries", singular: "delivery", table: "ord_delivery",
    search: ["vehicle", "driver"], order: "t.delivery_date desc", label: "r.vehicle",
    cols: [
      { key: "delivery_date", label: "Date", type: "date", required: true, initial: "today" },
      { key: "order_id", label: "Order", type: "ref", ref: "order", required: true },
      { key: "vehicle", label: "Vehicle", type: "text" },
      { key: "driver", label: "Driver", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["planned", "out_for_delivery", "delivered", "failed"], initial: "planned", ...STAT },
      { key: "note", label: "Note", type: "text" },
    ],
  },
  return: {
    key: "return", title: "Sales returns", singular: "return", table: "ord_return",
    search: ["return_no"], order: "t.return_date desc", label: "r.return_no",
    cols: [
      { key: "return_no", label: "Return", type: "text", hideInForm: true },
      { key: "return_date", label: "Date", type: "date", required: true, initial: "today" },
      { key: "customer_id", label: "Customer", type: "ref", ref: "customer", required: true },
      { key: "product_id", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qty", label: "Qty", type: "number", required: true },
      { key: "rate", label: "Rate", type: "money" },
      { key: "reason", label: "Reason", type: "select", options: ["damaged", "expired", "wrong_item", "excess", "other"], initial: "damaged" },
      { key: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"], initial: "pending", ...STAT },
    ],
  },
  van_transfer: {
    key: "van_transfer", title: "Van stock transfers", singular: "transfer", table: "ord_van_transfer",
    search: ["note"], order: "t.transfer_date desc", label: "r.note",
    cols: [
      { key: "transfer_date", label: "Date", type: "date", required: true, initial: "today" },
      { key: "staff_id", label: "Salesman", type: "ref", ref: "staff", required: true },
      { key: "product_id", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qty", label: "Qty", type: "number", required: true },
      { key: "direction", label: "Direction", type: "select", options: ["issue", "return"], initial: "issue" },
      { key: "note", label: "Note", type: "text" },
    ],
  },
  // orders as a pick-list only
  order: {
    key: "order", title: "Orders", singular: "order", table: "ord_order", editable: false,
    search: ["order_no"], order: "t.order_date desc", label: "r.order_no", cols: [],
  },

  // ---- support -------------------------------------------------------
  ticket: {
    key: "ticket", title: "Tickets", singular: "ticket", table: "ord_ticket",
    search: ["ticket_no", "subject", "description"], order: "t.created_at desc", label: "r.ticket_no",
    cols: [
      { key: "ticket_no", label: "Ticket", type: "text", hideInForm: true },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "customer_id", label: "Customer", type: "ref", ref: "customer" },
      { key: "staff_id", label: "Assigned to", type: "ref", ref: "staff" },
      { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high"], initial: "medium", ...STAT },
      { key: "status", label: "Status", type: "select", options: ["open", "in_progress", "resolved", "closed"], initial: "open", ...STAT },
      { key: "description", label: "Description", type: "textarea", hideInList: true },
      { key: "resolution", label: "Resolution", type: "textarea", hideInList: true },
    ],
  },
};

function master(kind: string, title: string, singular: string): Entity {
  return {
    key: kind, title, singular, table: "ord_master", fixed: { kind },
    search: ["name", "code"], order: "t.name", label: "r.name",
    cols: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text" },
      { key: "is_active", label: "Active", type: "bool", initial: "true" },
    ],
  };
}

export function entityOf(key: string): Entity {
  const e = ENTITIES[key];
  if (!e) throw new Error(`Unknown entity: ${key}`);
  return e;
}
