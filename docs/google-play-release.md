# WeedReset — preparação Android / Google Play (novembro 2026)

**Estado real:** site Next.js publicado no Vercel; PWA e fluxo de exclusão de conta adicionados. **Ainda não existe um Android App Bundle assinado.** Não publicar antes do checklist final.

## Arquitetura de distribuição

A base utiliza rotas de servidor e middleware Next.js. Portanto **não** pode ser simplesmente exportada estaticamente e copiada para Capacitor sem refazer os fluxos dependentes de servidor. O caminho de menor risco para o primeiro release Android é uma **Trusted Web Activity (TWA)**, via Bubblewrap, que aproveita o site HTTPS verificado e usa o navegador Chrome em tela cheia.

Site canônico da TWA: \`https://app-reducao-consumo.vercel.app/\`
Manifest Web: \`https://app-reducao-consumo.vercel.app/manifest.webmanifest\`
Nome público: \`WeedReset\`
Identificador Android proposto (confirmar antes da criação no Play Console): \`com.weedreset.app\`

## Dependências antes do AAB

1. Exportar a identidade visual existente de \`src/app/icon.svg\` para arquivos PNG 192x192 e 512x512, validar legibilidade e aplicar máscara apropriada. O manifest atual referencia o SVG existente; verificar requisitos efetivos da ferramenta e ajustar para PNG.
2. Criar uma conta no Google Play Console, confirmar nome legal, tipo de conta e dados públicos de contato. Gerar e guardar a chave de assinatura **fora do repositório**.
3. Instalar Android Studio, JDK compatível e Bubblewrap no computador de build.
4. Inicializar \`bubblewrap init --manifest=https://app-reducao-consumo.vercel.app/manifest.webmanifest\`. Revisar o package ID, SDKs, versão e informações solicitadas.
5. Confirmar que \`targetSdkVersion >= 36\` (Android 16; exigido em 2026 para novos apps convencionais). Ajustar o projeto gerado antes de compilar caso não esteja conforme.
6. Obter SHA-256 da assinatura do Play App Signing e/ou chave de instalação, conforme etapa; publicar o JSON de Digital Asset Links **real** em \`/.well-known/assetlinks.json\`. Não publicar placeholders.
7. Construir com \`bubblewrap build\` e verificar o AAB assinado, package ID, assinatura, deep links, Back e comportamento de abertura em tela cheia.
8. Testar a versão interna em vários dispositivos Android reais, com login, tela offline, comunidade, bloqueio, notificação, exclusão de conta e teclados.
9. Preencher **Data Safety**, declaração de Saúde, classificação indicativa, política de conteúdo gerado pelos usuários, URL pública de exclusão, conta de avaliação, screenshots, contato e conteúdo da loja.
10. O Premium permanece **indisponível para compras** até integrar Play Billing e verificar as compras pelo backend. Não apresentar botões fictícios em produção.
11. Se a conta pessoal do desenvolvedor estiver sujeita às regras de teste fechado do Google, concluir o período e número de testadores aplicáveis antes de solicitar produção.
12. TypeScript estrito agora é verificado no CI e na compilação (após correção dos erros anteriores). O lint ainda está temporariamente ignorado no build; migrar configuração ESLint e adicionar testes de integração e ponta a ponta antes da classificação final de pronto para produção.

## Exclusão de conta

Página pública: \`https://app-reducao-consumo.vercel.app/excluir-conta\`.
Função no Supabase: \`weedreset-delete-account\` (Edge; JWT obrigatório).
Procedure de banco: \`weedreset_purge_account_data\` (somente service_role).
**Validação obrigatória:** testar exclusivamente com uma conta de testes descartável criada para isso, verificando também ausência de registros órfãos.

## Segurança da comunidade

Denunciar conteúdo e bloquear autores já foram implementados; verificar com duas contas de testes, incluindo após relogin. Os identificadores internos de autor ainda devem passar por revisão adicional de minimização de dados antes de prometer anonimato forte.

## Documentação oficial

- https://developer.android.com/google/play/requirements/target-sdk
- https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli
- https://support.google.com/googleplay/android-developer/answer/18265346
- https://developer.android.com/health-and-fitness/health-connect/publish

## Recuperação de senha (validação obrigatória)

- Páginas públicas `/recuperar-senha` e `/redefinir-senha` usam Supabase Auth (`resetPasswordForEmail` e `updateUser`).
- No Supabase Auth → URL Configuration, permitir explicitamente `https://app-reducao-consumo.vercel.app/redefinir-senha` na lista de Redirect URLs. Configurar também o Site URL canônico.
- Validar o fluxo completo com e-mail real de teste, link expirado, sessão ausente e login após redefinição. O build por si só não verifica a entrega de e-mails.

## Comunidade gratuita e segurança contra spam

- Publicações e respostas ficam disponíveis a usuários autenticados, sem Premium, mantendo políticas RLS de proprietário e moderação.
- Uma pessoa pode publicar uma vez a cada 24 horas e deve aguardar 30 segundos entre respostas; as duas regras são validadas em trigger no servidor, evitando simples manipulação do frontend.
- Verificar com duas contas de teste: postagem, resposta, denúncia, bloqueio, tentativa de spam, conta com moderação suspensa e acesso a registros de terceiros.

## Digital Asset Links configurável sem certificado falso

- A rota `/.well-known/assetlinks.json` retorna 404 até a Vercel receber **ANDROID_APP_PACKAGE_ID** e **ANDROID_APP_SIGNING_SHA256** (fingerprint SHA-256 de certificado real da Play App Signing).
- Permite múltiplos fingerprints separados por vírgula, somente quando formatados como 32 pares hexadecimais com dois-pontos.
- Após configurar esses dados, republicar o projeto, validar o JSON via HTTPS e testar a TWA instalada.
- Nenhum AAB, chave privada ou assinatura fictícia foi criado no repositório. Essas etapas dependem da identidade definitiva do app e da conta no Play Console.
