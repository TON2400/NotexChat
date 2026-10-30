insert into public.conversations(type)
values ('global')
on conflict (type) where type = 'global' do nothing;

