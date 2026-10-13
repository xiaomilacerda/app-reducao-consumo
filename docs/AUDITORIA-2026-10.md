# Auditoria WeedReset — outubro de 2026

## Escopo
Aplicativo Next.js `xiaomilacerda/app-reducao-consumo`, Vercel `app-reducao-consumo` e **somente leitura** do Supabase de produção `symdsbdwsuoshdthtphn`.

## Correções de código
- Login não redefine a carteira `user_wallet.coins` para zero. Insere a carteira apenas quando ainda não existe.
- Signup grava nome completo e apelido em `user_metadata`; login recupera nome de perfis antigos em branco sem alterar direitos ou pontuação.
- `story` carrega XP de `profiles.xp`, e não da tabela `user_wallet`.
- IA de Prevenção, SOS, histórico e painel administrativo usam nomes de colunas existentes no Supabase.
- Perfil e Configurações não enviam para `profiles` colunas ausentes do esquema. Algumas preferências continuam apenas em estado local, aguardando projeto específico de persistência.
- Inventário `user_store_items` não usa mais o campo inexistente `qty`; falhas de gravação não devem produzir falso sucesso.
- Rotas administrativas sem persistência não afirmam banimento/moderação realizados: retornam HTTP 501.
- As rotas diagnósticas públicas `/api/test-api-key` e `/api/guest-profile` foram bloqueadas na produção até revisão de segurança.
- Removidas cópias não utilizadas com JSX inválido em arquivos `.ts` e reparado `src/lib/format.ts`.
- Código experimental de Google OAuth não utilizado removido, mantendo o login por e-mail.

## Validações
- Compilação `npm run build` concluída em ambiente de testes com variáveis públicas fictícias.
- Auditoria AST comparou consultas `select` e escritas `insert/update/upsert` de 62 arquivos ativos com as colunas das 55 tabelas e views públicos: nenhuma coluna inexistente encontrada após as correções.
- Acesso autenticado e gravações reais precisam ser validados com uma conta de teste, sem utilizar dados particulares dos usuários.

## Pendências e segurança — não corrigir automaticamente em produção
1. O Supabase reportou **14 tabelas públicas sem RLS**, entre elas `profiles_backup`, `admin_users`, `admin_logs`, `analytics_events`, `notification_queue`. Projetar e testar políticas antes de habilitar RLS.
2. Existem **4 views SECURITY DEFINER** e funções sem `search_path` fixado; auditar permissões de execução e exposição.
3. Há política permissiva de leitura de `profiles`; informações de perfil exigem revisão de minimização e privacidade.
4. `profiles.is_admin` pode ser modificado pelo próprio usuário com as políticas atuais. A camada middleware usa apenas `auth.users.app_metadata` confiável, mas o banco precisa de endurecimento adicional.
5. Compras/transferências de moedas pela interface não são transações atômicas e ainda dependem de RLS permissiva; devem ser migradas para RPC segura transacional e regras de servidor.
6. Projeto possui erros TypeScript anteriores e `next.config.ts` com verificação desativada. Não reativar a validação antes de corrigir todos os tipos, inclusive código histórico em `src/app/PAGES`.
7. O `package-lock.json` ainda deve ser sincronizado com o `package.json` atualizado para garantir builds reproduzíveis.
8. Uma antiga chave com privilégio `service_role` foi exposta anteriormente; **revogar/substituir na configuração do Supabase**, sem inserir chaves em arquivos ou mensagens.

Nenhuma migração, alteração de RLS, exclusão de banco ou edição dos dados de usuários fez parte deste PR.
