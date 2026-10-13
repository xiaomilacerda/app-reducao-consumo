# WeedReset — revisão de Missões, saldos e experiência (13/10/2026)

## Escopo

Projeto oficial: Supabase `weedreset` (`wlujqtxnlmyncdvsaumw`). Página: `/missions`.

### Integridade dos dados

- Investigada a inconsistência observada na conta utilizada no teste: duas missões efetivamente concluídas geravam 20 + 53 XP e 10 + 9 moedas, porém o perfil registrava 0 XP e a carteira 19 moedas.
- Após conferir IDs das duas missões, conclusão na data, valor da carteira, ausência de comprovantes anteriores e XP zero, foram restaurados **somente 73 XP faltantes**, mantendo as 19 moedas existentes. Dois comprovantes foram inseridos com marcador de reconciliação e sem crédito adicional de moedas. A operação tinha validações de estado para impedir ajuste no usuário errado ou repetição; reconsulta confirmou 73 XP, 19 moedas e 2 comprovantes.
- A reconciliação não deve ser repetida indiscriminadamente nem aplicada a todas as contas: requer comparar, individualmente, recibos, compras/uso de moedas e registros realmente concluídos.

### Comportamento da nova página

- Cabeçalho mais objetivo e três indicadores compactos (Nível, XP, Moedas), em três colunas inclusive no celular.
- Indicadores exibirão **—** quando não houver sessão ou quando a consulta ao banco falhar, em vez de simular progresso zero.
- Ritual do dia continua sendo a ação principal; check-ins são confirmados pelo Supabase e a jornada de sete conquistas não reinicia toda segunda.
- Desafio diário aparece como **atividade extra**, personalizada pelo início da jornada salvo no onboarding (`user_private_state.data.userData.startDate`, com prioridade para `detoxCycleStartDate` quando válido; fallback para criação do perfil).
- Missões concluídas na interface antiga no mesmo dia são mantidas como concluídas e exibidas pelo desafio original, impedindo oferta visual de uma segunda missão indevida.
- Função `claim_personal_mission_secure` valida, no servidor, o dia da jornada, categoria de missão, sessão autenticada, limite de recompensa e conclusões prévias no dia. **Crédito, progresso, XP, moedas e recibo são transacionais**, sem mutação de saldos no navegador.
- A função legada `claim_mission_secure` foi preservada para compatibilidade com versões antigas publicadas na Vercel.
- Progresso da missão semanal antiga é **somente leitura**: a página não cria automaticamente registros, não zera progresso e não oferece uma segunda grade paralela. Histórico anterior permanece acessível, com explicação de que somente novos check-ins do Ritual de Hoje alimentam as recompensas atuais.
- Seção Premium tem texto contextual para assinantes; histórico anterior pode ser aberto sob demanda; etiquetas técnicas como `sync` foram trocadas por “Salvo na nuvem”.

### Validações

- Banco: RPC validada com conta autenticada em **transação revertida (ROLLBACK)** para missão do dia correto, repetição sem novos créditos e rejeição de dia errado.
- Permissões: `anon` não pode executar a função de recompensa; `authenticated` pode.
- Banco após reconciliação: 73 XP, 19 moedas, dois recibos; nenhum saldo de outro usuário alterado.
- Build Next.js e `tsc` nos arquivos de Missões validados em sandbox Vercel; há 66 erros antigos de TypeScript em módulos não relacionados.
- Revisar a renderização mobile e testar a jornada com conta real após publicação em produção.

### Atenção antes de declarar encerrado

- Enquanto a Vercel continuar vinculada a um deployment antigo, a versão pública **não refletirá** a nova UX. Publicar a `main` após a liberação do limite de deploy e validar o SHA `READY` associado ao domínio antes de afirmar que está no ar.
- O aplicativo possui políticas RLS antigas que permitem atualização direta de `profiles` e `user_wallet`; endurecer os acessos e mover operações de loja/premium para RPCs protegidas numa auditoria específica, preservando compras e perfis existentes. A nova RPC em si impede crédito duplicado, mas não protege todas as rotas antigas.
- A personalização do dia está limitada à jornada anual de 365 dias. Antes de evoluir além desse prazo, decidir se um ciclo novo será iniciado e armazenar respostas históricas sem sobrescrever registros anteriores.
