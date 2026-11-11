# WeedReset — monetização por compra única (11/11/2026)

## Decisão comercial

- Download gratuito e **7 dias para experimentar os recursos avançados** quando a cobrança for ativada.
- Depois: **uma compra não consumível** para desbloquear recursos avançados nesta conta, sem renovação automática.
- Produto único no Google Play Console: `weedreset_full_access`. Preço sugerido inicial: **R$ 24,90**, configurado na Console e exibido pelo catálogo do Google Play, não pelo código.
- Recursos básicos, informações legais, conta e **SOS** permanecem acessíveis depois do teste. Não bloquear recursos essenciais de ajuda.
- **Não vender digital dentro da TWA por checkout próprio/site**. Fora da Play, o mesmo login reconhece acesso já adquirido. Um eventual checkout independente no navegador requer análise separada de políticas/tributação, identificação do canal e conciliação de reembolsos.

Fontes oficiais:
- [Chrome: Google Play Billing em Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
- [Google: política de pagamentos](https://support.google.com/googleplay/android-developer/answer/10281818)
- [Google: Purchase REST API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products)
- [Chrome: atualização para Play Billing Library 8](https://github.com/GoogleChrome/android-browser-helper/blob/main/playbilling/docs/play-billing-library-8-migration.md)

## O que foi implementado neste PR

- `/premium`: apresentação clara de compra única, estado do teste, valor localizado vindo de `getDetails()`, compra via Payment Request, botão Restaurar compra e mensagens de erro.
- `/api/access/status`: consulta de estado pela **sessão validada no servidor**. O status não é aceito de storage ou metadata editáveis do navegador.
- `/api/play/verify`: exige login e produto fixo; consulta o Android Publisher, valida se está comprado, recusa cancelado/pendente/consumido, reconhece pagamento na Google Play e só então grava acesso no banco com RPC transacional.
- Migração `20261111_weedreset_play_one_time_entitlements.sql`: tabela de tokens **com hash SHA-256**, unicidade contra compartilhamento entre contas, RLS de leitura do próprio acesso, escrita **somente pelo servidor** e RPC de revogação para reembolsos verificados.
- Middleware: protege apenas **analytics, AI insights, evolução corporal, jornada, missões, recompensas e experimento** após fim dos sete dias. Comunidade e SOS permanecem disponíveis; outros recursos básicos são mantidos. A proteção é uma *etapa de UX* e não substitui a revisão de cada RPC, RLS e leitura dos dados.
- Textos dos planos e página legado de ativação Premium removidos; status visível nas configurações/perfil.
- A nova cobrança está **desligada por padrão**: o site atual não vende nada nem fecha acesso de usuários ao receber este commit.

## Configuração necessária (fora do GitHub)

1. **Executar a migração SQL**, após backup e revisão, no banco correto do Supabase. Verificar `weedreset_entitlements`, `weedreset_play_purchases`, políticas RLS e função `weedreset_record_google_play_purchase`. Não executar em produção sem testes de restauração.
2. Criar produto **não consumível** `weedreset_full_access` no Play Console e ativá-lo; definir **R$ 24,90** ou o preço escolhido na loja. A loja é a fonte de verdade sobre moeda e preço.
3. Finalizar o identificador Android (a proposta `com.weedreset.app` **não é confirmação**), criar a TWA com Bubblewrap e `"features":{"playBilling":{"enabled":true}}` em `twa-manifest.json`. Usar Bubblewrap >= **1.25.0** ou biblioteca `com.google.androidbrowserhelper:billing:1.2.0` (Play Billing Library 8.3.0) e conferir SDK 36.
4. Gerar o AAB assinado, liberar pelo menos uma faixa de testes internos/fechados, validar Digital Asset Links e habilitar perfil de pagamento/merchant na Play Console.
5. Habilitar **Google Play Android Developer API** em projeto Google Cloud autorizado na Play Console, criar conta de serviço e conceder permissões mínimas de compra. **Nunca** colocar JSON/chave de serviço ou chave do Supabase no repositório, tela ou variável `NEXT_PUBLIC_*`.
6. Configurar na Vercel (apenas **server-side**, criptografadas):
   - `GOOGLE_PLAY_PACKAGE_NAME`: identificador final instalado.
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço (chave privada).
   - `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`): chave server-side do Supabase com permissão para gravar as tabelas e RPC.
   - `WEEDRESET_ACCESS_LAUNCH_DATE`: ISO UTC, ex. `2027-01-01T12:00:00Z`, **data de ativação escolhida**, não data definida aqui. Usuários antigos têm 7 dias a partir dessa data.
7. Configurar o tópico e assinatura **Google Cloud Pub/Sub push autenticada** para `https://SEU_DOMINIO/api/play/rtdn` e, na Vercel (servidor), `GOOGLE_PUBSUB_AUDIENCE` com a audiência OIDC exata da assinatura e `GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL` com o e-mail exato da conta de serviço configurada para gerar o token push. Habilitar RTDN na Play Console para este tópico; testar envio de notificação de teste e um estorno de compra de laboratório. A rota não confia em URL secreta nem em e-mail sem assinatura.
8. **Somente depois da migração e dos testes** colocar `WEEDRESET_PAID_ACCESS_ENABLED=true` na Vercel. Esse interruptor exige as outras configurações para não bloquear usuários acidentalmente. Deploy e validar o status com contas de teste.

### Sem estas configurações

O status é `preview` (acesso de pré-lançamento), o checkout não é exibido e as rotas novas não são bloqueadas. Nenhuma compra real é iniciada. Não se deve afirmar que o faturamento está ativo antes dos testes numa instalação pela Play Store.

## Checklist de validação antes de cobrar dinheiro de verdade

- [ ] Compilação, TypeScript, lint, testes e QA da TWA aprovados.
- [ ] Play Store instalado no Android com `getDigitalGoodsService` e `getDetails` funcionando (teste no navegador não substitui isso).
- [ ] Dois usuários Supabase e duas contas de teste Google Play; comprar, restaurar, efetuar logout, trocar celular, recusar token da outra conta.
- [ ] Compra pendente, falha de rede, confirmação (acknowledgment), operação repetida idempotente; sem conceder acesso quando o status Google não for `purchaseState=0`.
- [ ] Trial de 7 dias para conta nova e antiga; após expirar, SOS e dados básicos intactos; dados salvos permanecem.
- [ ] Validar que uma conta sem acesso não pode ler/escrever **recursos pagos via chamadas diretas a API, RLS ou RPC**; o middleware sozinho não protege endpoints Supabase.
- [ ] Conectar **Real-time Developer Notifications (RTDN)** autenticadas / reconciliação dos reembolsos e testar cancelamentos. A função SQL `weedreset_revoke_google_play_purchase` está preparada, mas **não há consumidor RTDN implementado**. **Bloqueador de lançamento pago**, não basta gravar o token hash: falta a integração de revogação.
- [ ] Revisar a descrição do produto, Termos, Privacidade, processo de reembolso e classificação da Google Play, especialmente para dados sensíveis de consumo.
- [ ] Revisar a exclusão de conta (com exclusão de `weedreset_play_purchases` por CASCADE). Reembolso não deve apagar indevidamente o diário do usuário.

## Política de rollback

Se houver problema durante teste, desligue `WEEDRESET_PAID_ACCESS_ENABLED`; o app volta ao modo pré-lançamento e não tenta cobrar, sem apagar compras ou contas. Nunca altere `profiles.is_premium` via navegador ou código cliente. Não remova registros de transações para mascarar erros.

## Limitações conhecidas

1. Não foi feito **build Android**, compra real, teste com Google Play Console ou migração de produção nesta etapa.
2. Compra validada depende de permissões reais na Google Cloud/Play Console e de conta com sessão Supabase.
3. O handler RTDN já está codificado, mas faltam configurar Pub/Sub, validar em ambiente real, criar rotina de reconciliação de eventos perdidos e revisar RLS de cada recurso pago antes de cobrar usuários.
4. O preço sugerido no site **não garante** o preço de outro país; mostrar o preço retornado pela Google Play quando disponível.
