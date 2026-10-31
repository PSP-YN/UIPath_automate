import type { WorkspaceRole } from "@/lib/database.types";

export type DemoPersona = {
  id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  title: string;
  description: string;
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "usr_rev_001",
    email: "reviewer@workline.internal",
    name: "Sarah Jenkins",
    role: "reviewer",
    title: "Senior Reviewer",
    description: "Evaluates checks, adds review notes, approves or rejects operational requests.",
  },
  {
    id: "usr_adm_002",
    email: "admin@workline.internal",
    name: "Marcus Vance",
    role: "admin",
    title: "Operations Admin",
    description: "Full review privileges, case oversight, and template workflow governance.",
  },
  {
    id: "usr_sub_003",
    email: "intake@workline.internal",
    name: "Elena Rostova",
    role: "member",
    title: "Intake Specialist",
    description: "Creates and submits operational intake requests and monitors progress.",
  },
  {
    id: "usr_own_004",
    email: "owner@workline.internal",
    name: "David Chen",
    role: "owner",
    title: "Workspace Owner",
    description: "Executive operations director with full authority across the entire pipeline.",
  },
];
