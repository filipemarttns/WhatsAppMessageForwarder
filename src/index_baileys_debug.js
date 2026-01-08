const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Função de diagnóstico
function diagnose() {
    console.log('=== DIAGNÓSTICO INICIADO ===');
    console.log('Node.js version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    console.log('Current working directory:', process.cwd());
    console.log('Script directory:', __dirname);
    console.log('Environment variables loaded:', !!process.env.SOURCE_COMMUNITY_NAMES);
    
    // Verificar arquivos essenciais
    const requiredFiles = ['.env'];
    requiredFiles.forEach(file => {
        const exists = fs.existsSync(file);
        console.log(`${file}: ${exists ? '✅' : '❌'}`);
    });
    
    // Verificar pastas
    const requiredDirs = ['auth_info_baileys', 'logs'];
    requiredDirs.forEach(dir => {
        const exists = fs.existsSync(dir);
        console.log(`${dir}/: ${exists ? '✅' : '❌'}`);
        if (!exists) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`${dir}/: ✅ Criada automaticamente`);
            } catch (error) {
                console.log(`${dir}/: ❌ Erro ao criar: ${error.message}`);
            }
        }
    });
    
    console.log('=== DIAGNÓSTICO CONCLUÍDO ===\n');
}

// Executar diagnóstico imediatamente
try {
    diagnose();
} catch (error) {
    console.error('ERRO NO DIAGNÓSTICO:', error.message);
    console.error('Stack:', error.stack);
}

// Configuration
const SOURCE_COMMUNITY_NAMES = (process.env.SOURCE_COMMUNITY_NAMES || "").split(',').map(name => name.trim()).filter(n => n);
const ANNOUNCEMENT_GROUP_NAMES = (process.env.ANNOUNCEMENT_GROUP_NAMES || process.env.ANNOUNCEMENT_GROUP_NAME || "")
  .split(',')
  .map(name => name.trim())
  .filter(n => n);
const ANNOUNCEMENT_GROUP_NAME = process.env.ANNOUNCEMENT_GROUP_NAME || "Avisos";
const TARGET_GROUP_NAME = process.env.TARGET_GROUP_NAME || "OJ® Streetwear Shop & Sneakers";
const DEDUPE_WINDOW_SECONDS = parseInt(process.env.DEDUPE_WINDOW_SECONDS || "10", 10);
const MEDIA_SEND_DELAY_MS = parseInt(process.env.MEDIA_SEND_DELAY_MS || "20000", 10);
const LOG_PATH = process.env.LOG_PATH || './wh_relay.log';
const AUTH_FOLDER = './auth_info_baileys';

let GLOBAL_PRICE_MULTIPLIER = parseFloat(process.env.GLOBAL_PRICE_MULTIPLIER) || 3;

console.log('=== CONFIGURAÇÃO CARREGADA ===');
console.log('SOURCE_COMMUNITY_NAMES:', SOURCE_COMMUNITY_NAMES);
console.log('ANNOUNCEMENT_GROUP_NAME:', ANNOUNCEMENT_GROUP_NAME);
console.log('TARGET_GROUP_NAME:', TARGET_GROUP_NAME);
console.log('DEDUPE_WINDOW_SECONDS:', DEDUPE_WINDOW_SECONDS);
console.log('MEDIA_SEND_DELAY_MS:', MEDIA_SEND_DELAY_MS);
console.log('LOG_PATH:', LOG_PATH);
console.log('AUTH_FOLDER:', AUTH_FOLDER);
console.log('GLOBAL_PRICE_MULTIPLIER:', GLOBAL_PRICE_MULTIPLIER);
console.log('=== CONFIGURAÇÃO CONCLUÍDA ===\n');

