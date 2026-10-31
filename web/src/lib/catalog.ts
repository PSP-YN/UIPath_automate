import { z } from "zod";
import catalogData from "../catalog/workflows.json";

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "email", "date", "number", "textarea", "select"]),
  required: z.boolean(),
  maxLength: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  help: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
});

const workflowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  area: z.string().min(1),
  description: z.string().min(1),
  reviewer: z.string().min(1),
  gated_action: z.string().min(1),
  fields: z.array(fieldSchema).min(1),
});

export type WorkflowField = z.infer<typeof fieldSchema>;
export type Workflow = z.infer<typeof workflowSchema>;

export const workflows = z.array(workflowSchema).parse(catalogData);

const workflowIds = new Set(workflows.map((workflow) => workflow.id));
if (workflowIds.size !== workflows.length) {
  throw new Error("Workflow catalog contains duplicate IDs.");
}

for (const workflow of workflows) {
  const fieldIds = new Set(workflow.fields.map((field) => field.id));
  if (fieldIds.size !== workflow.fields.length) {
    throw new Error(`Workflow '${workflow.id}' contains duplicate field IDs.`);
  }
  for (const field of workflow.fields) {
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      throw new Error(`Select field '${field.id}' in '${workflow.id}' needs options.`);
    }
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
      throw new Error(`Field '${field.id}' in '${workflow.id}' has an invalid range.`);
    }
  }
}

export function getWorkflow(id: string): Workflow | undefined {
  return workflows.find((workflow) => workflow.id === id);
}
