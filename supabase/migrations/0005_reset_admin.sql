-- Redefine a senha do admin para o valor combinado e garante confirmacao + papel admin.
create extension if not exists pgcrypto with schema extensions;

update auth.users
set encrypted_password = extensions.crypt('Tailor@007', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) = 'flavio.junior@tailorexec.com.br';

-- Garante um profile de administrador vinculado a esse usuario.
insert into public.profiles (id, first_name, last_name, email, phone, role)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'first_name',''), 'Flavio'),
       coalesce(nullif(u.raw_user_meta_data->>'last_name',''), 'Junior'),
       u.email,
       coalesce(u.raw_user_meta_data->>'phone', ''),
       'admin'
from auth.users u
where lower(u.email) = 'flavio.junior@tailorexec.com.br'
on conflict (id) do update set role = 'admin';