// Normalização e listas de filtro
function normalize(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const communityWanted = SOURCE_COMMUNITY_NAMES.map(normalize);
const defaultAnnouncementNames = [normalize(ANNOUNCEMENT_GROUP_NAME), 'anuncios', 'anúncios', 'announcements'];
const announcementWanted = (ANNOUNCEMENT_GROUP_NAMES.length > 0
    ? ANNOUNCEMENT_GROUP_NAMES
    : [ANNOUNCEMENT_GROUP_NAME]
).map(normalize).concat(defaultAnnouncementNames);

// Initialize logger
let logger;
try {
    logger = pino(
      {
        level: 'debug',
        base: null,
      },
      pino.destination({
        dest: LOG_PATH,
        sync: false,
      })
    );
    console.log('✅ Logger inicializado');
} catch (error) {
    console.error('❌ Erro ao inicializar logger:', error.message);
    // Criar logger simples como fallback
    logger = {
        info: (msg) => console.log('[INFO]', msg),
        error: (msg) => console.error('[ERROR]', msg),
        debug: (msg) => console.log('[DEBUG]', msg),
        warn: (msg) => console.warn('[WARN]', msg)
    };
}

// Global variables
let sock;
let sourceGroups = [];
let sourceGroupIds = [];
let targetGroup;
let isReadyToProcessMessages = false;
const forwardedMessages = new Map();

// Função para reconectar
async function connectToWhatsApp() {
    console.log('🚀 Iniciando conexão com WhatsApp...');
    logger.info('Starting WhatsApp Forwarder Bot with Baileys...');
    
    try {
        console.log('📁 Verificando pasta de autenticação:', AUTH_FOLDER);
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            console.log('✅ Pasta de autenticação criada');
        }

        console.log('🔐 Carregando estado de autenticação...');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        console.log('✅ Estado de autenticação carregado');
        
        console.log('📱 Buscando versão do Baileys...');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`✅ WA v${version.join('.')}, isLatest: ${isLatest}`);

        console.log('🔌 Criando socket WhatsApp...');
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['WhatsApp Forwarder Bot', 'Chrome', '10.0.0']
        });
        console.log('✅ Socket criado');

        // QR Code handling
        console.log('📋 Configurando handlers de eventos...');
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n=== QR CODE PARA AUTENTICAÇÃO ===');
                console.log('QR Code recebido! Escaneie com seu WhatsApp...');
                qrcode.generate(qr, { small: true });
                console.log('\n=== ESCANEIE O QR CODE ACIMA COM SEU WHATSAPP ===');
                logger.info('QR RECEIVED. Scan with your WhatsApp app.');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ Conexão fechada:', lastDisconnect?.error?.message);
                console.log('🔄 Reconectando:', shouldReconnect);
                logger.error(`Connection closed: ${lastDisconnect?.error?.message || 'Unknown error'}`);
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(), 5000);
                } else {
                    console.log('❌ Logout detectado. Encerrando...');
                    logger.error('Logged out. Please scan QR code again.');
                    process.exit(1);
                }
            }

            if (connection === 'open') {
                console.log('\n✅ WhatsApp conectado com sucesso!');
                console.log('🤖 Bot iniciado e monitorando grupos...\n');
                logger.info('Connection opened successfully!');
                
                await initializeGroups();
            }
        });

        sock.ev.on('creds.update', saveCreds);
        console.log('✅ Handlers configurados');

        // Message handling
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;
                
                await handleMessage(message);
            } catch (error) {
                console.error('❌ Erro ao processar mensagem:', error.message);
                logger.error(`Message processing error: ${error.message}`);
            }
        });

        console.log('✅ Bot configurado com sucesso!');

    } catch (error) {
        console.error('❌ ERRO FATAL NA CONEXÃO:', error.message);
        console.error('Stack:', error.stack);
        logger.error(`Failed to connect: ${error.message}`);
        
        // Manter o processo aberto por 10 segundos para mostrar o erro
        console.log('\n⏳ Aguardando 10 segundos antes de encerrar...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        process.exit(1);
    }
}

