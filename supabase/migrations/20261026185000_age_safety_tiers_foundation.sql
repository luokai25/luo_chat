-- Staged foundation only. DO NOT enable the rollout before age assurance,
-- reviewer labeling, Stories/media access controls, and appeal flows exist.
-- Unknown ages and unknown labels fail closed once enabled.
begin;
create table if not exists luo_internal.age_safety_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 age_tier text not null check (age_tier in ('13-14','15-17','18+')),
 assurance text not null check(assurance in ('independent','provider_verified')),
 verified_at timestamptz not null default now(),
 valid_until timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists luo_internal.entry_safety_labels(
 entry_id uuid primary key references luo_internal.space_entries(id) on delete cascade,
 rating text not null default 'unreviewed'
  check(rating in ('general','teen','mature','unreviewed')),
 reviewed_at timestamptz,
 review_source text check(review_source in ('moderator','validated_classifier')),
 updated_at timestamptz not null default now(),
 constraint confirmed_labels_require_review check(
  (rating='unreviewed' and reviewed_at is null)
  or(rating<>'unreviewed' and reviewed_at is not null and review_source is not null)
 )
);
create table if not exists luo_internal.age_safety_rollout(
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into luo_internal.age_safety_rollout(id,enabled)
 values(true,false) on conflict (id) do nothing;
create index if not exists age_safety_accounts_tier on luo_internal.age_safety_accounts(age_tier);
create index if not exists entry_safety_labels_rating on luo_internal.entry_safety_labels(rating);
alter table luo_internal.age_safety_accounts enable row level security;
alter table luo_internal.entry_safety_labels enable row level security;
alter table luo_internal.age_safety_rollout enable row level security;
revoke all on luo_internal.age_safety_accounts from anon, authenticated, public;
revoke all on luo_internal.entry_safety_labels from anon, authenticated, public;
revoke all on luo_internal.age_safety_rollout from anon, authenticated, public;
grant select,insert,update,delete on luo_internal.age_safety_accounts to service_role;
grant select,insert,update,delete on luo_internal.entry_safety_labels to service_role;
grant select,update on luo_internal.age_safety_rollout to service_role;

create or replace function luo_internal.age_content_allowed(
 entry luo_internal.space_entries, viewer uuid
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
 live boolean;
 tier text;
 rating text;
begin
 select enabled into live from luo_internal.age_safety_rollout where id;
 if not coalesce(live,false) then return true;end if;
 if entry.kind not in('post','clip') then return true;end if;
 if viewer is null then return false;end if;
 select age_tier into tier from luo_internal.age_safety_accounts
  where user_id=viewer and (valid_until is null or valid_until>now());
 -- Unassured users cannot be assumed to be adults.
 if tier is null then tier:='13-14';end if;
 if tier='18+' then return true;end if;
 select label.rating into rating from luo_internal.entry_safety_labels label where label.entry_id=entry.id;
 if rating is null or rating='unreviewed' then return false;end if;
 if tier='15-17' then return rating in('general','teen');end if;
 return rating='general';
end;
$$;
revoke all on function luo_internal.age_content_allowed(luo_internal.space_entries,uuid)
 from public,anon,authenticated;
grant execute on function luo_internal.age_content_allowed(luo_internal.space_entries,uuid) to service_role;

-- Preserve all existing privacy, block, membership and expiry checks. Age
-- restrictions are an additional AND, never a replacement for visibility.
create or replace function luo_internal.space_visible(
 e luo_internal.space_entries, actor uuid
) returns boolean
language sql stable security definer set search_path='' as $$
 select actor is not null and not luo_internal.space_blocked(actor,e.owner_id)
 and(e.expires_at is null or e.expires_at>now()) and
 (e.owner_id=actor or coalesce(e.collaborator=actor,false) and e.submitted
  or(e.published and
   (e.kind not in('post','clip')
     or coalesce((select sp.sections->>case when e.kind='post' then 'posts' else 'clips' end
                  from luo_internal.space_profiles sp where sp.user_id=e.owner_id),'friends')='public'
     or coalesce((select sp.sections->>case when e.kind='post' then 'posts' else 'clips' end
                  from luo_internal.space_profiles sp where sp.user_id=e.owner_id),'friends')='friends'
        and luo_internal.space_friends(actor,e.owner_id))
   and(e.audience='public'
     or e.audience='friends' and luo_internal.space_friends(actor,e.owner_id)
     or e.audience='room' and exists(
       select 1 from public.conversation_members
       where conversation_id=e.room_id and user_id=actor))
  ))
 and luo_internal.age_content_allowed(e,actor);
$$;

-- Narrow self-read: no DOB, no private reviewer metadata, and no client writes.
create or replace function public.luo_my_age_safety()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then null else
  jsonb_build_object(
   'age_tier',coalesce(
      (select a.age_tier from luo_internal.age_safety_accounts a
        where a.user_id=auth.uid() and
         (a.valid_until is null or a.valid_until>now())),'unknown'),
   'safety_mode',case
       when (select a.age_tier from luo_internal.age_safety_accounts a where a.user_id=auth.uid() and (a.valid_until is null or a.valid_until>now()))='18+' then 'standard'
       when (select a.age_tier from luo_internal.age_safety_accounts a where a.user_id=auth.uid() and (a.valid_until is null or a.valid_until>now()))='15-17' then 'teen'
       else 'junior' end,
   'enforced',coalesce((select enabled from luo_internal.age_safety_rollout where id),false),
   'authority','server'
  ) end;
$$;
revoke all on function public.luo_my_age_safety() from public,anon;
grant execute on function public.luo_my_age_safety() to authenticated,service_role;
commit;
