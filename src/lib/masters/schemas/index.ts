import type { MasterDef } from "../types";
import { categories } from "./categories";
import { channels } from "./channels";
import { cities } from "./cities";
import { customerRoutes } from "./customerRoutes";
import { customerTypes } from "./customerTypes";
import { designations } from "./designations";
import { divisions } from "./divisions";
import { states } from "./states";
import { taxCodes } from "./taxCodes";
import { GENERATED } from "./gen";
import { customers } from "./customers";
import { routes } from "./routes";
import { employees } from "./employees";
import { employeeCoverage } from "./employeeCoverage";
import { channelRates } from "./channelRates";
import { slabs } from "./slabs";
import { orderBookingReport } from "./orderBookingReport";
import { primarySalesReport, secondarySalesReport } from "./salesReports";
import { primarySalesView, salesReturnView, secondarySalesView } from "./transactionViews";
import { marketVisits } from "./marketVisits";
import { products } from "./products";

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
  categories,
  taxCodes,
  states,
  cities,
  divisions,
  orderBookingReport,
  secondarySalesReport,
  primarySalesReport,
  secondarySalesView,
  primarySalesView,
  salesReturnView,
  marketVisits,
  ...GENERATED,
];

export const MASTERS: Record<string, MasterDef> = Object.fromEntries(MASTER_LIST.map((d) => [d.slug, d]));
