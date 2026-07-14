-- Log de auditoria: hoje o app nao tem NENHUMA visibilidade centralizada de erro -- as edge
-- functions so devolvem {error} pro cliente e esquecem; o cliente tem ~12 pontos de catch
-- silencioso (falha de carregar perfil, orcamento indisponivel, guard de SSRF, etc.) que nunca
-- aparecem em lugar nenhum. Esta tabela junta tudo: erros gerais (edge functions, render),
-- erros antes silenciosos, erros esperados do usuario (limite atingido) e eventos de seguranca.
--
-- Espelha o RLS de api_usage (0017): so admin le, ninguem escreve fora da service role -- as
-- edge functions gravam direto (logAuditServer em guard.ts) e o cliente so grava atraves da
-- function log-event (que forca user_id/severity/category a partir do proprio servidor, nunca
-- confiando no que o navegador manda).

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  category text not null check (category in ('system', 'user', 'silent', 'security')),
  source text not null,             -- 'edge:ai', 'client:capture', 'client:render' etc.
  message text not null,
  -- Diagnostico tecnico (stack, componentStack, rota, user-agent) -- NUNCA conteudo do
  -- usuario (transcricao, titulo da nota etc.), por convencao de quem grava.
  detail jsonb,
  user_id uuid references auth.users (id) on delete set null,
  note_id uuid references public.notes (id) on delete set null,
  route text,
  user_agent text
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_severity_idx on public.audit_log (severity, created_at desc);
create index if not exists audit_log_category_idx on public.audit_log (category, created_at desc);
create index if not exists audit_log_user_idx on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

-- Sem policy de insert/update/delete: so a service role (que ignora RLS) escreve.
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select using (public.is_admin());
