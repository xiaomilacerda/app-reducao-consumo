# Auditoria da persistência do Perfil — WeedReset, 13/10/2026

Projeto: Supabase \`weedreset\` (\`wlujqtxnlmyncdvsaumw\`), rota \`/profile\`.
Objetivo: os dados salvos devem ser recuperáveis ao entrar na **mesma conta** em outro dispositivo.

## Matriz campo → armazenamento oficial → recarregamento

| Campos visíveis | Fonte de verdade gravada | Recuperação |
|---|---|---|
| Nome/apelido | \`profiles.display_name\` e \`user_private_state.data.displayName\` (mesma transação) | \`profiles\` tem prioridade; \`user_private_state\` restaura na inicialização |
| THC (%) e meta principal | \`profiles.thc_potency/main_goal\` e JSON privado \`userData\` | Perfil remoto + estado privado |
| Moeda; frequência (valor/período); gramas por sessão; preço/grama; gasto diário | Campos homônimos em \`profiles\` + snapshot privado \`userData\` (mesma transação) | \`profiles\` + \`restoreJourney\` |
| Última data/hora de uso e início da jornada | \`profiles.last_use\` + JSON privado \`lastUseDateTime/startDate\` | Perfil e estado privado; valores ausentes **não são inventados** |
| Formas de consumo | \`profiles.consumption_methods\` + JSON privado | Perfil remoto + estado privado |
| Fuso horário e idioma | \`profiles.timezone/preferred_language\` + JSON privado | Perfil remoto + estado privado |
| Área de foco, preferência de lembretes, tema claro/escuro | \`user_private_state.data\` | Estado privado no Supabase, não somente localStorage |
| Avatar equipado | \`profiles.equipped_icon\` e \`user_private_state.data.equippedAvatar\` (mesma transação) | Avatar + inventário em \`user_store_items\`, associados à conta |
| Metas, prazo e valor-base | \`profile_growth_settings\` | Consulta remota após autenticação |
| Gatilhos, ações de apoio, pessoa de confiança | \`profile_growth_settings\` | Consultado no Perfil e SOS |
| Sessões, gastos e humor semanais | \`profile_weekly_reviews\` | Recuperado por semana, moeda e usuário |
| Check-ins e missões | \`engagement_daily_checkins\` e \`user_missions\` | Somente leitura neste painel |
| XP e moedas | \`profiles.xp\` e \`user_wallet.coins\` | Somente leitura; Perfil não modifica recompensas |
| Premium | \`profiles.is_premium\` (e \`app_metadata\` confiável quando aplicável) | Somente leitura; nunca de JSON editável |

**Importante:** "receber notificações" é uma **preferência salva**. O salvamento não equivale, sozinho, a envio de notificações no sistema operacional. O seletor de avatar escolhe ícones do inventário; o aplicativo ainda **não implementa upload de foto pessoal**.

## Proteções adicionadas

1. A função \`save_profile_preferences_secure\` atualiza \`profiles\` e \`user_private_state\` **na mesma transação PostgreSQL**; falhas não deixam metade das informações salvas. O cache local é atualizado somente após confirmação do servidor.
2. A função \`equip_profile_avatar_secure\` verifica posse do avatar e atualiza as duas fontes, sem deixar resultado inconsistente entre dispositivos.
3. \`update_profile_growth_goal\` e \`update_profile_growth_support\` fazem atualizações independentes; salvar uma meta não descarta o plano de apoio e vice-versa.
4. Sessão autenticada obrigatória em todas as quatro funções. Execução negada para \`anon\` e dados sempre associados a \`auth.uid()\`. Nenhuma função concede moedas, XP, Premium ou direitos de administração.
5. Se a sincronização privada ou do Perfil falhar, não é possível gravar valores locais por cima dos dados remotos até a consulta ser validada. O novo painel de metas também bloqueia a gravação quando sua leitura falha ou expira.
6. Não é gerada data fictícia de consumo para uma conta nova ao entrar em outro dispositivo.
7. Alertas de sucesso ou falha aparecem **centralizados no campo visual atual**, com fechamento manual e automático; não exigem voltar ao topo ou rodapé.
8. Avisos de campos não salvos antes de atualizar/fechar página; as operações do banco usam valores limitados e validados.

## Testes executados

- Funções SQL testadas sob autenticação em transação \`BEGIN ... ROLLBACK\` para nome, THC, frequência, moeda, preço, métodos, datas, idioma, tema, preferência de lembretes, área de foco, avatar, metas e plano de apoio. Resultado conferido consultando as tabelas da conta dentro da transação.
- Salvamento do plano de apoio seguido da atualização de meta: gatilhos, ações e contato continuaram intactos.
- Registro semanal \`sessions/spent/mood/currency\` testado com INSERT/UPSERT e leitura posterior dentro de transação revertida.
- Avatar inválido rejeitado; equipado padrão A1 gravado tanto em \`profiles\` quanto em estado privado.
- Funções verificadas com \`has_function_privilege\`: usuário autenticado autorizado, \`anon\` negado.
- Build Next.js passou em sandbox com variáveis públicas fictícias, sem erro TS novo nos componentes. Permanecem **66 erros legados** no projeto.

## Limitações a validar após a publicação

- Abrir a mesma conta em **dois aparelhos reais** e conferir atualizações feitas em um deles após recarregar o outro. Este teste não foi possível sem a interação de um usuário autenticado.
- Alterações simultâneas da mesma preferência em dois aparelhos seguem o modelo de "último salvamento prevalece"; metas e plano de apoio agora são independentes.
- Exportação JSON de dados principais tem limites de consulta e não substitui exportação integral de todos os serviços.
- Alternâncias de tema e lembretes permanecem preferências registradas; um serviço de entrega de notificações deve ser implementado separadamente, caso desejado.

Migração: \`supabase/migrations/20261013_profile_atomic_persistence.sql\`.
