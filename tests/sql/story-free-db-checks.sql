-- Story access, vote irreversibility, delayed results and expiry.
do $$
begin
 if has_table_privilege('anon','public.chat_story_prompts','SELECT')
 or has_table_privilege('authenticated','public.chat_story_votes','SELECT')
 or has_function_privilege('anon','public.vote_chat_story_prompt(uuid,integer)','EXECUTE')
 then raise exception 'Story voting raw data was exposed';end if;
end;$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
declare story uuid:='44444444-4444-4444-8444-444444444444';
 p jsonb;
begin
 if not public.create_chat_story_prompt(story,'quiz','What color suits Luo?',
   array['Black','Gold','Silver'],1) then raise exception 'Author could not create a quiz';end if;
 if not public.create_chat_story_prompt(story,'quiz','What color suits Luo?',
   array['Black','Gold','Silver'],1) then raise exception 'Idempotent create rejected';end if;
 if public.create_chat_story_prompt(story,'quiz','What color suits Luo?',
   array['Black','Gold','Silver'],2) then raise exception 'Quiz answer modified';end if;
 if public.create_chat_story_prompt(story,'poll','duplicate choices',
   array['Yes','yes'],null) then raise exception 'Duplicate choices accepted';end if;
 if public.create_chat_story_prompt('55555555-5555-4555-8555-555555555555',
   'poll','Expired update?',array['Yes','No'],null)
 then raise exception 'Expired Story accepted prompt';end if;
 p:=public.get_chat_story_prompt(story);
 if p->>'is_owner'<>'true' then raise exception 'Owner did not see own quiz';end if;
 if p->>'correct_index'<>'1' then raise exception 'Owner could not review answer';end if;
 if public.vote_chat_story_prompt(story,0) is not null
 then raise exception 'Owner allowed to vote on own Story';end if;
end;$$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$
begin
 if public.get_chat_story_prompt('44444444-4444-4444-8444-444444444444') is not null
 then raise exception 'Outsider read Story prompt';end if;
 if public.vote_chat_story_prompt('44444444-4444-4444-8444-444444444444',1) is not null
 then raise exception 'Outsider voted';end if;
end;$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$
declare story uuid:='44444444-4444-4444-8444-444444444444';p jsonb;
begin
 p:=public.get_chat_story_prompt(story);
 if p is null or p->'correct_index'<>'null'::jsonb
  or p->'counts'<>'null'::jsonb
 then raise exception 'Correct answer or counts leaked before voting';end if;
 p:=public.vote_chat_story_prompt(story,1);
 if p is null or p->>'my_choice'<>'1' or p->>'correct_index'<>'1'
 then raise exception 'Authorized vote was not saved/revealed';end if;
 p:=public.vote_chat_story_prompt(story,2);
 if p->>'my_choice'<>'1' then raise exception 'Vote changed during retry';end if;
 if (select count(*) from public.chat_story_votes where story_id=story)<>1
 then raise exception 'Duplicate votes recorded';end if;
 if public.vote_chat_story_prompt(story,30) is not null
 then raise exception 'Invalid option accepted';end if;
 if public.create_chat_story_prompt(story,'poll','Attack?',array['A','B'],null)
 then raise exception 'Recipient created sticker on someone else story';end if;
 if public.get_chat_story_prompt('55555555-5555-4555-8555-555555555555') is not null
 then raise exception 'Expired Story prompt accessible';end if;
end;$$;
select 'Private Story poll/quiz permissions, expiry, single vote and reveal PASS' as result;
