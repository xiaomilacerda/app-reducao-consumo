# WeedReset — Auth e rotas protegidas

O app já inclui /login e /signup com Supabase Auth, e mantém uma experiência para visitantes.
Essa alteração protege no **servidor (Next.js 15 middleware)**:

- Login obrigatório: `/profile`, `/settings`, `/premium`, `/ai-insights`.
- Login + permissão administrativa: `/admin/**` e `/api/admin/**`.
- `/login`, `/signup`, `/`, `/onboarding` e a experiência de visitante existente continuam públicos.

## Ambiente

Configurar na Vercel duas variáveis pertencentes ao **mesmo projeto** Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com o MESMO valor público até a migração dos componentes legados.

Nunca usar chave `service_role` ou `sb_secret_...` no navegador ou em `NEXT_PUBLIC_*`.

## Permissão administrativa

Não confiar em `public.profiles.is_admin` para autorizar acesso, porque as atuais políticas de
UPDATE em `profiles` permitem que o usuário altere sua própria linha e podem permitir escalada
de privilégios. O middleware verifica exclusivamente `auth.users.raw_app_meta_data`
(recebido via `auth.getUser()`) com `is_admin: true`, `role: "admin"` ou
`roles: ["admin"]`. Configure esse atributo **apenas por serviço administrativo
seguro do Supabase**. Isso pode bloquear administradores antigos que só possuíam
`profiles.is_admin` até que suas contas sejam migradas.

## Riscos anteriores que exigem revisão no banco

A auditoria de 2026-10-12 identificou 14 tabelas públicas com RLS desativada,
4 views com security definer, e várias políticas duplicadas em `profiles`.
Há uma política `Allow public select profiles` que expõe a leitura de perfis.
Não altere políticas sem planejar o acesso legítimo de cada tabela — ativar RLS
sem políticas pode interromper funcionalidades.

O endpoint `/api/guest-profile` usa uma chave elevada para criar um perfil
de visitante: revisar autenticação, validação, rate limiting e autorização
antes de ativá-lo para usuários externos.

## Testes manuais antes de mesclar

1. Abrir `/profile` sem login -> redirecionar para `/login?next=/profile`.
2. Entrar em `/login?next=/settings` -> acessar `/settings`.
3. Abrir `/api/admin/users` sem login -> HTTP 401.
4. Abrir `/api/admin/users` como usuário comum -> HTTP 403.
5. Como usuário configurado em `app_metadata` como admin -> permitir.
6. Confirmar que / e /onboarding continuam funcionando como visitante.
7. Fazer logout e repetir os testes.
