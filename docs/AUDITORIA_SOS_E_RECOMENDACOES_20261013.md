# Auditoria do módulo SOS — 13/10/2026

URL: \`/sos\` · banco oficial Supabase \`weedreset\` (\`wlujqtxnlmyncdvsaumw\`).

## Análise da gravação enviada

- Navegação em celular percorre uma lista grande de cartões com aparência parecida, o que aumenta o esforço de escolha no momento de ansiedade.
- Três entradas rápidas antes do catálogo: respiração 4-7-8, foco e "Áudio de Calma".
- A terceira entrada era um conjunto de botões "*em breve*" sem reprodução. Substituída por uma pausa de calma guiada que **não promete áudio**, funciona sem conexão e não exige inscrição.
- Plano de apoio individual, salvo no Perfil, já aparece na primeira tela do SOS para quem estiver logado.

## Auditoria do banco e segurança

- Catálogo: **250 técnicas**, 27 sinalizadas Premium; **50** sem duração configurada e **74** sem \`steps_json\` estruturado.
- **37** referências de \`audio_url\`; alguns caminhos \`/audio/*.mp3\` não existem no repositório. Sua existência em produção **não foi verificada**; não é seguro afirmar que os arquivos estão disponíveis.
- Antes da correção: tabela \`sos_likes\` sem RLS, permissão para anônimos e sem restrição de curtidas duplicadas.
- Aplicado no \`weedreset\`: RLS em \`sos_likes\`; políticas SELECT/INSERT/DELETE limitadas a \`auth.uid()=user_id\`, sem acesso \`anon\`; índice único \`(user_id,sos_id)\`. Dados existentes preservados.
- Testes SQL dentro de \`BEGIN/ROLLBACK\`: curtida própria, bloqueio de curtida em nome de outra conta, unicidade de curtida, registro de sessão na própria conta e negação de gravação na conta alheia. Sem criar logs nem curtidas permanentes.
- Teste como papel \`anon\`: catálogo e totais agregados continuam públicos; INSERT na tabela privada está negado.
- Registros \`sos_logs\` têm RLS e políticas de escrita/leitura associadas à conta.

## Correções da interface

- Lista do catálogo inicia com 12 opções e usa "Ver mais 12 técnicas"; busca, filtros e ordenação continuam disponíveis.
- Sessão concluída agora depende de recibo retornado pelo Supabase; erro de gravação é informado na tela e pode ser tentado de novo sem refazer o exercício.
- Botão de conclusão é protegido contra toque duplo ou envio repetido enquanto aguarda confirmação.
- Sessões de visitantes ainda podem ser concluídas, com aviso transparente de que o histórico exige login.
- Curtidas desabilitadas enquanto aguardam retorno da nuvem; erros exibidos na tela e estado otimista revertido se falhar.
- Página do histórico SOS preserva corretamente a volta após login via parâmetro \`next\`.
- Compilação Next.js verificada em sandbox com variáveis públicas fictícias; nenhum erro de TypeScript nos arquivos alterados (os erros antigos do projeto não foram alterados).

## Cinco recomendações para evolução futura

1. **Botão "Preciso de ajuda agora"**: fluxo em um toque, que pergunta apenas o que a pessoa mais precisa naquele momento e oferece uma técnica de 30–90 segundos.
2. **Experiência guiada sensorial**: exercícios em tela cheia com progresso visual, controles de pausar/repetir, vibração opcional e áudio verdadeiro **somente depois de auditar arquivos e licenças**; garantir modo silencioso e funcionamento offline dos recursos essenciais.
3. **Plano SOS pessoal**: conectar o plano de gatilhos do Perfil a atalhos contextuais, orientação discreta e a opção de conversar com pessoa de confiança. Nenhum contato é acionado automaticamente.
4. **Feedback antes/depois**: escala opcional de intensidade da vontade e breve reflexão sobre a utilidade; relatórios privados que ajudem a descobrir o que funciona, sem culpa por recaídas e sem apresentar porcentagens de eficácia não verificadas.
5. **Curadoria do catálogo e acessibilidade**: distinguir técnicas essenciais e gratuitas de conteúdo complementar; mostrar 3 sugestões adequadas no início, filtros de "rápidas", "sem áudio" e "minhas favoritas", fontes legíveis e navegação por teclado/leitor de tela.

## Limites de validação

- Testes foram de compilação, lógica e banco. Não foi possível validar o acesso a áudios inexistentes nem fazer um teste com conta real em dois aparelhos diferentes.
- Os atalhos de respiração e foco devem ser avaliados com pessoas usuárias, incluindo conforto e acessibilidade; nenhuma técnica garante suprimir a vontade de consumir.
- O SOS é ferramenta de apoio, não substitui tratamento ou serviços de emergência.
