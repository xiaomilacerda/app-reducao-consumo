# WeedReset — Diário de Emoções (13/10/2026)

## Objetivo
Corrigir gráfico de humor e implementar cinco melhorias: distribuição proporcional, vários registros no mesmo dia, análises confiáveis, experiência de apoio e edição/privacidade no histórico.

### Melhorias de produto

1. **Distribuição acumulada:** a barra de emoções mostra a participação de cada categoria no total real de check-ins do período. Usa a contagem de registros, e não uma média arbitrária de `mood_value`. A divisão em inteiros usa o método do maior resto, portanto os percentuais apresentados somam exatamente 100%.
2. **Vários check-ins por dia:** cada novo humor gera um `INSERT` individual, com data, hora, nota e campos opcionais de influência/ajuda. O banco não exige mais `UNIQUE(user_id,date)`; todos os 30 registros antigos foram preservados.
3. **Análises responsáveis:** Hoje, 7 dias, 30 dias e 12 meses filtram distribuição, contagens, gráficos e lista de registros. O gráfico exibe quantidade de emoções por faixa e período (não "risco emocional" clínico). Padrões de influências e estratégias são mostrados somente a partir do que o próprio usuário registrou e não são apresentados como causalidade.
4. **Acolhimento:** cinco emoções frequentes no acesso rápido; outras nove em seção expandida. Reflexão, gatilho e ação de cuidado são opcionais. Após salvar, confirmação visível e texto de apoio contextual; SOS é sugerido opcionalmente em momentos difíceis. Não há incentivo por registrar emoções "positivas".
5. **Experiência, dados e histórico:** layout adaptado para celular; salvamento com recibo do Supabase e proteção de duplo toque; falha de consulta explicitada, sem mostrar zero enganoso. Histórico agrupado por dia, com todos os momentos preservados, busca inclusive por influências e estratégias, edição e exclusão de cada registro **sem bloquear o controle de dados pessoais por Premium**. Permissão de notificações não é solicitada ao salvar.

### Migração
Arquivo `supabase/migrations/20261013_mood_multiple_checkins_reflections.sql` aplicado ao Supabase oficial **weedreset**, projeto `wlujqtxnlmyncdvsaumw`. Removeu a restrição única por dia e índice único adicional, criou índice por usuário/data/hora e adicionou `trigger_note` e `helpful_action` (máximo 160 caracteres cada). Não fez exclusão nem transformação dos registros existentes. Mantém políticas RLS por `auth.uid()=user_id`, revoga acesso `anon` e concede operações de usuário autenticado.

### Testes executados
- Banco antes e depois: **30 registros, 30 combinações pessoa/data**, nenhuma informação anterior removida.
- Índices: apenas PK continua única; ambas as restrições antigas `user_id,date` foram removidas.
- SQL em transação com `ROLLBACK`: dois registros no mesmo dia foram aceitos e revertidos sem gerar registros permanentes.
- Permissões SQL: `anon` não tem INSERT, `authenticated` tem SELECT/INSERT/UPDATE/DELETE sob RLS.
- `npm run build` Next.js passou no sandbox Vercel usando URL/chave públicas fictícias **somente para compilação**.
- `npx tsc --noEmit` não relatou erros em `src/app/mood/`; erros legados de outros arquivos permanecem.

### Limitações e verificações pós-publicação
- Teste visual e de interação em Android autenticado, trocando períodos, salvando dois humores, corrigindo um e apagando apenas um; verificar recarga em outro aparelho.
- O app depende de conexão para gravar e consultar os dados; não há promessa de sync offline.
- `mood_value` continua gravado como campo legado de compatibilidade. **Nenhuma porcentagem de saúde ou risco** é calculada a partir desse número.
- Nenhum padrão do diário constitui diagnóstico de depressão, ansiedade ou outros transtornos.
- Histórico muito volumoso possui limite visual de 5.000 linhas por carregamento; a página comunica essa limitação explicitamente.
