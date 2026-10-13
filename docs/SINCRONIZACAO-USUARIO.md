# Sincronização dos dados pessoais do WeedReset

## Banco de produção

Supabase project `symdsbdwsuoshdthtphn`.

Em 2026-10-13 foi aplicada a migração `user_private_state_secure_sync` que criou:
- `public.user_private_state` com PK/FK `user_id`, `data jsonb`, `updated_at`.
- RLS ativo para usuários autenticados, com políticas próprias de SELECT/INSERT/UPDATE (`auth.uid() = user_id`).
- Função `public.merge_user_private_state(jsonb)`, SECURITY INVOKER, sem acesso de `anon`, executa merge JSONB atômico com propriedade de usuário determinada pela sessão.

**Testes realizados:** transação autenticada com função RPC e ROLLBACK; transação de isolamento cruzado mostrou zero registros de outro usuário visíveis; nenhuma informação real de usuário foi mantida/modificada por esses testes.

## Campos conectados

| Categoria | Fonte autoritativa | Comportamento |
| --- | --- | --- |
| Nome exibido | `profiles.display_name` e cópia privada | Recuperado no login/perfil/configurações |
| Avatar selecionado | `profiles.equipped_icon`, `user_store_items` e cópia privada | Persistido imediatamente ao equipar |
| Início e última vez de consumo | `user_private_state.data.userData`; `profiles.last_use` legado | Data e horário em ISO UTC, entrada com 12h como padrão aproximado |
| Contador e recaídas | `userData.startDate`, `lastRelapseDate`, `relapseHistory` no registro privado | Recalculado a partir da data, não de `daysClean` cacheado |
| Custos/consumo | `data.userData` com `dailyCost`, `thcPotency`, `frequency*`, `gramsPerJoint`, `pricePerGram`, `consumptionMethods` | Sincronização ao concluir onboarding e salvar Perfil |
| Configurações e preferências | `data.preferredFocusArea`, `motivationalLevel`, `darkMode`, `notificationsEnabled`, `notificationsTime`, `timezone`, `preferredLanguage` e tabelas já existentes | Sincronização ao salvar Configurações |
| Plano e XP | `profiles.is_premium`, `profiles.xp` | Nunca confiados em JSONB editável |
| Carteira | `user_wallet` | Não editada por sincronização de preferências |

O registro privado **não** guarda credenciais, tokens, valores de moedas ou permissões Premium/Admin. As informações são restauradas ao entrar e ao abrir Home, Perfil ou Configurações. Dados locais antigos são importados caso a conta ainda não tenha registro de progresso na nuvem.

Se o Supabase falhar ao salvar, Perfil/Configurações não apresentam mensagem de sucesso; mantêm o formulário preenchido para repetir a operação.

## Limitações que precisam de validação

- **Não há garantia absoluta** de que todos os fluxos do app usem essa tabela. Missões, humor, SOS, evolução corporal, comunidade e outros módulos têm tabelas próprias e/ou dados temporários no localStorage; exigem testes específicos.
- Visitantes **sem conta autenticada** continuam com dados locais, pois não há usuário no Supabase associado.
- A sincronização não tem suporte offline com fila durável; antes de fechar a página, aguarde a confirmação do salvamento.
- O banco existente `profiles` tem políticas RLS excessivamente permissivas. A nova tabela privada foi projetada com RLS estrito, mas a auditoria global de segurança continua necessária.
- Dados sensíveis preexistentes nunca enviados à nuvem por versões antigas não podem ser recuperados automaticamente de outro aparelho; é preciso entrar no dispositivo original e salvar o Perfil.
- Operações simultâneas no mesmo campo em aparelhos diferentes usam o último valor confirmado pelo banco.
- Acompanha o progresso com testes de uma conta de teste: editar data/hora, trocar avatar, configurar preferências, sair/entrar em dois navegadores e conferir recarga.

## Procedimento de smoke test recomendado

1. Na sessão A, autenticar, ajustar data e hora do último uso (ou usar 12h), salvar Perfil e aguardar sucesso.
2. Trocar avatar e confirmar a alteração.
3. Salvar idioma, foco e notificações em Configurações.
4. Entrar em sessão B isolada com a mesma conta e conferir os valores em Perfil, Configurações e contador da Home.
5. Registrar uma recaída de teste **somente em uma conta de teste**, e verificar o contador ao acessar outro navegador.
6. Forçar falha de rede em ambiente de teste: confirmar que Perfil não anuncia salvamento concluído.
