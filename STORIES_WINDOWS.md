# Stories com publicador Windows

O navegador gera uma composição 1080 × 1920 usando o logo, as cores e o conteúdo
do restaurante ou ajusta uma imagem enviada. A geração automática é um template
da marca em canvas, sem serviço de IA ou cobrança por imagem.

O clique em **Publicar Story** cria um pedido idempotente. Cloudflare mantém
metadados e eventos no D1 e a imagem no KV por 48 horas. Python roda neste Windows,
baixa a arte autenticada e publica apenas na conta vinculada ao restaurante.
Senhas e sessões Instagram ficam no vault local, fora da plataforma.

## Implantação

1. Confirmar o D1 do binding `DB` (produção atual: `qrstack-db-live`). Não aplicar
   no banco de histórico `ARCHIVE_DB`.
2. Aplicar `cloudflare/migrations/0010_instagram_python_publisher.sql`. Requer as
   tabelas `restaurants` e `story_agents` da migração 0007. É repetível e não copia
   trabalhos Android. Se houver migrações anteriores pendentes sem relação com
   esta mudança, executar apenas este arquivo após revisar o schema existente.
3. Publicar `cloudflare/src/worker.js`, incluindo `instagram-stories.js`.
4. Publicar `index.html`, `script.js`, `workspace.js` e `workspace.css` no site.
5. Registrar o serviço Windows e conectar explicitamente as contas locais.
6. Em **Central → Stories → Configurar conta de publicação**, conferir o
   publicador, o @ e o ID imutável da conta antes de habilitar o vínculo.

O publicador está no repositório irmão `qrstack-instagram`; o roteiro de operação
é `PLATFORM_WINDOWS.md`. Um cadastro interno separado deve ser usado para testes.
Não vincular a conta de testes ao restaurante Amaro ou a outro cliente.

## Desativação do Android

A migração desativa os tokens de todos os `story_agents`; cinco endpoints antigos
retornam HTTP 410 `android_story_agent_retired`. Os registros antigos permanecem
no D1 para histórico. No telefone, usar **Parar agente** e desativar o serviço de
acessibilidade. Revogar o servidor não impede um trabalho já armazenado offline
no aparelho. Não reutilizar APKs ou tokens antigos.

## Parada e recuperação

Desabilitar o vínculo interrompe as próximas etapas do runner. Para uma pausa
global, definir `INSTAGRAM_PUBLISHING_ENABLED = "false"` no Worker. Não reverter
para um Worker anterior com rotas Android para fazer rollback; manter as rotas
aposentadas e desabilitar a nova publicação.

A permissão de publicação é atômica e de uso único. Falha ou resposta perdida
após essa permissão gera `outcome_unknown` e bloqueia a conta. O operador precisa
conferir o Instagram; não há replay automático. Um ACK de conclusão perdido pode
ser reenviado se houver mídia confirmada no journal local.

## Verificações

```powershell
node --test tests/workspace.test.cjs tests/instagram-stories.test.cjs
cloudflare\qrstack-wrangler.cmd deploy --dry-run
```

Há 21 testes frontend e 20 testes backend, estes com SQLite real e requisições
ao Worker. A verificação visual local exercita arte automática e upload usando
um servidor de teste que não encaminha publicações à produção. Isso não substitui
um teste real da ponte na conta interna.
