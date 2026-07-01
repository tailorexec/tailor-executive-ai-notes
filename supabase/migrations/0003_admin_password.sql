-- Define/reseta a senha do administrador oficial para o valor combinado e confirma.
-- Idempotente: se a conta ainda nao existir, nao afeta nada (0 linhas).

create extension if not exists pgcrypto with schema extensions;

update auth.users
set encrypted_password = extensions.crypt('Tailor@007', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) = 'flavio.junior@tailorexec.com.br';
