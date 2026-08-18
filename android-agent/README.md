# QrStack Agent Android

Agente privado para publicar o Story gerado pela plataforma QrStack no Instagram do restaurante. O computador compila e distribui o APK; o telefone executa a automacao sem precisar permanecer conectado por USB.

## Fluxo

1. O restaurante envia o formulario na plataforma.
2. A arte e salva temporariamente na Cloudflare e um job idempotente entra no D1.
3. O agente pareado reivindica o job e baixa a arte.
4. O agente entrega a arte diretamente ao compositor de Stories, inclui o link e publica.
5. Cada etapa e persistida. Uma interrupcao retoma do ultimo checkpoint seguro.

## Protecao contra interrupcoes

- Ativa Nao Perturbe somente enquanto existe uma publicacao em andamento.
- Restaura exatamente o filtro anterior ao terminar ou parar.
- Persiste o filtro anterior e o recupera mesmo depois de encerramento inesperado do processo.
- Mantem tela e CPU acordadas durante o fluxo.
- Nao rejeita ligacoes e nao apaga notificacoes.
- Se uma ligacao ou outro aplicativo tomar a tela, pausa o job e aguarda o Instagram voltar.
- O botao `Parar agente` bloqueia retomadas ate um novo toque manual em `Iniciar agente`.
- A notificacao permanente e a tela principal exibem `PARAR` durante a execucao.
- Se o Instagram ja estiver em uso quando chegar uma arte, o agente avisa em alta prioridade e aguarda `PUBLICAR AGORA`, evitando publicar na conta errada.
- Antes de abrir o compositor, o link do cardapio e copiado para a area de transferencia.
- O sticker `LINK` e pesquisado e validado pelo nome exato; o agente nunca usa a posicao do sticker `Localizacao`.
- Depois de uma atualizacao ou reinicio, o agente aguarda ate nove segundos pela reconexao da acessibilidade. Se o Android nao liberar o servico, o job fica pausado e uma notificacao `ATIVAR E CONTINUAR` abre a configuracao correta, sem marcar falha nem criar uma segunda publicacao.
- Depois de apertar publicar, exige confirmacao visual antes de concluir e nao dispara uma segunda tentativa no escuro.
- A recuperacao automatica e limitada; depois de interrupcoes repetidas o job pede conferencia humana.

## Instalacao no telefone

1. Baixe e instale o APK da release privada da QrStack apenas na primeira instalação.
2. Abra `QrStack Agent` uma vez.
3. Toque em `Parear este telefone`. Não há chave para digitar.
4. Conceda acesso ao Nao Perturbe.
5. Ative o servico de acessibilidade `QrStack - publicar Stories`.
6. Remova a restricao de bateria para o agente.
7. Toque em `Iniciar agente`.

Depois desta instalação, o agente consulta a versão publicada automaticamente. Quando houver uma versão nova, o botão de atualização baixa o APK dentro do próprio aplicativo e abre a confirmação oficial do Android. Não é necessário procurar o arquivo nem abrir o navegador; o toque final em `Instalar` continua obrigatório em aparelhos Android comuns.

O telefone deve estar desbloqueado e com a conta correta aberta no Instagram durante a janela operacional. Nao e necessario deixá-lo sem senha; remover a senha reduziria a seguranca sem resolver os bloqueios de automacao do Android.

## Teste real obrigatorio

Antes de usar com clientes:

1. Publique uma arte de teste sem interrupcao.
2. Repita recebendo uma notificacao comum durante o fluxo.
3. Repita recebendo e atendendo uma ligacao antes do comando de publicar.
4. Repita com a ligacao chegando logo depois do comando de publicar.
5. Confirme no portal que cada job terminou uma unica vez e que o link ficou clicavel.

As coordenadas de contingencia existem para a interface atual do Instagram. Mudancas grandes no aplicativo podem exigir recalibracao; por isso o agente prefere textos e descricoes de acessibilidade antes de usar coordenadas.

## Build

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
.\gradlew.bat clean assembleDebug lintDebug
```

APK de desenvolvimento:

`app/build/outputs/apk/debug/app-debug.apk`
