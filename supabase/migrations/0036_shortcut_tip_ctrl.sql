-- v0.18.25: atalho de gravar voltou para Ctrl+Shift+G (o conflito com a barra de busca do
-- Chromium ja e barrado pelo before-input-event no app). Reverte a dica. Nao-destrutivo/idempotente.
update public.tips
set body = replace(body, 'Alt+Shift+G', 'Ctrl+Shift+G')
where body like '%Alt+Shift+G%';
