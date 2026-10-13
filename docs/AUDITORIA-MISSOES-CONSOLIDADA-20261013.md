# Missões & Recompensas — auditoria consolidada (13/10/2026)

Banco oficial de produção: `weedreset`, Supabase `wlujqtxnlmyncdvsaumw`.

## O que foi corrigido

- **Missão diária correta:** catálogo consultado por tipos em consultas separadas (366 registros de missões diárias, 55 semanais e 75 Premium), evitando o limite de 1.000 registros da consulta genérica. Agora o dia 286 não cai indevidamente na missão do dia 1.
- **Catálogo completo:** os dias 16–30 foram cadastrados, totalizando 365 índices de dias válidos; títulos incompatíveis com as tarefas identificados no catálogo foram corrigidos. Preservamos o histórico existente.
- **Uma ação principal de check-in:** o Ritual de Hoje alimenta a jornada de sete conquistas. A grade semanal paralela foi removida da UI; os registros legados e missões antigas continuam no banco.
- **Meta possível para todos:** sete check-ins distintos acumulados, em qualquer ritmo, inclusive começando durante a semana. A jornada não zera toda segunda-feira. Cada sete check-ins confirmados geram +35 XP e +20 moedas.
- **Recompensas seguras:** a função `engagement_record_checkin` valida usuário, humor, atividade, dia conforme timezone e concorrência. A tabela `engagement_cycle_awards` possui PK `(user_id,cycle_number)` para impedir duplicidade.
- **Missão diária/Premium concluída com consistência:** a função `claim_mission_secure` insere um comprovante único de conclusão para cada tipo/dia, registra a resposta em `user_missions.progress`, credita XP e moedas e registra log **na mesma transação**. O cliente não altera saldos.
- **Legado endurecido:** `complete_mission(p_user,p_mission_id)` passa a validar `auth.uid()` e delegar à nova função. O antigo fallback de crédito no browser foi retirado da página `/missions`.
- **Permissões:** tabelas de comprovantes e check-ins com RLS, leitura do próprio usuário, sem INSERT/UPDATE direto via `authenticated`. Funções de escrita somente para usuários autenticados.
- **Histórico:** os títulos das missões diárias continuam acessíveis na página; reflexões do Ritual 365 não são misturadas indevidamente com o diário das missões simples.
- **Visitantes:** ao tentar completar uma missão sem conta, a pessoa recebe o convite para login em vez de um botão silencioso.

## Testes realizados

- `npm run build` finalizou com sucesso com variáveis públicas fictícias no sandbox da Vercel.
- `tsc` não apresentou erros nos dois arquivos alterados; há 66 erros anteriores em outros arquivos.
- Teste transacional de sete check-ins (incluindo dias de semanas distintas): verificou bônus no sétimo e nenhuma concessão ao repetir, com `ROLLBACK`.
- Teste transacional de missão: verificou resposta persistida em `user_missions.progress`, XP creditado somente uma vez e repetição bloqueada, com `ROLLBACK`.
- Auditoria de permissões confirmou `anon` sem acesso às RPCs e às tabelas privadas e nenhuma permissão de escrita direta em `engagement_daily_checkins`, `engagement_cycle_awards` e `engagement_mission_claims`.
- Catálogo validado com 365 índices de dias distintos e 0 títulos incoerentes segundo os padrões verificados.

## Pendências e alertas

- Teste real autenticado em dois navegadores/dispositivos e renderização mobile ainda necessário antes de declarar 100% de cobertura.
- A regra de premiação Premium ainda depende de `profiles.is_premium`; as políticas RLS antigas de `profiles` precisam ser endurecidas em auditoria própria. Não modificar indiscriminadamente sem testar os outros módulos.
- O catálogo antigo continha uma duplicata para o dia 1. Foi preservada por segurança histórica; a escolha no front é determinística, pelo menor ID.
- A camada antiga `complete_weekly_mission` ainda existe para compatibilidade e dados legados; a nova tela usa apenas o bônus dos ciclos. Nunca reativar o antigo fluxo paralelo sem revisão.
- Os 66 erros de tipagem fora da página Missões permanecem e o Next.js segue ignorando a checagem de tipos no build.
- Compras com moedas em outras telas e permissões das tabelas antigas não foram alteradas por esta entrega.
