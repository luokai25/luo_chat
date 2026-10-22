create index drawing_board_creator_idx on public.chat_drawing_boards(created_by);
create index albums_owner_idx on public.chat_albums(owner_id);
create index push_queue_subscription_idx on luo_internal.push_queue(user_id,endpoint);
create index push_queue_created_idx on luo_internal.push_queue(created_at);
