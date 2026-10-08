# Recuperação de senha pelo Gmail

Este projeto separado permite enviar a recuperação usando o Gmail do gestor,
sem domínio próprio e sem senha de aplicativo. O proprietário precisa autorizar
a permissão de envio no Google antes da primeira implantação.

## Estado da implantação

Em 2026-10-08, a autorização já concedida foi conferida, a versão 1 foi publicada
e os secrets `GMAIL_RELAY_URL`, `GMAIL_RELAY_SECRET` e `OWNER_RECOVERY_EMAIL`
foram configurados no Worker. Um pedido feito na tela pública de recuperação
produziu um e-mail confirmado na caixa de entrada de `qrstack@gmail.com`.
O link recebido abriu a tela de definição da nova senha. A senha da gestão não
foi alterada durante essa validação. A cópia local da credencial do relay fica
protegida por DPAPI; o arquivo temporário em texto simples foi removido.

## Configuração em outro ambiente

1. Abra `https://script.google.com/home/start` com a conta que enviará os e-mails.
2. Crie um projeto separado e copie `Code.gs` e `appsscript.json` desta pasta.
3. Confira que `authorizeQrStackRecovery` contém o destinatário autorizado.
4. Execute `authorizeQrStackRecovery` e autorize a permissão de envio. A função
   configura o destinatário e gera `QRSTACK_RELAY_SECRET` nas propriedades do
   script, sem imprimir seu valor. O mesmo segredo precisa ficar no secret
   `GMAIL_RELAY_SECRET` do Worker; nunca no frontend, no código publicado ou no chat.
5. Implante como aplicativo da Web executado pelo proprietário, acessível por
   qualquer pessoa. O endpoint exige assinatura HMAC, expiração e nonce; acesso
   público à URL não concede permissão para enviar e-mails.
6. Configure `GMAIL_RELAY_URL`, `GMAIL_RELAY_SECRET` e `OWNER_RECOVERY_EMAIL`
   como secrets do Worker. Solicite um link pela tela de recuperação e confira
   a entrega. Não considere o envio validado antes desse teste.

O destinatário é fixo, a assinatura vale dois minutos e cada nonce só é aceito
uma vez. Os links gerados pelo Worker valem quinze minutos, têm uso único e
invalidam as sessões anteriores quando a redefinição é concluída. Nenhuma
senha aparece nos e-mails. A resposta HTTP nunca inclui o link de recuperação.

Enquanto não houver remetente autorizado, o Worker retorna indisponibilidade
na solicitação de recuperação; ele não anuncia envio bem-sucedido fictício.
