# Recuperação de senha pelo Gmail

Este projeto separado permite enviar a recuperação usando o Gmail do gestor,
sem domínio próprio e sem senha de aplicativo. Está pronto para implantação,
mas o proprietário precisa autorizar a permissão de envio no Google.

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
