create or replace function luo_internal.wake_push() returns trigger language plpgsql security definer set search_path='' as $$declare token text;begin
 if not exists(select 1 from luo_internal.push_queue where available_at<=now() and(lease_until is null or lease_until<now()) and attempts<5)then return null;end if;
 update luo_internal.push_config set last_wake=clock_timestamp() where singleton and(last_wake is null or last_wake<clock_timestamp()-interval '5 seconds') returning worker_key into token;
 if token is not null then perform net.http_post(url:='https://byjixqwpjvsgmqilmzbm.supabase.co/functions/v1/luo-web-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}',timeout_milliseconds:=10000);end if;return null;
 exception when others then return null;end;$$;
