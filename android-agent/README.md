# QrStack Agent Android

Agente privado para publicar o Story gerado pela plataforma QrStack no Instagram do restaurante. O computador compila e distribui o APK; o telefone executa a automacao sem precisar permanecer conectado por USB.

## Fluxo

1. O restaurante envia o formulario na plataforma.
2. A arte e salva temporariamente na Cloudflare e um job idempotente entra no D1.
3. O agente pareado reivindica o job e baixa a arte.
4. O agente abre o Instagram, seleciona a arte, inclui o link e publica.
5. Cada etapa e persistida. Uma interrupcao retoma do ultimo checkpoint seguro.

## Protecao contra interrupcoes

- Ativa Nao Perturbe somente enquanto existe uma publicacao em andamento.
- Restaura exatamente o filtro anterior ao terminar ou parar.
- Mantem tela e CPU acordadas durante o fluxo.
- Nao rejeita ligacoes e nao apaga notificacoes.
- Se uma ligacao ou outro aplicativo tomar a tela, pausa o job e aguarda o Instagram voltar.
- Depois de apertar publicar, exige confirmacao visual antes de concluir e nao dispara uma segunda tentativa no escuro.
- A recuperacao automatica e limitada; depois de interrupcoes repetidas o job pede conferencia humana.

## Instalacao no telefone

1. Baixe e instale o APK da release privada da QrStack.
2. Abra `QrStack Agent` uma vez.
3. Informe a URL da API e a chave de pareamento do dono.
4. Conceda acesso ao Nao Perturbe.
5. Ative o servico de acessibilidade `QrStack - publicar Stories`.
6. Remova a restricao de bateria para o agente.
7. Toque em `Iniciar agente`.

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