// Initialize groups after connection
async function initializeGroups() {
    try {
        console.log('📋 Inicializando grupos...');
        const chats = await sock.groupFetchAllParticipating();
        
        const chatArray = Object.values(chats);
        console.log(`📊 Encontrados ${chatArray.length} grupos`);
        
        const groupNamesFound = chatArray.map(chat => chat.subject);
        logger.info(`[DEBUG] Todos os nomes de grupos encontrados: [${groupNamesFound.join(', ')}]`);

        const announcedChats = chatArray.filter(chat => chat.announce);
        logger.info(`[ANNOUNCE] Grupos com announce=true encontrados: [${announcedChats.map(c => c.subject).join(', ')}]`);
        logger.info(`[ANNOUNCE] communityWanted: [${communityWanted.join(', ')}]; announcementWanted: [${announcementWanted.join(', ')}]`);

        if (communityWanted.length > 0 || announcementWanted.length > 0) {
            sourceGroups = announcedChats.filter(chat => {
                const nameN = normalize(chat.subject);
                const matchesCommunity = communityWanted.length > 0 && communityWanted.some(w => nameN.includes(w) || nameN === w);
                const matchesAnnouncementName = announcementWanted.some(w => w && (nameN === w || nameN.includes(w)));
                const accepted = matchesCommunity || matchesAnnouncementName;
                logger.debug(`[ANNOUNCE_MATCH] name="${chat.subject}" announce=true matchesCommunity=${matchesCommunity} matchesAnnouncementName=${matchesAnnouncementName} accepted=${accepted}`);
                return accepted;
            });
        } else {
            sourceGroups = announcedChats;
            logger.warn('Nenhum filtro de nomes fornecido. Monitorando TODOS os grupos de anúncio encontrados.');
        }

        sourceGroupIds = sourceGroups.map(group => group.id);

        if (sourceGroups.length === 0) {
            const errorMsg = `Nenhum Grupo de Avisos encontrado.\nFiltros usados -> ANNOUNCEMENT_GROUP_NAMES: [${ANNOUNCEMENT_GROUP_NAMES.join(', ')}]; SOURCE_COMMUNITY_NAMES: [${SOURCE_COMMUNITY_NAMES.join(', ')}].`;
            console.error('❌', errorMsg);
            logger.error(errorMsg);
            process.exit(1);
        }

        targetGroup = chatArray.find(chat => chat.subject === TARGET_GROUP_NAME);
        
        if (!targetGroup) {
            const errorMsg = `Grupo de destino "${TARGET_GROUP_NAME}" não encontrado.`;
            console.error('❌', errorMsg);
            logger.error(errorMsg);
            process.exit(1);
        }

        logger.info(`Monitorando Grupos de Aviso: "${sourceGroups.map(g => g.subject).join(', ')}"`);
        logger.info(`Encaminhando para o grupo: "${targetGroup.subject} (${targetGroup.id})"`);

        isReadyToProcessMessages = true;
        console.log('✅ Grupos inicializados com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao inicializar grupos:', error.message);
        logger.error(`Failed to initialize groups: ${error.message}`);
    }
}

// Handle incoming messages
async function handleMessage(message) {
    if (!isReadyToProcessMessages) {
        logger.warn('Ignorando mensagem: Bot ainda não está pronto para processar.');
        return;
    }

    if (message.key.fromMe) return;
    if (!message.key.remoteJid || !message.key.remoteJid.endsWith('@g.us')) return;
    if (!sourceGroupIds.includes(message.key.remoteJid)) return;

    // Processamento simplificado para debug
    console.log('📨 Mensagem recebida de:', message.key.remoteJid);
    logger.info('Message received from monitored group');
}

// Error handling
process.on('uncaughtException', (error) => {
    console.error('\n❌ UNCAUGHT EXCEPTION:', error.message);
    console.error('Stack:', error.stack);
    logger.error(`Uncaught Exception: ${error.message}`);
    
    console.log('\n⏳ Aguardando 10 segundos antes de encerrar...');
    setTimeout(() => process.exit(1), 10000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ UNHANDLED REJECTION:', reason);
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Start the bot
console.log('🚀 Iniciando bot...');
connectToWhatsApp().catch(error => {
    console.error('❌ ERRO AO INICIAR BOT:', error.message);
    console.error('Stack:', error.stack);
    setTimeout(() => process.exit(1), 10000);
});
