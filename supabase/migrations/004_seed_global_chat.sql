insert into public.conversations(type)
values ('global')
on conflict (type) where type = 'global' do nothing;

insert into public.invite_keys(key, role, max_uses)
values ('AdminSigma101', 'admin', 1)
on conflict (key) do nothing;
