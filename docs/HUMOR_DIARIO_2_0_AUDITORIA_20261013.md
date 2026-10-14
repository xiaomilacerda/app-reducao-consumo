# WeedReset · Diário de Emoções 2.0 — 13/10/2026

**Projeto oficial:** Supabase `weedreset` (ref `wlujqtxnlmyncdvsaumw`). Rotas: `/mood` e `/mood/history`.

## As cinco melhorias implementadas

1. **Barra acumulada real:** percentuais e segmentos são calculados exclusivamente a partir das quantidades de check-ins do período selecionado (Hoje, 7, 30 ou 365 dias). Grupos: momentos positivos, neutros/tranquilos, preocupação/ansiedade, momentos difíceis e outros. A função de arredondamento pelo maior resto faz os percentuais apresentados somarem exatamente 100% quando há registros. Não inventa uma pontuação emocional em %.
2. **Vários registros no mesmo dia:** eliminada apenas a restrição antiga `UNIQUE(user_id,date)`, preservando linhas existentes. Cada registro tem seu ID UUID, horário, data, sentimento, reflexão opcional e até três fatores contextuais. A antiga coluna `mood_value` continua gravada exclusivamente para compatibilidade com módulos antigos, não como risco clínico.
3. **Análises honestas:** estatísticas de quantidade de registros, dias acompanhados e sentimento mais frequente sincronizadas com o mesmo filtro temporal. Linha do tempo com contagens por dia, hora ou mês e agrupamentos de humor; não preenche dias ausentes como se fossem emoções negativas. Removida a antiga porcentagem de "risco emocional" sem base clínica.
4. **Acolhimento após cada registro:** confirmação do salvamento na nuvem, mensagem contextual, acesso opcional ao SOS em momentos difíceis e fatores que a pessoa reconhece como influências. Nenhuma recompensa condicionada a registrar felicidade; nenhuma promessa de diagnóstico ou eficácia terapêutica.
5. **Interface mobile simples e segura:** escolha rápida de 8 emoções, outras 6 recolhíveis, etiquetas de contexto opcionais, nota limitada a 500 caracteres, confirmação visível no centro, erros de nuvem explícitos, histórico recolhível na página principal e acesso ao histórico completo. Não solicita permissão do navegador para notificações automaticamente ao salvar.

## Histórico e privacidade

- Histórico por dia com **todos os check-ins**; busca por texto e filtros por data.
- Gratuitos e Premium podem corrigir emoção e texto, e excluir registros privados.
- Editar/excluir verifica `user_id`, utiliza RLS e só atualiza a interface após confirmação do Supabase.
- Datas são comparadas como `YYYY-MM-DD`, evitando mudanças de dia causadas pela conversão UTC.
- Carregamento paginado em lotes de 500 evita truncamento silencioso por limite padrão de 1000 linhas.
- Entrada visual vazia é diferente de falha de sincronização; falhas exibem aviso.

## Migrações versionadas

- `supabase/migrations/20261013_mood_multi_checkin_and_context.sql` remove exclusividade por usuário/data, adiciona índice de busca e tags opcionais.
- `supabase/migrations/20261013_mood_reference_auth_account.sql` associa os check-ins à conta de `auth.users`, permitindo registrar antes da criação da linha opcional do Perfil.

Ambas as migrações foram aplicadas ao `weedreset`. Os **30 registros existentes** foram preservados.

## Testes executados

- SQL em transação `BEGIN/ROLLBACK` criou **dois check-ins distintos na mesma data**, confirmou leitura de ambos, editou anotação, excluiu o registro próprio e rejeitou gravação em nome de outra conta. Nenhum dado temporário permaneceu.
- Nenhum órfão na relação com `auth.users` encontrado antes da troca de chave estrangeira.
- Arredondamento dos segmentos testado com contagens variadas; percentuais sempre somam 100% quando há dados.
- `npm run build` Next.js aprovado em sandbox com variáveis públicas fictícias apenas para compilação.
- Zero novos erros TypeScript nas páginas de Humor; o repositório ainda possui **66 erros legados** em módulos não relacionados.

## Limites e cuidados

- A classificação em grupos é uma escolha para visualização, não diagnóstico ou medida de saúde mental. O valor numérico legado é armazenado somente para compatibilidade.
- Se a página já estiver carregada, os gráficos refletem todos os registros retornados do ano consultado; o histórico completo busca lotes adicionais.
- O aplicativo não transforma uma preferência de notificação em lembretes automáticos; entrega push real depende de implementação específica.
- Após publicar, testar em um celular autenticado, depois em outro aparelho com a mesma conta: dois sentimentos no mesmo dia, histórico, alteração de humor e anotação, exclusão, filtros, barra somando 100%, acesso ao SOS e estado sem rede.
