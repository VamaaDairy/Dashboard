import { GraduationCap } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Quiz Module (Recibo route `lms`).
 *
 * Spec columns: 15; built: 12.
 * Left out (buttons, or no matching data column):
 *   - Designations (designations)
 *   - Question Type (questionType)
 *   - Multiple Answer (multipleAnswer)
 */
export const lms: MasterDef = {
  slug: "lms",
  title: "Quiz Module",
  subtitle: "Quizzes set for employees, with their schedule and scoring.",
  icon: GraduationCap,
  from: `fp_quiz m`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.created_at desc)", kind: "num" },
    { key: "description", label: "Description", expr: "m.description" },
    { key: "noOfQuestions", label: "No of Questions", expr: "m.no_of_questions", kind: "num" },
    { key: "durationInMin", label: "Duration in Min", expr: "m.duration_in_min", kind: "num" },
    { key: "totalScore", label: "Total Score", expr: "m.total_score", kind: "num" },
    { key: "frequency", label: "Frequency", expr: "m.total_score", kind: "num" },
    { key: "priority", label: "Priority", expr: "m.frequency" },
    { key: "startDate", label: "Start Date", expr: "m.priority", kind: "num" },
    { key: "endDate", label: "End Date", expr: "m.end_date", kind: "date" },
    { key: "active", label: "Active", expr: "m.is_active", kind: "num" },
    { key: "division", label: "Division", expr: "nullif(m.division::text, 'null')" },
    { key: "position", label: "Position", expr: "m.description" },
  ],
  search: ["m.description"],
  filters: [
    { key: "active", label: "Active", expr: "m.is_active" },
  ],
  order: "m.created_at desc",
};
