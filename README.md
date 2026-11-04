# Twitchterino

Cliente de chat para a Twitch no estilo do [Chatterino](https://chatterino.com/), feito para a comunidade do PokeIdle. Ele mantém 2 lives em segundo plano, com o mínimo de memória e internet, para acumular pontos do canal e comprar bônus.

Adaptado do [Kickterino](https://github.com/ViinniSantoos/kickterino), de VinniiSaantos, que faz o mesmo para a Kick.

## Recursos

- **Chat em abas** de vários canais, com envio de mensagens.
- **Painel de pontos** com saldo, status e ganho de cada canal.
- **Baú automático:** clica sozinho no baú de +50 pontos quando ele aparece.
- **Foco em bônus:** as vagas vão para os canais mais perto de 300 pontos, depois 500, 1.000 e cada milhar seguinte.
- **Modo sequência:** quando um canal entra ao vivo, ele ganha uma vaga por até 10 min para pegar a sequência de lives da Twitch (300 a 450 pontos).
- **Modo leve:** lives ocultas em 160p, sem som, sem imagens e sem anúncios de terceiros.
- **Modo 24/7:** fica na bandeja, inicia com o Windows e se recupera de quedas, de suspensão e de falhas da placa de vídeo.
- **Avisos de bônus** quando um canal alcança 300, 500 ou 1.000 pontos.
- **Canais do PokeIdle** já vêm na lista: os 15 com pontos ativos no painel Bônus Twitch.

## Como funciona

O app é feito em Electron e não tem servidor próprio.

- Cada live é a página real da Twitch, aberta numa janela invisível e sem som.
- Uma janela oculta em `twitch.tv` consulta status e saldo pelo GraphQL da própria Twitch, usando a sessão da pessoa.
- Nas lives ocultas, a página fica em `display: none` e as extensões da Twitch são bloqueadas: o player continua tocando, sem recalcular layout para ninguém ver.
- O protocolo DevTools limita a live à menor qualidade e lê o chat da conexão IRC que a página da Twitch já abre.
- Um script dentro de cada live procura o baú de bônus a cada 10 s e clica quando ele aparece.
- A cada minuto, o app confere o estado dos canais e reorganiza as vagas.

## O que os testes mostraram

Medições de 04/11/2026, numa conta comum:

- **Só 2 lives ganham pontos ao mesmo tempo.** Com 6 lives abertas, 2 ganharam o +10 de assistir e o baú; as outras 4 ficaram 20 min sem ganhar nada. Alternar entre lives não aumenta o total, só muda em qual canal os pontos caem.
- Cada live que conta rende +10 a cada 5 min e um baú de +50 a cada ~15 min, ou cerca de 320 pontos por hora.
- O baú foi pego 7 vezes numa tarde, sem ninguém clicar.
- Com a página oculta em `display: none`, a Twitch continua pagando o +10 e o baú.
- Com 2 lives e a janela aberta, o app usa cerca de 45% de um núcleo da CPU e 1,1 GB de memória (cerca de 300 MB por live). Antes das otimizações, eram 2 GB e até 185% de um núcleo.
- Com o chat aberto a 5 mensagens por segundo, a janela gasta 1,6% de um núcleo e 3,2% na GPU. A interface anterior gastava 61% e 78%.
- O painel tem um **teste de limite**, que conta quantas lives ganham pontos na sua conta e ajusta o número de vagas.

A sequência de lives só paga a partir da 2ª live seguida assistida em cada canal, por isso o modo sequência ainda não foi confirmado com um pagamento real.

## Segurança da conta

- O login é feito na própria página da Twitch (ou Google, Amazon e Apple). O app não lê nem guarda a senha.
- Não há servidor do Twitchterino: a sessão fica só no seu PC. No app instalado, os cookies são criptografados pelo Windows.
- Só a Twitch e as páginas de login abrem dentro do app. Outros sites são bloqueados, e nenhuma página acessa câmera, microfone ou localização.
- **Sair da conta** apaga do app todos os dados de login, mantendo a lista de canais e as preferências.
- Nunca envie a pasta de dados do app (`%APPDATA%\Twitchterino`) para ninguém: ela contém a sua sessão.

## Desenvolvimento

Requer Node.js.

```bash
npm install
npm start
```

Se o `npm start` disser que o Electron não foi instalado (versões novas do npm podem bloquear o script de instalação dele), rode:

```bash
node node_modules/electron/install.js
```

Para gerar o instalador e a versão portátil em `dist/`:

```bash
npm run dist
```

O histórico de cada minuto (pontos, vídeo, baús clicados e vagas) fica em `%APPDATA%\Twitchterino\points-log.jsonl`.

## Limitações

- Testado só no Windows.
- Ainda não há instalador publicado nem atualização automática.
- Saldo, status, baú e chat usam o GraphQL, o IRC e a página da Twitch, que podem mudar sem aviso.
- O chat só aparece nos canais que estão sendo assistidos, e os emotes aparecem como texto.
- O envio de mensagens pelo app ainda não foi testado com uma conta real.
- Os custos dos bônus (300, 500 e 1.000) seguem os do PokeIdle na Kick.
- Projeto independente, sem ligação com a Twitch, a Kick ou o PokeIdle. Assistir sem estar presente pode ir contra os termos de uso da Twitch; use por sua conta e risco.

## Licença

[MIT](LICENSE). Baseado no Kickterino, © VinniiSaantos.
