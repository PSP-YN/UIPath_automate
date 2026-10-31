create table public.workspaces (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.workspaces (id, name)
values ('7d380700-0f5a-4f3d-b48a-f942013f8172', 'Main workspace');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'reviewer', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  idempotency_key uuid not null,
  template_id text not null check (
    template_id in (
      'invoice-review',
      'support-triage',
      'purchase-request',
      'expense-reimbursement',
      'employee-onboarding',
      'leave-request',
      'contract-intake',
      'lead-qualification',
      'sales-quote-approval',
      'it-access-request',
      'inventory-reorder',
      'policy-exception'
    )
  ),
  status text not null check (
    status in ('pending_review', 'approved', 'rejected', 'failed')
  ),
  input_data jsonb not null check (jsonb_typeof(input_data) = 'object'),
  analysis jsonb not null check (jsonb_typeof(analysis) = 'object'),
  approved_output jsonb,
  attempts integer not null default 1 check (attempts > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  reviewed_by uuid references auth.users (id) on delete restrict,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  check (decision_note is null or length(decision_note) <= 1000)
);

create index workflow_runs_workspace_status_created_idx
  on public.workflow_runs (workspace_id, status, created_at desc);

create table public.workflow_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  run_id uuid not null references public.workflow_runs (id) on delete restrict,
  actor_id uuid references auth.users (id) on delete set null,
  event text not null check (
    event in ('submitted', 'approved', 'rejected', 'retry_started')
  ),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index workflow_events_run_created_idx
  on public.workflow_events (run_id, created_at, id);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_reviewer(
  target_workspace_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = target_user_id
      and member.role in ('owner', 'admin', 'reviewer')
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_runs force row level security;
alter table public.workflow_events enable row level security;
alter table public.workflow_events force row level security;

create policy "Workspace members can read their workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "Members can read their own membership"
  on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Workspace members can read workflow runs"
  on public.workflow_runs for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read workflow events"
  on public.workflow_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_members from anon, authenticated;
revoke all on public.workflow_runs from anon, authenticated;
revoke all on public.workflow_events from anon, authenticated;
grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.workflow_runs to authenticated;
grant select on public.workflow_events to authenticated;
grant select on public.workspaces to service_role;
grant select on public.workspace_members to service_role;
grant select on public.workflow_runs to service_role;
grant select on public.workflow_events to service_role;

create or replace function public.submit_workflow(
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_template_id text,
  p_input jsonb,
  p_analysis jsonb
)
returns setof public.workflow_runs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  member_workspace_id uuid;
  saved_run public.workflow_runs;
begin
  if p_actor_id is null or p_idempotency_key is null then
    raise exception 'Authenticated actor and idempotency key are required.'
      using errcode = '22023';
  end if;

  select member.workspace_id
  into member_workspace_id
  from public.workspace_members as member
  where member.user_id = p_actor_id
  order by member.created_at
  limit 1;

  if member_workspace_id is null then
    raise exception 'Actor is not a workspace member.'
      using errcode = '42501';
  end if;

  if p_template_id not in (
    'invoice-review', 'support-triage', 'purchase-request',
    'expense-reimbursement', 'employee-onboarding', 'leave-request',
    'contract-intake', 'lead-qualification', 'sales-quote-approval',
    'it-access-request', 'inventory-reorder', 'policy-exception'
  ) then
    raise exception 'Unknown workflow template.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_input) is distinct from 'object'
     or jsonb_typeof(p_analysis) is distinct from 'object'
     or pg_column_size(p_input) > 65536
     or pg_column_size(p_analysis) > 16384
     or p_analysis ->> 'risk' is null
     or p_analysis ->> 'risk' not in ('routine', 'attention', 'urgent')
     or jsonb_typeof(p_analysis -> 'review_reasons') is distinct from 'array' then
    raise exception 'Workflow input or analysis is invalid or too large.'
      using errcode = '22023';
  end if;

  insert into public.workflow_runs (
    workspace_id,
    idempotency_key,
    template_id,
    status,
    input_data,
    analysis,
    created_by
  )
  values (
    member_workspace_id,
    p_idempotency_key,
    p_template_id,
    'pending_review',
    p_input,
    p_analysis,
    p_actor_id
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning * into saved_run;

  if saved_run.id is null then
    select *
    into saved_run
    from public.workflow_runs
    where workspace_id = member_workspace_id
      and idempotency_key = p_idempotency_key
    for update;

    if saved_run.template_id is distinct from p_template_id
       or saved_run.input_data is distinct from p_input then
      raise exception 'Idempotency key was already used with different input.'
        using errcode = '23505';
    end if;

    return next saved_run;
    return;
  end if;

  insert into public.workflow_events (
    workspace_id, run_id, actor_id, event, details
  )
  values (
    member_workspace_id,
    saved_run.id,
    p_actor_id,
    'submitted',
    jsonb_build_object('template_id', p_template_id, 'risk', p_analysis ->> 'risk')
  );

  return next saved_run;
  return;
end;
$$;

create or replace function public.review_workflow(
  p_actor_id uuid,
  p_run_id uuid,
  p_decision text,
  p_note text
)
returns setof public.workflow_runs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  saved_run public.workflow_runs;
  next_status text;
  next_output jsonb;
begin
  if p_actor_id is null
     or p_decision is null
     or p_decision not in ('approve', 'reject') then
    raise exception 'A valid reviewer and decision are required.'
      using errcode = '22023';
  end if;
  if p_note is null or length(p_note) > 1000 then
    raise exception 'Review note must be 1,000 characters or fewer.'
      using errcode = '22023';
  end if;

  select *
  into saved_run
  from public.workflow_runs
  where id = p_run_id
  for update;

  if saved_run.id is null then
    raise exception 'Workflow case not found.'
      using errcode = 'P0002';
  end if;
  if not public.is_workspace_reviewer(saved_run.workspace_id, p_actor_id) then
    raise exception 'Reviewer role is required.'
      using errcode = '42501';
  end if;
  if saved_run.status <> 'pending_review' then
    raise exception 'Workflow case is not awaiting review.'
      using errcode = '55000';
  end if;

  next_status := case p_decision when 'approve' then 'approved' else 'rejected' end;
  next_output := null;

  if p_decision = 'approve' then
    next_output := jsonb_build_object(
      'status', 'approved_for_manual_processing',
      'external_action_executed', false,
      'approved_by', p_actor_id,
      'approved_at', now()
    );
    if saved_run.template_id = 'support-triage'
       and saved_run.analysis #> '{findings,draft_reply}' is not null then
      next_output := next_output || jsonb_build_object(
        'approved_reply', saved_run.analysis #> '{findings,draft_reply}'
      );
    elsif saved_run.template_id = 'invoice-review' then
      next_output := next_output || jsonb_build_object(
        'payment_executed', false,
        'amount', saved_run.input_data -> 'total',
        'currency', saved_run.input_data -> 'currency'
      );
    elsif saved_run.template_id = 'inventory-reorder' then
      next_output := next_output || jsonb_build_object(
        'order_placed', false,
        'suggested_quantity', saved_run.analysis #> '{findings,suggested_quantity}'
      );
    end if;
  end if;

  update public.workflow_runs
  set status = next_status,
      reviewed_by = p_actor_id,
      decision_note = nullif(btrim(p_note), ''),
      approved_output = next_output,
      updated_at = now()
  where id = p_run_id
  returning * into saved_run;

  insert into public.workflow_events (
    workspace_id, run_id, actor_id, event, details
  )
  values (
    saved_run.workspace_id,
    saved_run.id,
    p_actor_id,
    case p_decision when 'approve' then 'approved' else 'rejected' end,
    jsonb_build_object('note', nullif(btrim(p_note), ''))
  );

  return next saved_run;
  return;
end;
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
revoke all on function public.is_workspace_reviewer(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_workflow(uuid, uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.review_workflow(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_workflow(uuid, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.review_workflow(uuid, uuid, text, text) to service_role;
