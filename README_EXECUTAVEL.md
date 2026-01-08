# WhatsApp Forwarder - Executável

## Problema com Executável

O executável gerado com pkg está fechando imediatamente devido a incompatibilidades com as dependências nativas do Baileys.

## Solução Recomendada

### Opção 1: Usar Script BAT (Recomendado)
1. Instale o Node.js em: https://nodejs.org/
2. Execute `start_bot.bat`
3. O bot iniciará normalmente

### Opção 2: Executar Manualmente
```bash
# Instalar dependências
npm install

# Executar bot
npm start
```

### Opção 3: Executar Direto
```bash
node src/index_baileys.js
```

## Por que o executável não funciona?

O pkg tem problemas com:
- Módulos nativos do Baileys (WebSocket, criptografia)
- Dependências dinâmicas
- Arquivos binários do Node.js

## Distribuição

Para distribuir o bot:
1. Copie toda a pasta do projeto
2. Inclua o arquivo `start_bot.bat`
3. Peça para instalar Node.js
4. Execute `start_bot.bat`

## Vantagens desta abordagem:
- ✅ Funciona 100% das vezes
- ✅ Fácil debug
- ✅ Atualizações simples
- ✅ Sem problemas de compatibilidade
