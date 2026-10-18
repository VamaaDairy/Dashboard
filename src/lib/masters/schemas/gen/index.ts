import type { MasterDef } from "../../types";
import { announcement } from "./announcement";
import { attendance } from "./attendance";
import { billsStatus } from "./billsStatus";
import { bookorderstatus } from "./bookorderstatus";
import { catalogue } from "./catalogue";
import { cityCategory } from "./cityCategory";
import { collections } from "./collections";
import { communicationCredit } from "./communicationCredit";
import { creditNote } from "./creditNote";
import { customerActivity } from "./customerActivity";
import { customerLocation } from "./customerLocation";
import { customerTarget } from "./customerTarget";
import { delivery } from "./delivery";
import { displayAudit } from "./displayAudit";
import { displayPlanogram } from "./displayPlanogram";
import { employeeTarget } from "./employeeTarget";
import { employeefaceregistration } from "./employeefaceregistration";
import { expenses } from "./expenses";
import { firmPromoter } from "./firmPromoter";
import { firmPromoterReport } from "./firmPromoterReport";
import { firmsStatus } from "./firmsStatus";
import { fpcustbookingorders } from "./fpcustbookingorders";
import { fpfocusproduct } from "./fpfocusproduct";
import { fpmybookingorders } from "./fpmybookingorders";
import { fpproductinventory } from "./fpproductinventory";
import { greenCallTargets } from "./greenCallTargets";
import { intgBookingOrderStatus } from "./intgBookingOrderStatus";
import { kpiTargets } from "./kpiTargets";
import { leave } from "./leave";
import { lms } from "./lms";
import { loadSheet } from "./loadSheet";
import { locationLog } from "./locationLog";
import { myCustomer } from "./myCustomer";
import { portalOrder } from "./portalOrder";
import { preSaleSRSync } from "./preSaleSRSync";
import { productInventoryStatus } from "./productInventoryStatus";
import { productsStatus } from "./productsStatus";
import { schemes } from "./schemes";
import { schemesQPS } from "./schemesQPS";
import { serviceManagementView } from "./serviceManagementView";
import { stateChannelMargin } from "./stateChannelMargin";
import { stockTransferStatus } from "./stockTransferStatus";
import { stockTransferView } from "./stockTransferView";
import { stockView } from "./stockView";
import { task } from "./task";
import { ticketType } from "./ticketType";
import { transactionStatus } from "./transactionStatus";
import { vanMaster } from "./vanMaster";
import { vansalestockreq } from "./vansalestockreq";

/** Screens generated from the portal spec (see each file for what was left out). */
export const GENERATED: MasterDef[] = [
  announcement,
  attendance,
  billsStatus,
  bookorderstatus,
  catalogue,
  cityCategory,
  collections,
  communicationCredit,
  creditNote,
  customerActivity,
  customerLocation,
  customerTarget,
  delivery,
  displayAudit,
  displayPlanogram,
  employeeTarget,
  employeefaceregistration,
  expenses,
  firmPromoter,
  firmPromoterReport,
  firmsStatus,
  fpcustbookingorders,
  fpfocusproduct,
  fpmybookingorders,
  fpproductinventory,
  greenCallTargets,
  intgBookingOrderStatus,
  kpiTargets,
  leave,
  lms,
  loadSheet,
  locationLog,
  myCustomer,
  portalOrder,
  preSaleSRSync,
  productInventoryStatus,
  productsStatus,
  schemes,
  schemesQPS,
  serviceManagementView,
  stateChannelMargin,
  stockTransferStatus,
  stockTransferView,
  stockView,
  task,
  ticketType,
  transactionStatus,
  vanMaster,
  vansalestockreq,
];
