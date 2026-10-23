-- Server-side username signup migration checks on disposable PostgreSQL only.
do $$
declare
 codes text[];
 a text:=repeat('a',64);
 b text:=repeat('b',64);
 idx int;
begin
 if has_schema_privilege('anon','luo_internal','USAGE')
 then raise exception 'Private recovery schema exposed';end if;
 if has_table_privilege('authenticated','luo_internal.auth_recovery_codes','SELECT')
 then raise exception 'Recovery digests exposed to human clients';end if;
 if has_function_privilege('anon','public.replace_luo_recovery_codes(uuid,text[])','EXECUTE')
  or has_function_privilege('authenticated','public.consume_luo_recovery_code(uuid,text)','EXECUTE')
 then raise exception 'Recovery code mutation exposed';end if;
 select array_agg(encode(sha256(convert_to('luo-test-recovery:'||g::text,'UTF8')),'hex'))
 into codes from generate_series(1,10) g;
 if cardinality(codes)<>10 then raise exception 'Could not create fixtures';end if;
 if not public.replace_luo_recovery_codes(
  '11111111-1111-4111-8111-111111111111',codes)
 then raise exception 'Could not set recovery codes';end if;
 if (select count(*) from luo_internal.auth_recovery_codes
  where user_id='11111111-1111-4111-8111-111111111111')<>10
 then raise exception 'Recovery codes not stored';end if;
 if not public.consume_luo_recovery_code(
  '11111111-1111-4111-8111-111111111111',codes[1])
 then raise exception 'Valid recovery code rejected';end if;
 if public.consume_luo_recovery_code(
  '11111111-1111-4111-8111-111111111111',codes[1])
 then raise exception 'One-time recovery code replay';end if;
 if public.replace_luo_recovery_codes(
  '11111111-1111-4111-8111-111111111111',array[codes[1],codes[1]])
 then raise exception 'Duplicate recovery codes permitted';end if;
 if public.replace_luo_recovery_codes(
  '11111111-1111-4111-8111-111111111111',array[codes[1]])
 then raise exception 'Insufficient recovery codes permitted';end if;
 -- Multiple members of one household can register with one shared IP.
 for idx in 1..6 loop
  if not public.consume_signup_rate_limit(
   encode(sha256(convert_to('household-'||idx,'UTF8')),'hex'),b)
  then raise exception 'Family member % blocked before 6 users',idx;end if;
 end loop;
 if public.consume_signup_rate_limit(a,b) then
  raise exception 'IP hourly anti-abuse limit not enforced';end if;
 for idx in 1..4 loop
  if not public.consume_signup_rate_limit(
   a,encode(sha256(convert_to('different-ip-'||idx,'UTF8')),'hex'))
  then raise exception 'Per-username quota blocked before limit';end if;
 end loop;
 if public.consume_signup_rate_limit(
  a,encode(sha256(convert_to('fresh-ip','UTF8')),'hex'))
 then raise exception 'Username signup quota not enforced';end if;
end;$$;

-- Verify a legacy account retains its immutable auth ID and address.
do $$
begin
 if not exists(select 1 from auth.users
  where id='11111111-1111-4111-8111-111111111111'
   and email='legacy@example.invalid')
 then raise exception 'Existing account unexpectedly modified';end if;
end;$$;
select 'Recovery, existing-user preservation and shared-IP signup quota PASS' as result;
