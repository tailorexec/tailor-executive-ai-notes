# Deploy do backend no Supabase (rode DEPOIS de: supabase login e supabase link).
# Exemplo:
#   ./scripts/deploy-supabase.ps1 -Anthropic "sk-ant-..." -Groq "gsk_..."
param(
  [Parameter(Mandatory=$true)][string]$Anthropic,
  [Parameter(Mandatory=$true)][string]$Groq,
  [string]$Provider = "groq"
)

Write-Host "==> Aplicando schema (migrations)..." -ForegroundColor Cyan
supabase db push

Write-Host "==> Publicando edge functions..." -ForegroundColor Cyan
supabase functions deploy ai
supabase functions deploy transcribe

Write-Host "==> Configurando secrets (servidor)..." -ForegroundColor Cyan
supabase secrets set ANTHROPIC_API_KEY=$Anthropic
supabase secrets set TRANSCRIPTION_PROVIDER=$Provider
supabase secrets set GROQ_API_KEY=$Groq

Write-Host "OK! Agora preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local e rode 'npm run dev'." -ForegroundColor Green
