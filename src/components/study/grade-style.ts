import type { Grade } from "@/lib/srs";

export const gradeStyle: Record<Grade, string> = {
  0: "text-danger hover:bg-danger/10",
  1: "text-warning hover:bg-warning/10",
  2: "text-success hover:bg-success/10",
  3: "text-accent hover:bg-accent/10",
};
