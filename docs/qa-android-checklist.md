# WeedReset — plano de testes antes do envio à Play Store

Status inicial em 11/11/2026: **NÃO EXECUTADO**. Para monetização, consultar também `docs/google-play-monetization.md`. Marcar cada item apenas após evidência em dispositivo/conta de testes.

## 1. Identidade Android e TWA

- [ ] Package ID definitivo confirmado e igual ao Play Console e à configuração Android.
- [ ] AAB assinado e inspecionado: versionCode, versionName, minSdk, **targetSdk 36 ou superior**, package ID.
- [ ] Fingerprint SHA-256 da **chave de assinatura do app da Google Play** publicado no Digital Asset Links; considerar a chave de upload separadamente para testes locais.
- [ ] `https://app-reducao-consumo.vercel.app/.well-known/assetlinks.json` responde HTTP 200 com JSON válido, sem redirecionamento inesperado.
- [ ] TWA abre sem barra de URL em Android real; se aparecer a barra, verificar o certificado e a associação do domínio.
- [ ] Abertura inicial, retorno ao app, botão Voltar, rotação/teclado, links externos e deep links.
- [ ] AAB enviado ao track de teste interno, instalado pela Google Play, sem travamento.

## 2. Autenticação e dados (usar contas descartáveis A e B)

- [ ] Cadastro maior de 18 anos, aceitação de Termos e Privacidade, confirmação de e-mail.
- [ ] Login, logout, expiração de sessão e retorno após reinstalação.
- [ ] Recuperação de senha: e-mail real, link válido, expirado e reutilizado; redirect allowlist do Supabase.
- [ ] A não acessa dados privados de B: perfil, humor, jornada, missões, recompensas e registros SOS.
- [ ] A não executa RPC privilegiada passando o UUID de B.
- [ ] Publicar, comentar, denunciar, bloquear e desbloquear na comunidade; persistência após novo login.
- [ ] Limites anti-spam e suspensão/moderação são aplicados **no servidor**, não apenas na interface.
- [ ] Nenhum conteúdo sensível privado aparece em páginas públicas ou no cache do service worker.
- [ ] Exclusão com A: confirmações, Edge Function, Auth, dados associados, comunidade e backups conforme política; B permanece intacta.
- [ ] Após exclusão, token/sessão anterior não permite operações sensíveis; não há dados pessoais residuais acessíveis.
- [ ] O suporte de exclusão por e-mail funciona para usuários sem acesso à conta.

## 3. Uso e acessibilidade

- [ ] Tela inicial, onboarding, diário, metas, economia, SOS, comunidade, configurações e termos em Android real.
- [ ] Modo offline exibe aviso sem revelar dados de outra sessão; retorno online sincroniza corretamente.
- [ ] Fonte ampliada, leitor de tela, foco de teclado, contraste e alvos de toque adequados.
- [ ] Mensagens de saúde não prometem cura, diagnóstico, prevenção ou números clínicos comprovados.
- [ ] No pré-lançamento, compras desativadas; antes da versão paga, testar compra única, restauração, conta diferente e bloqueio de compra por site dentro da TWA.
- [ ] Não há links de venda, entrega ou facilitação de cannabis.
- [ ] E-mail de suporte, URLs legais, formulário Data Safety e classificação etária verificados.

## 4. Console e lançamento

- [ ] Perfil do desenvolvedor verificado e identidade pública conferida.
- [ ] Política de privacidade pública, link de exclusão e declarações de Saúde e Data Safety preenchidos.
- [ ] Ícone, feature graphic, screenshots reais e textos de ficha aprovados.
- [ ] Conta de avaliação configurada com dados fictícios quando necessária.
- [ ] Se aplicável: 12 testadores opt-in durante 14 dias consecutivos em teste fechado, conforme o Console.
- [ ] Revisar erros, ANRs, Android vitals e alertas de políticas.
- [ ] Aprovação manual de release somente após todas as verificações P0.

## Registro de execução

| Data | Dispositivo / Android | Versão do AAB | Testador | Resultado | Evidência / issue |
| --- | --- | --- | --- | --- | --- |
| A preencher | A preencher | A preencher | A preencher | Não executado | A preencher |
