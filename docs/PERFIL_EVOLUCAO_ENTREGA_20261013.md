# WeedReset — Perfil Evolução · entrega de 13/10/2026

Banco oficial: Supabase **weedreset** (ref wlujqtxnlmyncdvsaumw).
Origem: cinco recomendações de experiência do usuário para o Perfil.

## Funcionalidades entregues

1. **Minha evolução** — resumo dos últimos 7 dias (check-ins reais), missões concluídas nos últimos 30 dias, XP e moedas vindos de \`profiles\` e \`user_wallet\`, e humor mais frequente entre os check-ins registrados. "—" se houver falha de sincronização; sem inventar progresso ou humor.
2. **Metas pessoais** — meta semanal de check-ins, sessões ou diferença de gastos. Valores e prazo configuráveis. O progresso usa check-ins reais ou os registros semanais voluntários da pessoa.
3. **Minha economia** — referência de gasto semanal informada pelo usuário comparada a um registro da semana. Projeção mensal é rotulada como cenário (diferença semanal x 4,33), não dinheiro comprovadamente economizado. Campo vazio ≠ zero. Valores em moedas diferentes não são convertidos automaticamente.
4. **Plano de apoio privado** — até três gatilhos, três ações que ajudam e rótulo opcional de uma pessoa de confiança, sem exigir telefone. O resumo fica disponível também na tela **SOS**; falhas na consulta não impedem as ferramentas SOS de funcionar.
5. **Dados e preferências intuitivos** — a seção editável ficou recolhível; há aviso de alterações não salvas e confirmação de salvamento junto ao formulário. Opção de baixar JSON com conjuntos principais da conta, incluindo dados privados de jornada e registros. O arquivo não é protegido por senha: orientamos a guardá-lo em local privado.

## Modelo de dados e privacidade

- \`profile_growth_settings\`: metas, referência financeira e plano de apoio, uma linha por usuário.
- \`profile_weekly_reviews\`: registros opcionais semanais de sessões, despesas, humor e moeda.
- Ambas as tabelas têm RLS habilitado e políticas de SELECT, INSERT, UPDATE e DELETE restritas a \`auth.uid() = user_id\`.
- Sem acesso para \`anon\`. A verificação de identidade ocorre antes das consultas privadas.
- Nenhuma função nova altera XP, moedas, assinatura ou histórico de consumo existente.
- Migração versionada em \`supabase/migrations/20261013_profile_growth_hub.sql\`.

## Validações

- Migração aplicada diretamente ao projeto Supabase \`weedreset\`.
- Inserção e atualização simuladas como usuário autenticado funcionaram.
- Tentativa de inserir dados para outra conta foi recusada pela política de segurança.
- Esses testes ocorreram em uma transação que terminou com ROLLBACK.
- \`npm run build\` Next.js **aprovado**, com variáveis públicas fictícias usadas apenas para compilação.
- Não há erros de TypeScript nos novos componentes do Perfil nem no SOS; os **66 erros de TypeScript legados** existentes no projeto permanecem, incluindo 12 em \`src/app/profile/page.tsx\`.

## Limitações honestas

- Acompanhamento semanal requer que o usuário informe os valores; nenhum valor é presumido como gasto ou economia efetiva.
- A projeção financeira não inclui todos os fatores pessoais e não equivale a um extrato financeiro real.
- O botão de exportação produz uma cópia dos principais conjuntos de dados, não é uma exportação exaustiva de todos os logs possíveis do sistema.
- Testes de usabilidade em celular com uma conta real e dados existentes continuam recomendados após deploy.
- O aviso de alterações não salvas protege o fechamento/atualização da aba; a navegação dentro de uma SPA pode exigir melhorias adicionais de confirmação no futuro.
