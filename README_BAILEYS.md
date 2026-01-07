# WhatsApp Message Forwarder - Versão Baileys

## Nova Arquitetura

O sistema foi completamente reconstruído usando **Baileys** em vez de `whatsapp-web.js`, eliminando dependência de Puppeteer e automação baseada em DOM.

### Principais Mudanças

- **Sem Puppeteer**: Não usa navegador ou controle de DOM
- **Conexão Direta**: Usa eventos WebSocket do WhatsApp Web
- **Multi-Device**: Totalmente compatível com WhatsApp Multi-Device
- **Sessão Persistente**: Armazena credenciais localmente para reconexão automática
- **Mais Estável**: Resiliente a atualizações do WhatsApp

## Estrutura de Pastas

```
WhatsAppMessageForwarder/
├── src/
│   ├── index.js              # Versão antiga (whatsapp-web.js)
│   ├── index_baileys.js      # Nova versão (Baileys)
│   └── test.js              # Arquivo de testes
├── auth_info_baileys/       # Pasta criada automaticamente para sessão
├── node_modules/
├── package.json             # Atualizado para Baileys
├── .env                     # Variáveis de ambiente (mesmo formato)
└── README_BAILEYS.md        # Este arquivo
```

## Como Usar

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Mantenha seu arquivo `.env` existente com as mesmas configurações:

```env
SOURCE_COMMUNITY_NAMES=Comunidade1,Comunidade2
ANNOUNCEMENT_GROUP_NAMES=Avisos,Anúncios
TARGET_GROUP_NAME=Seu Grupo de Destino
GLOBAL_PRICE_MULTIPLIER=3
DEDUPE_WINDOW_SECONDS=10
MEDIA_SEND_DELAY_MS=20000
LOG_PATH=./wh_relay.log
```

### 3. Executar Nova Versão

```bash
node src/index_baileys.js
```

### 4. Primeira Autenticação

- Escaneie o QR Code no terminal
- A sessão será salva automaticamente em `auth_info_baileys/`
- Nas próximas execuções, conectará automaticamente

## Funcionalidades Mantidas

### ✅ Lógica de Negócio Completa

- **Filtro de Grupos**: Identifica automaticamente grupos de avisos (announce=true)
- **Multiplicação de Preços**: Processa todos os formatos (R$, $$, $, etc.)
- **Regras Atacado/Varejo**: Mantém lógica original de filtragem
- **Deducação**: Evita mensagens duplicadas
- **Filtros de Conteúdo**: Ignora "bom dia" e outras palavras-chave

### ✅ Processamento de Mídia

- Download automático de imagens, vídeos e documentos
- Envio separado de mídia e texto com delay configurável
- Suporte para todos os formatos principais

### ✅ Logging e Monitoramento

- Logs detalhados no mesmo formato anterior
- Identificação completa de source/target groups
- Rastreamento de erros e status

## Vantagens da Nova Arquitetura

### 🚀 Performance
- **Consumo reduzido**: Sem navegador rodando em background
- **Conexão direta**: WebSocket events em tempo real
- **Menor latência**: Resposta mais rápida a novas mensagens

### 🔧 Manutenibilidade
- **Código mais limpo**: API mais direta e documentada
- **Menos dependências**: Apenas Baileys + utilitários essenciais
- **Atualizações automáticas**: Baileys mantido ativamente pela comunidade

### 🛡️ Estabilidade
- **Anti-ban**: Usa API oficial do WhatsApp Web
- **Reconexão automática**: Tratamento robusto de desconexões
- **Multi-device**: Funciona com WhatsApp conectado em múltiplos dispositivos

## Limitações e Considerações

### ⚠️ Importante

1. **Primeira Conexão**: Requer escaneamento de QR Code
2. **Sessão Persistente**: Mantém conexão mesmo se WhatsApp for fechado
3. **Rate Limits**: WhatsApp ainda tem limites de envio (mantidos da versão anterior)
4. **Mídia**: Download/streaming pode ser mais lento em conexões instáveis

### 🔧 Boas Práticas

- **Backup**: Faça backup da pasta `auth_info_baileys/`
- **Monitoramento**: Verifique logs regularmente
- **Rate Limits**: Mantenha delays configurados para evitar bloqueios
- **Atualizações**: Mantenha Baileys atualizado (`npm update @whiskeysockets/baileys`)

## Troubleshooting

### QR Code não aparece
- Verifique se não há sessão salva em `auth_info_baileys/`
- Delete a pasta e tente novamente

### Conexão cai frequentemente
- Verifique estabilidade da internet
- Aumente timeouts nas configurações
- Monitore logs para identificar padrões

### Erro de autenticação
- Delete pasta `auth_info_baileys/`
- Escaneie QR Code novamente
- Verifique se WhatsApp não está conectado em muitos dispositivos

## Migração da Versão Antiga

1. **Backup**: Faça backup do projeto atual
2. **Instalação**: Execute `npm install` para atualizar dependências
3. **Teste**: Execute `node src/index_baileys.js` em paralelo com versão antiga
4. **Substituição**: Quando estiver confiante, substitua `index.js` pelo `index_baileys.js`

## Suporte

- **Documentação Baileys**: https://github.com/WhiskeySockets/Baileys
- **Issues do Projeto**: Verifique logs detalhados para troubleshooting
- **Comunidade**: Baileys tem comunidade ativa para suporte
