import type { MasterDef } from "../types";
import { customers } from "./customers";
import { customerTypes } from "./customerTypes";
import { customerRoutes } from "./customerRoutes";
import { routes } from "./routes";
import { employees } from "./employees";
import { employeeCoverage } from "./employeeCoverage";
import { designations } from "./designations";
import { channels } from "./channels";
import { channelRates } from "./channelRates";
import { slabs } from "./slabs";
import { orderBookingReport } from "./orderBookingReport";
import { primarySalesReport, secondarySalesReport } from "./salesReports";
import { primarySalesView, salesReturnView, secondarySalesView } from "./transactionViews";
import { products } from "./products";
import { categories } from "./categories";
import { taxCodes } from "./taxCodes";
import { states } from "./states";
import { cities } from "./cities";
import { divisions } from "./divisions";

export const MASTER_LIST: MasterDef[] = [
  customers,
  customerTypes,
  customerRoutes,
  routes,
  employees,
  employeeCoverage,
  designations,
  channels,
  channelRates,
  slabs,
  products,
  orderBookingReport,
  secondarySalesReport,
  primarySalesReport,
  secondarySalesView,
  primarySalesView,
  salesReturnView,
  categories,
  taxCodes,
  states,
  cities,
  divisions,
];

export const MASTERS: Record<string, MasterDef> = Object.fromEntries(MASTER_LIST.map((d) => [d.slug, d]));
