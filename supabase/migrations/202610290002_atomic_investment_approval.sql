
create or replace function public.review_investment_request_atomic(
    p_request_id uuid,
    p_admin_id uuid,
    p_status text,
    p_admin_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_request public.investment_requests%rowtype;
    v_plan public.plans%rowtype;
    v_contract public.investment_contracts%rowtype;
    v_note text;
    v_duration integer;
    v_ends_at timestamptz;
begin
    -- Validate the requested decision.
    if p_status not in ('approved', 'rejected') then
        raise exception 'Status must be approved or rejected.'
            using errcode = '22023';
    end if;

    v_note := pg_catalog.btrim(coalesce(p_admin_note, ''));

    if pg_catalog.length(v_note) > 1000 then
        raise exception 'Administrator note cannot exceed 1000 characters.'
            using errcode = '22023';
    end if;

    -- Never trust an administrator ID supplied by the caller alone.
    if not exists (
        select 1
        from public.profiles p
        where p.id = p_admin_id
          and p.role = 'admin'
    ) then
        raise exception 'Administrator permission required.'
            using errcode = '42501';
    end if;

    -- Lock the request to prevent simultaneous reviews.
    select *
    into v_request
    from public.investment_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception 'Investment request not found.'
            using errcode = 'P0002';
    end if;

    if v_request.status <> 'pending' then
        raise exception 'This request has already been reviewed.'
            using errcode = '55000';
    end if;

    -- Revalidate plan availability and amount while the transaction runs.
    if p_status = 'approved' then
        select *
        into v_plan
        from public.plans
        where id = v_request.plan_id
        for share;

        if not found or v_plan.active is not true then
            raise exception 'This plan is no longer active.'
                using errcode = '55000';
        end if;

        if v_request.requested_amount < v_plan.minimum_amount then
            raise exception 'Requested amount is below the plan minimum.'
                using errcode = '22023';
        end if;

        if v_plan.maximum_amount is not null
           and v_request.requested_amount > v_plan.maximum_amount then
            raise exception 'Requested amount exceeds the plan maximum.'
                using errcode = '22023';
        end if;

        v_duration := v_plan.contract_duration_days;

        if v_duration is not null then
            v_ends_at := pg_catalog.now()
                + pg_catalog.make_interval(days => v_duration);
        end if;
    end if;

    -- Record the decision.
    update public.investment_requests
    set status = p_status,
        admin_note = v_note,
        reviewed_by = p_admin_id,
        reviewed_at = pg_catalog.now()
    where id = p_request_id
      and status = 'pending'
    returning * into v_request;

    if not found then
        raise exception 'Request was reviewed by another administrator.'
            using errcode = '55000';
    end if;

    -- Approval creates the contract in the same transaction.
    if p_status = 'approved' then
        insert into public.investment_contracts (
            request_id,
            user_id,
            plan_id,
            principal,
            asset,
            status,
            ends_at
        )
        values (
            v_request.id,
            v_request.user_id,
            v_request.plan_id,
            v_request.requested_amount,
            v_request.asset,
            'active',
            v_ends_at
        )
        returning * into v_contract;
    end if;

    -- An audit failure must roll back the decision and contract too.
    insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        details
    )
    values (
        p_admin_id,
        'investment_request_' || p_status,
        'investment_request',
        p_request_id,
        pg_catalog.jsonb_build_object(
            'user_id', v_request.user_id,
            'plan_id', v_request.plan_id,
            'requested_amount', v_request.requested_amount::text,
            'admin_note', v_note
        )
    );

    return pg_catalog.jsonb_build_object(
        'message',
        case
            when p_status = 'approved'
                then 'Request approved and contract activated.'
            else 'Investment request rejected.'
        end,
        'request', pg_catalog.to_jsonb(v_request),
        'contract',
        case
            when p_status = 'approved'
                then pg_catalog.to_jsonb(v_contract)
            else null
        end
    );
end;
$function$;

-- Only the trusted backend service may execute this function.
revoke all on function public.review_investment_request_atomic(
    uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.review_investment_request_atomic(
    uuid, uuid, text, text
) to service_role;
