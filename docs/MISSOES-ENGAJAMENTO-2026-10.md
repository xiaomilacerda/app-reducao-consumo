# Missões & Recompensas — evolução 2026-10-13

## Cinco melhorias implementadas

1. **Ritual diário destacado** — botão grande com estado de carregamento, conclusão e mensagens de erro/sucesso acessíveis.
2. **Jornada visual de 7 dias** — progresso real confirmado pelo Supabase, barra animada, dias marcados e capítulo do dia. Reinício na segunda-feira, sem perda das conquistas anteriores.
3. **Três atividades personalizáveis** — pausa consciente, movimento e reflexão. A recomendação deriva da meta principal configurada em `profiles.main_goal`, mas o usuário pode escolher outra.
4. **Recompensas reais e únicas** — +8 XP/+4 moedas por dia, +35 XP/+20 moedas quando todos os sete dias da semana tiverem registros. A operação de crédito é transacional no banco e não recebe montantes do navegador.
5. **História semanal com sete capítulos** — mensagens breves e tarefas possíveis sobre compromisso, gatilhos, hábitos alternativos, conquistas, preparo, bem-estar e retrospectiva.

A missão semanal legada recebeu CTA de alto contraste para registrar o dia e tiles claros (hoje/concluído/futuro). A coleta da recompensa semanal legada usa agora uma única RPC segura, que exige sete check-ins validados na tabela nova, e nunca faz créditos como fallback no cliente.

## Banco e proteção

Projeto de produção: `symdsbdwsuoshdthtphn`. Tabelas criadas:
- `engagement_daily_checkins`: chave única `(user_id, checkin_date)`
- `engagement_week_awards`: chave única `(user_id, week_start)`
- `engagement_weekly_mission_awards`: chave única `(user_id, mission_id, week_start)`

Todas com RLS ativo e permissão SELECT exclusiva de usuário autenticado; **nenhuma autorização direta de INSERT/UPDATE/DELETE foi concedida ao papel authenticated**. As mudanças passam por RPCs:

- `engagement_record_checkin(challenge,mood,reflection)`, com usuário determinado pelo JWT, valores permitidos pré-definidos, reflexão limitada a 500 caracteres, cálculo de dia conforme timezone da conta, e créditos idempotentes por PK.
- `complete_weekly_mission(user_id,mission_id,week_key)` preserva a assinatura usada no aplicativo mas foi reforçada com checagem de JWT, semana corrente, tipo de missão, sete dias realmente registrados, valores de recompensa limitados pelo servidor, bloqueio de linha e comprovante único de concessão.

## Verificação e limites

- `npm run build` concluído com sucesso no sandbox.
- `tsc` do novo módulo e da página de missões: **sem erros específicos**. O repositório ainda possui erros TypeScript legados não relacionados.
- Teste transacional de check-in repetido confirmou ausência de segunda recompensa, com rollback. Teste transacional de conclusão semanal realizado sem alterações permanentes. A lógica da concessão semanal usa a tabela de comprovantes para impedir duplicatas.
- Leitura de privilégios confirmou que o papel `anon` não executa as novas RPCs e que `authenticated` não tem INSERT/UPDATE/DELETE nas tabelas de check-ins e recompensas.
- Um teste de usuário real em dois dispositivos ainda deve verificar renovação de semana, estados da página, foco, feedback e recompensas antes de liberar o aplicativo ao público.
- Não foram apagadas as missões, respostas nem o progresso anterior. Os check-ins do novo ritual começam independentes do histórico legados, evitando creditar novamente tarefas antigas sem validação.
- A segurança RLS de outras tabelas antigas, compras no catálogo e rotas legadas não integra esta entrega e ainda precisa de auditoria separada.
