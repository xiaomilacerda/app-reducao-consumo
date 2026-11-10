# WeedReset — achados confirmados de segurança (10/11/2026)

Esta revisão usa inspeção do código do GitHub e metadados do projeto Supabase. Não é um teste ponta a ponta nem uma certificação de conformidade.

## Correções desta ramificação

- CORS global com `Access-Control-Allow-Origin: *` e `Access-Control-Allow-Credentials: true` foi removido. As APIs próprias não precisam liberar leitura por origens arbitrárias.
- A rota antiga `/set-guest` aceitava redirecionamento absoluto para qualquer site e identificador de visitante escolhido pelo solicitante. Agora responde 404 em produção; em desenvolvimento, aceita somente UUID e redirecionamento interno.
- `public.get_journey_missions(p_user_id, p_day)` era `SECURITY DEFINER` e consultava progresso de um UUID arbitrário sem verificar `auth.uid()`. A migração `20261110_weedreset_journey_rpc_ownership.sql` exige que o UUID seja o do usuário autenticado, valida o dia e revoga EXECUTE de `anon`.

## Alertas atuais do Supabase Security Advisor

Consulta realizada em 10/11/2026:

| Alerta | Quantidade | Observação |
| --- | ---: | --- |
| Funções SECURITY DEFINER executáveis por `authenticated` | 24 | Algumas são RPCs intencionais e validam `auth.uid()`; revisar individualmente |
| Funções com `search_path` mutável | 36 | Não alterar em lote sem revisar referências não qualificadas |
| Objetos expostos à introspecção GraphQL para `anon` | 39 | Exposição do esquema não prova, por si só, vazamento de linhas; revisar grants |
| Objetos expostos à introspecção GraphQL para `authenticated` | 55 | Verificar necessidade de GraphQL e permissões |
| RLS ativado sem políticas | 10 | Pode ser intencional para tabelas internas; verificar grants |
| Proteção contra senhas comprometidas | 1 | Habilitar no painel Auth do Supabase quando disponível |

Fontes:
- https://supabase.com/docs/guides/database/database-linter
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/password-security

## Validações antes da publicação

1. Testar a RPC de jornada com duas contas descartáveis A/B: A acessa apenas A; B acessa apenas B; acesso anônimo é recusado.
2. Confirmar que o cliente atual chama a RPC apenas com o próprio UUID, se ela ainda estiver em uso.
3. Testar a exclusão de conta e a revogação de sessão com usuário descartável.
4. Verificar o funcionamento da recuperação de senha com e-mail real e redirect allowlist.
5. Revisar grants e SECURITY DEFINER restantes antes de declarar a auditoria de segurança encerrada.

**Não executar revogações globais de grants sem identificar as dependências do aplicativo.**
