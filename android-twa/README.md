# WeedReset — empacotamento Android (TWA)

**Status:** ainda não há projeto Android nativo compilado, AAB assinado, chave de upload ou certificado da Google Play neste repositório. A TWA é o caminho recomendado porque o Next.js usa rotas de servidor.

## 1. Pré-requisitos locais

- Computador com Node.js 22+, JDK e Android SDK / Android Studio.
- Conta de desenvolvedor Google Play Console verificada.
- Definição **irreversível na prática** do package ID antes do primeiro lançamento. Proposta: `com.weedreset.app` (**confirmar**, não reservar automaticamente).
- PWA HTTPS publicado e funcional: `https://app-reducao-consumo.vercel.app/`.
- Certificado/chave privada armazenados fora do Git e com backup seguro.

## 2. Gerar projeto TWA com Bubblewrap

Execute em uma pasta local **fora** do repositório ou em `android-twa/build-local/` (que deve ser ignorada pelo Git):

```bash
npm install --global @bubblewrap/cli
bubblewrap init --manifest=https://app-reducao-consumo.vercel.app/manifest.webmanifest
```

O assistente do Bubblewrap solicitará package ID, nome do aplicativo, versões, SDK e chave. Confira o nome `WeedReset`, ícones PNG reais, start URL e domínio. Inspecione o projeto Android gerado: **targetSdkVersion >= 36** para novo app convencional enviado em novembro de 2026. Não assuma que o padrão da versão instalada está atualizado.

```bash
bubblewrap build
```

Verifique o arquivo `.aab` resultante com ferramentas Android antes de enviá-lo. O nome exato do arquivo depende da versão do Bubblewrap. **Nunca adicione `.aab`, `.apk`, `.keystore`, `.jks` ou senhas ao GitHub.** Não gere chave com senha vazia.

## 3. Verificar Digital Asset Links

A rota `/.well-known/assetlinks.json` já existe por rewrite Next.js e responde **404 por segurança** enquanto não houver certificado real. Após registrar o app no Play Console:

1. Em **Play App Signing**, copie o SHA-256 do **certificado de assinatura do app** (diferente do certificado de upload).
2. Configure as variáveis **server-side** no projeto Vercel:
   - `ANDROID_APP_PACKAGE_ID`: package ID exato, ex. `com.weedreset.app` após confirmação.
   - `ANDROID_APP_SIGNING_SHA256`: fingerprint real no formato `AA:BB:...`, 32 bytes. Múltiplos certificados podem ser separados por vírgula, quando necessário.
3. Faça redeploy da Vercel e confira o JSON em `https://app-reducao-consumo.vercel.app/.well-known/assetlinks.json`.
4. Execute `npm run check:playstore` com as variáveis acima e valide a abertura da TWA instalada **pela Google Play** em um Android real.

O certificado de **upload** pode ser útil para testes instalados localmente; para instalações distribuídas pela Play, o SHA-256 **da chave de assinatura da Play** precisa estar presente.

## 4. Publicação

1. Preencha a ficha em `docs/play-store-listing-pt-BR.md` e os formulários Saúde, Data Safety, exclusão de conta, conteúdo e classificação indicativa.
2. Configure um track interno e faça a instalação real pela Google Play.
3. Conclua `docs/qa-android-checklist.md`; registre evidências, sem marcar testes não realizados.
4. Se sua conta pessoal for nova e estiver sujeita à regra, mantenha **12 testadores opt-in por 14 dias consecutivos** em teste fechado e solicite acesso à produção.
5. Só depois faça o rollout de produção e monitore travamentos, avaliações e políticas.

## Limitações e decisões pendentes

- Não é possível criar um AAB **assinado para publicação** apenas a partir do código web sem package ID final, Android SDK, chave e configuração do Play App Signing.
- A aprovação do Google não é garantida; formulários devem refletir o comportamento real, especialmente dados sensíveis de humor/consumo e conteúdo da comunidade.
- A função de exclusão e as regras RLS devem ser testadas com contas descartáveis antes do lançamento.
- Não habilitar assinaturas digitais antes de integrar Google Play Billing e verificar compras no backend.

Fontes:
- [Trusted Web Activities — Android Developers](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)
- [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap)
- [Chaves de assinatura e Digital Asset Links](https://developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs)
- [Target API Google Play](https://support.google.com/googleplay/android-developer/answer/11926878)
