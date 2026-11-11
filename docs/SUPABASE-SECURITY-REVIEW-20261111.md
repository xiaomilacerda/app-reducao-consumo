# WeedReset — revisão de segurança Supabase (11/11/2026)

Esta revisão **somente consultou** o Supabase Security Advisor e metadados de views do projeto `weedreset`. **Não** alterou banco de dados, autenticação, políticas RLS nem dados de usuários. Os alertas não equivalem automaticamente a vulnerabilidades comprovadas.

| Alerta do Advisor | Quantidade | Severidade indicada |
| --- | ---: | --- |
| Funções `SECURITY DEFINER` executáveis por `authenticated` | 24 | WARN |
| Funções com `search_path` mutável | 36 | WARN |
| Objetos expostos à introspecção GraphQL para `anon` | 39 | WARN |
| Objetos expostos à introspecção GraphQL para `authenticated` | 55 | WARN |
| RLS ativado sem políticas | 10 | INFO |
| Proteção contra senhas comprometidas não habilitada | 1 | WARN |

As seis views públicas inspecionadas (`admin_journey_progress`, `daily_missions_catalog`, `sos_likes_aggregates`, `sos_usage_aggregates`, `sos_usage_daily`, `user_journey_progress`) têm `security_invoker=true`, uma defesa importante. **Porém**, ainda têm privilégio SELECT para `anon` e `authenticated`. Isso precisa de revisão por view e das políticas das tabelas de base, não de revogação indiscriminada.

## Ações pendentes antes de produção

1. **P0** — Validar RLS com duas contas descartáveis A/B e acesso anônimo, incluindo RPCs `SECURITY DEFINER` e as seis views. Qualquer leitura/escrita cruzada é bloqueador.
2. **P0** — Testar exclusão de conta de ponta a ponta em ambiente seguro, incluindo `weedreset_purge_account_data`, Edge Function e dados órfãos. Não executar sobre contas reais.
3. **P1** — Revisar as 24 funções privilegiadas individualmente: identidade do chamador, parâmetros arbitrários, grants e `search_path`; corrigir apenas após teste.
4. **P1** — Rever os 39/55 objetos GraphQL e remover grants de leitura desnecessários de forma incremental. Se GraphQL não é usado, avaliar desativação da extensão, com análise de dependências.
5. **P1** — Configurar proteção contra senhas comprometidas no painel Auth, se disponível no plano.
6. **P1** — Rever os 10 objetos RLS sem políticas: vários são internos ou tabelas de backup; ausência de políticas pode ser **intencional**.

Fontes oficiais:
- [Supabase Security Advisor](https://supabase.com/docs/guides/database/database-linter)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Proteção de senha](https://supabase.com/docs/guides/auth/password-security)

**Não declarar segurança certificada ou testes aprovados sem evidências.**
