-- Log de auditoria: precisa dar pra marcar um evento como resolvido e ele sumir da lista padrao
-- (senao a tela so acumula pra sempre, mesmo depois do bug ja corrigido). So admin resolve --
-- mesma trava das outras acoes de admin (public.is_admin()).

alter table public.audit_log add column if not exists resolved_at timestamptz;
alter table public.audit_log add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create index if not exists audit_log_unresolved_idx on public.audit_log (created_at desc) where resolved_at is null;

-- audit_log tinha so a policy de select; agora admin tambem pode marcar resolvido (update).
-- Continua sem policy de insert/delete -- so a service role grava linhas novas.
drop policy if exists audit_log_admin_update on public.audit_log;
create policy audit_log_admin_update on public.audit_log
  for update using (public.is_admin()) with check (public.is_admin());
