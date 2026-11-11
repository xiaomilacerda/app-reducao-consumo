# WeedReset — ficha da Google Play (rascunho para revisão)

> **Não publicar automaticamente.** Validar a identidade do responsável, e-mail de suporte, capturas de tela reais, categoria, Data Safety e classificação indicativa no Play Console. O aplicativo destina-se a maiores de 18 anos.

## Nome do aplicativo

WeedReset

<!-- SHORT_DESCRIPTION_START -->
Apoio para reduzir ou parar o uso de cannabis, com diário, metas e SOS.
<!-- SHORT_DESCRIPTION_END -->

<!-- FULL_DESCRIPTION_START -->
O WeedReset é um aplicativo de apoio para pessoas com 18 anos ou mais que desejam reduzir ou interromper o consumo de cannabis, no próprio ritmo.

Acompanhe sua jornada com recursos de autocuidado:
• Registre seus objetivos e acompanhe o tempo desde o último uso.
• Anote seu humor e reflita sobre hábitos e situações do dia a dia.
• Consulte estimativas de economia com base nas informações que você fornecer.
• Acesse ferramentas de apoio e exercícios de atenção nos momentos difíceis.
• Compartilhe experiências na comunidade, com opções de denúncia e bloqueio.

O WeedReset não vende cannabis, não facilita compra ou entrega de substâncias e não incentiva o consumo. As novas assinaturas Premium não estão disponíveis nesta versão.

Importante: o WeedReset é uma ferramenta de informação e apoio, não é um dispositivo médico e não diagnostica, trata, cura ou previne qualquer condição de saúde. Não substitui avaliação ou acompanhamento profissional. Para aconselhamento médico, diagnóstico ou tratamento, consulte um profissional de saúde. Em uma emergência, procure os serviços locais de urgência.

Política de Privacidade: https://app-reducao-consumo.vercel.app/privacy
Solicitar exclusão de conta: https://app-reducao-consumo.vercel.app/excluir-conta
<!-- FULL_DESCRIPTION_END -->

## Texto para revisores da Google Play

- Idioma principal: português (Brasil).
- Público pretendido: pessoas com 18 anos ou mais.
- Propósito: acompanhamento voluntário e apoio à redução/interrupção do consumo de cannabis; **sem** venda, promoção ou intermediação de substâncias.
- O aplicativo oferece registro de humor, progresso, exercícios SOS e comunidade com denúncias/bloqueios.
- Há dados potencialmente sensíveis de hábitos, humor e consumo; a política de privacidade e o formulário Data Safety precisam refletir o tratamento real.
- Não há oferta de novas assinaturas nesta versão. Caso o Play Console peça uma conta de acesso, criar **conta de teste descartável**, com dados fictícios, e fornecer credenciais somente pelo campo seguro do Console (nunca pelo GitHub).

## Materiais gráficos obrigatórios / a confirmar

- Ícone da ficha da loja em PNG de 512 × 512 px, sem usar diretamente SVG.
- Imagem de destaque (*feature graphic*) de 1024 × 500 px.
- Capturas de tela reais em aparelho Android da versão que será enviada; sem informações pessoais verdadeiras.
- Capturas sugeridas: painel, diário, SOS, comunidade, configurações/exclusão de conta.
- E-mail público de suporte funcional, nome do desenvolvedor, site e dados exigidos pelo Console.

## Data Safety — inventário a confirmar no app e nas integrações

**Não marque automaticamente nenhuma resposta do formulário.** Audite fluxos reais e retenção antes de declarar:

| Categoria potencial | Evidência / origem | Perguntas a verificar |
| --- | --- | --- |
| Identificadores e contato | Supabase Auth, cadastro e perfil | E-mail, nome, ID de usuário; finalidade de autenticação |
| Dados sensíveis sobre saúde/bem-estar | Diário emocional, hábitos e consumo | Coleta, caráter opcional, retenção, visibilidade e exclusão |
| Conteúdo do usuário | Publicações, comentários, denúncias | Compartilhamento entre participantes e moderação |
| Dados técnicos e analytics | Hospedagem Vercel, Supabase e telemetria habilitada | IP, eventos, diagnósticos, fornecedores e finalidades |
| Preferências | Configurações e armazenamento local | Notificações, idioma, fuso horário |
| Dados de pagamento | Nenhuma compra nova nesta versão | Revisar somente se Play Billing for implementado |

Verificar se dados são transmitidos com TLS, se há criptografia em repouso no fornecedor, se exclusão é efetiva e quais backups seguem retidos. A declaração da loja deve ser consistente com a política pública e com o comportamento real do aplicativo.

## Políticas e formulários

- [Política de Saúde e serviços](https://support.google.com/googleplay/android-developer/answer/16679511)
- [Política de dados do usuário](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Requisitos de nível de API](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Política de conteúdo gerado por usuários](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Testes de contas pessoais novas](https://support.google.com/googleplay/android-developer/answer/14151465)

**A classificação etária final é a do questionário oficial**, não uma faixa etária presumida a partir do tema. Declarar referências a drogas com exatidão.
