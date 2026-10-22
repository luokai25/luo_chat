-- Read-only operational checks. Run with an authorized database owner connection.
-- Never print cron.command, request headers, tokens, endpoints or message bodies.
select j.jobname,j.active,max(d.start_time) filter(where d.status='succeeded') as last_success,
 count(*) filter(where d.status='failed' and d.start_time>now()-interval '1 hour') as failures_last_hour
from cron.job j left join cron.job_run_details d on d.jobid=j.jobid and d.start_time>now()-interval '24 hours'
group by j.jobname,j.active order by j.jobname;
select count(*) filter(where attempts>=10) as dead_letter_items,
 count(*) filter(where attempts<10 and queued_at<now()-interval '30 minutes') as overdue_cleanup_items
from public.storage_cleanup_queue;
select count(*) filter(where attempts>=5) as exhausted_push_items,
 count(*) filter(where lease_until<now() and available_at<now()-interval '10 minutes') as overdue_push_items
from luo_internal.push_queue;
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname='public' and not c.relrowsecurity;
