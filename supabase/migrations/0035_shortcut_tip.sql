-- v0.18.24: o atalho de gravar mudou de Ctrl+Shift+G para Alt+Shift+G (Ctrl+Shift+G conflitava
-- com a barra de busca do Chromium em alguns Windows). Atualiza a dica pra nao ensinar o atalho
-- errado. Nao-destrutivo e idempotente: so troca o trecho do texto; admin pode reeditar em /admin.
update public.tips
set body = replace(body, 'Ctrl+Shift+G', 'Alt+Shift+G')
where body like '%Ctrl+Shift+G%';
