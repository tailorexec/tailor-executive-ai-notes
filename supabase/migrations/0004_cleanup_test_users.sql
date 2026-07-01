-- Remove usuarios de teste criados durante diagnostico (cadastro).
-- O delete em auth.users faz cascade para public.profiles.
delete from auth.users where email like 'repro_%@tailorexec.com.br';
