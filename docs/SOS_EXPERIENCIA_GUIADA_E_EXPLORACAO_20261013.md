# WeedReset — nova experiência SOS (13/10/2026)

## Análise da gravação
No celular, o antigo Plano de Apoio e a frase grande apareciam antes da ajuda rápida. Os três cartões eram altos, a biblioteca tinha muitas opções parecidas e as técnicas abriam no meio da lista. Os caminhos do Histórico SOS não estavam evidentes em telas pequenas.

## Recursos implementados
- **Ajuda imediata:** botão principal abre uma pausa guiada de um minuto. Quatro opções: vontade intensa, ansiedade, irritação e dificuldade para dormir. Sequência de 3 passos, cronômetro, pausa, retomada e possibilidade de encerrar imediatamente. Disponível sem login; o exercício continua funcionando mesmo que a rede caia após a página estar carregada.
- **Registro totalmente opcional:** intensidade antes/depois entre 0 e 10, somente se a pessoa desejar informar. Após o exercício, um usuário autenticado pode salvar o contexto e a duração. Nenhum ganho de XP ou moedas e nenhuma avaliação clínica.
- **Layout mobile:** práticas rápidas compactas, plano pessoal em seção recolhível, acesso ao Histórico visível e três recomendações gratuitas com etapas estruturadas.
- **Biblioteca organizada:** oculta inicialmente, mas acessível a qualquer momento. Busca, categorias legíveis em português, filtros de gratuitas, até 3 minutos e passo a passo. Mostra até 12 técnicas por vez com a opção de explorar mais.
- **Player em foco:** técnicas avançadas abrem em painel modal, sem perder-se na lista; inclui fechamento por Escape, foco do teclado e área rolável em celulares. O CTA Premium possui destino real.
- **Histórico privado:** /sos/history mostra também as pausas guiadas voluntariamente salvas e oferece exclusão confirmada.

## Dados e privacidade
Banco oficial Supabase weedreset. Tabela public.sos_quick_sessions com feeling, duração, intensidade opcional, usuário e data. Migração no arquivo supabase/migrations/20261013_sos_quick_help_optional_sessions.sql.
RLS impede leitura/escrita de outras contas. Somente o próprio usuário autenticado pode inserir, ler e excluir. Visitantes podem executar as técnicas sem registrar. Teste SQL transacional BEGIN/ROLLBACK confirmou inserção, leitura, exclusão e bloqueio de gravações em nome de terceiros; nenhum dado fictício permaneceu.

## Garantias e limites
Compilação Next.js e verificação de TypeScript do SOS passam no sandbox Vercel. Ainda existem erros TypeScript legados em outros módulos.
Não se afirma funcionamento completamente offline em um primeiro acesso sem cache. Não foi habilitada reprodução de áudios cujos arquivos estejam ausentes. A curadoria original de 250 técnicas precisa de revisão editorial clínica e de eficácia, separadamente.
Após a publicação, validar em celular real escolha do contexto, timer, pausa, salvamento privado, histórico entre dispositivos, exclusão, filtros, Premium e navegação acessível.
O SOS é apoio de autocuidado, não substitui atendimento profissional ou assistência de emergência.
