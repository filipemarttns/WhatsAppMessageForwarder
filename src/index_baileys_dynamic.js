console.log('=== BOT WHATSAPP BAILEYS ===');

try {
    console.log('Carregando dependências...');
    
    // Carrega dependências uma por uma com verificação
    console.log('1. dotenv...');
    require('dotenv').config();
    
    console.log('2. fs...');
    const fs = require('fs');
    
    console.log('3. path...');
    const path = require('path');
    
    console.log('4. qrcode-terminal...');
    const qrcode = require('qrcode-terminal');
    
    console.log('5. pino...');
    const pino = require('pino');
    
    console.log('6. Baileys...');
    const baileys = require('@whiskeysockets/baileys');
    
    console.log('✅ Todas dependências carregadas!');
    
    // Configuração
    const SOURCE_COMMUNITY_NAMES = (process.env.SOURCE_COMMUNITY_NAMES || "").split(',').map(name => name.trim()).filter(n => n);
    const TARGET_GROUP_NAME = process.env.TARGET_GROUP_NAME || "OJ® Streetwear Shop & Sneakers";
    const AUTH_FOLDER = './auth_info_baileys';
    
    console.log('Configuração:');
    console.log('- Source communities:', SOURCE_COMMUNITY_NAMES);
    console.log('- Target group:', TARGET_GROUP_NAME);
    console.log('- Auth folder:', AUTH_FOLDER);
    
    // Inicialização simplificada
    async function startBot() {
        console.log('Iniciando bot Baileys...');
        
        try {
            const { useMultiFileAuthState, fetchLatestBaileysVersion, makeWASocket } = baileys;
            
            console.log('Criando pasta de autenticação...');
            if (!fs.existsSync(AUTH_FOLDER)) {
                fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            }
            
            console.log('Carregando estado de autenticação...');
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
            
            console.log('Buscando versão do WhatsApp...');
            const { version } = await fetchLatestBaileysVersion();
            console.log('WhatsApp version:', version);
            
            console.log('Criando socket...');
            const sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: true,
                logger: { level: 'silent' },
                browser: ['WhatsApp Forwarder', 'Chrome', '10.0.0']
            });
            
            sock.ev.on('connection.update', (update) => {
                const { connection, qr } = update;
                
                if (qr) {
                    console.log('\n=== QR CODE GERADO ===');
                    console.log('Escaneie com seu WhatsApp');
                }
                
                if (connection === 'open') {
                    console.log('\n✅ CONECTADO COM SUCESSO!');
                    console.log('Bot monitorando grupos...');
                }
                
                if (connection === 'close') {
                    console.log('❌ Conexão fechada');
                    process.exit(1);
                }
            });
            
            sock.ev.on('creds.update', saveCreds);
            
            console.log('✅ Bot configurado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao iniciar bot:', error.message);
            console.error('Stack:', error.stack);
        }
    }
    
    startBot();
    
} catch (error) {
    console.error('\n❌ ERRO FATAL:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    
    // Mantém aberto para debug
    setTimeout(() => process.exit(1), 10000);
}
