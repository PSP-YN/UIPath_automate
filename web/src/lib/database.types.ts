export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkflowStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "failed";

export type WorkspaceRole = "owner" | "admin" | "reviewer" | "member";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableShape<Row, Insert, Update, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type WorkflowRunRow = {
  id: string;
  workspace_id: string;
  idempotency_key: string;
  template_id: string;
  status: WorkflowStatus;
  input_data: Json;
  analysis: Json;
  approved_output: Json | null;
  attempts: number;
  created_by: string;
  reviewed_by: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      workspaces: TableShape<
        { id: string; name: string; created_at: string },
        { id: string; name: string; created_at?: string },
        { name?: string }
      >;
      workspace_members: TableShape<
        {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        },
        {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at?: string;
        },
        { role?: WorkspaceRole }
      >;
      workflow_runs: TableShape<
        WorkflowRunRow,
        {
          id?: string;
          workspace_id: string;
          idempotency_key: string;
          template_id: string;
          status: WorkflowStatus;
          input_data: Json;
          analysis: Json;
          approved_output?: Json | null;
          attempts?: number;
          created_by: string;
          reviewed_by?: string | null;
          decision_note?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: WorkflowStatus;
          approved_output?: Json | null;
          attempts?: number;
          reviewed_by?: string | null;
          decision_note?: string | null;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "workflow_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ]
      >;
      workflow_events: TableShape<
        {
          id: number;
          workspace_id: string;
          run_id: string;
          actor_id: string | null;
          event: "submitted" | "approved" | "rejected" | "retry_started";
          details: Json;
          created_at: string;
        },
        {
          id?: number;
          workspace_id: string;
          run_id: string;
          actor_id?: string | null;
          event: "submitted" | "approved" | "rejected" | "retry_started";
          details?: Json;
          created_at?: string;
        },
        never,
        [
          {
            foreignKeyName: "workflow_events_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      submit_workflow: {
        Args: {
          p_actor_id: string;
          p_idempotency_key: string;
          p_template_id: string;
          p_input: Json;
          p_analysis: Json;
        };
        Returns: WorkflowRunRow[];
      };
      review_workflow: {
        Args: {
          p_actor_id: string;
          p_run_id: string;
          p_decision: "approve" | "reject";
          p_note: string;
        };
        Returns: WorkflowRunRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
