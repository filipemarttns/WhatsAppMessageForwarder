const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

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
const logger = pino(
  {
    level: 'debug',
    base: null,
  },
  pino.destination({
    dest: LOG_PATH,
    sync: false,
  })
);

// Global variables
let sock;
let sourceGroups = [];
let sourceGroupIds = [];
let targetGroup;
let isReadyToProcessMessages = false;
const forwardedMessages = new Map();
const pendingMediaMessages = new Map(); // Armazena mídia aguardando texto

// Função para reconectar
async function connectToWhatsApp() {
    logger.info('Starting WhatsApp Forwarder Bot with Baileys...');
    console.log(`[DEBUG] Multiplicador de preço configurado: ${GLOBAL_PRICE_MULTIPLIER}`);
    
    logger.info(`Source Communities: "${SOURCE_COMMUNITY_NAMES.join(', ')}"`);
    logger.info(`Announcement Group Name: "${ANNOUNCEMENT_GROUP_NAME}"`);
    logger.info(`Target Group: "${TARGET_GROUP_NAME}"`);
    logger.info(`Dedupe Window: ${DEDUPE_WINDOW_SECONDS} seconds`);
    logger.info(`Media Send Delay: ${MEDIA_SEND_DELAY_MS} milliseconds`);
    logger.info(`Log Path: "${LOG_PATH}"`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false, // We'll handle QR ourselves
            logger: pino({ level: 'silent' }), // Disable Baileys internal logging
            browser: ['WhatsApp Forwarder Bot', 'Chrome', '10.0.0']
        });

        // QR Code handling
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
                console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                logger.error(`Connection closed: ${lastDisconnect?.error?.message || 'Unknown error'}`);
                
                if (shouldReconnect) {
                    connectToWhatsApp();
                } else {
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

        // Message handling
        sock.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (!message.message) return;
            
            await handleMessage(message);
        });

    } catch (error) {
        logger.error(`Failed to connect: ${error.message}`);
        console.log('Erro ao conectar:', error.message);
        process.exit(1);
    }
}

// Initialize groups after connection
async function initializeGroups() {
    try {
        const chats = await sock.groupFetchAllParticipating();
        
        // Convert to array for easier processing
        const chatArray = Object.values(chats);
        
        // Log all group names found for debugging
        const groupNamesFound = chatArray.map(chat => chat.subject);
        logger.info(`[DEBUG] Todos os nomes de grupos encontrados: [${groupNamesFound.join(', ')}]`);

        // Find announcement groups (groups with announce setting)
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
            logger.error(`Nenhum Grupo de Avisos encontrado de acordo com os filtros.
Filtros usados -> ANNOUNCEMENT_GROUP_NAMES: [${ANNOUNCEMENT_GROUP_NAMES.join(', ')}]; SOURCE_COMMUNITY_NAMES: [${SOURCE_COMMUNITY_NAMES.join(', ')}].
Verifique os nomes no WhatsApp, inclusive acentuação e variações, ou deixe vazio para monitorar todos os grupos com announce=true.`);
            process.exit(1);
        }

        // Find target group
        targetGroup = chatArray.find(chat => chat.subject === TARGET_GROUP_NAME);
        
        if (!targetGroup) {
            logger.error(`Grupo de destino "${TARGET_GROUP_NAME}" não encontrado. Verifique o nome no .env.`);
            process.exit(1);
        }

        logger.info(`Monitorando Grupos de Aviso: "${sourceGroups.map(g => g.subject).join(', ')}"`);
        logger.info(`Encaminhando para o grupo: "${targetGroup.subject} (${targetGroup.id})"`);

        isReadyToProcessMessages = true;

    } catch (error) {
        logger.error(`Failed to initialize groups: ${error.message}`);
        console.log('Erro ao inicializar grupos:', error.message);
    }
}

// Handle incoming messages
async function handleMessage(message) {
    if (!isReadyToProcessMessages) {
        logger.warn('Ignorando mensagem: Bot ainda não está pronto para processar.');
        return;
    }

    // Ignore messages from ourselves
    if (message.key.fromMe) return;

    // Only process group messages
    if (!message.key.remoteJid || !message.key.remoteJid.endsWith('@g.us')) return;

    // Check if message is from monitored source groups
    if (!sourceGroupIds.includes(message.key.remoteJid)) return;

    // Get message content
    const messageContent = message.message;
    let messageBody = '';
    let hasMedia = false;

    // Extract text content
    if (messageContent.conversation) {
        messageBody = messageContent.conversation;
    } else if (messageContent.extendedTextMessage) {
        messageBody = messageContent.extendedTextMessage.text;
    } else if (messageContent.imageMessage && messageContent.imageMessage.caption) {
        messageBody = messageContent.imageMessage.caption;
    } else if (messageContent.videoMessage && messageContent.videoMessage.caption) {
        messageBody = messageContent.videoMessage.caption;
    } else if (messageContent.documentMessage && messageContent.documentMessage.caption) {
        messageBody = messageContent.documentMessage.caption;
    }

    // Check for media
    hasMedia = !!(messageContent.imageMessage || messageContent.videoMessage || 
                  messageContent.audioMessage || messageContent.documentMessage || 
                  messageContent.stickerMessage);

    logger.debug(`[DEBUG] Media detection - imageMessage: ${!!messageContent.imageMessage}, videoMessage: ${!!messageContent.videoMessage}, audioMessage: ${!!messageContent.audioMessage}, documentMessage: ${!!messageContent.documentMessage}, stickerMessage: ${!!messageContent.stickerMessage}, hasMedia: ${hasMedia}`);

    logger.debug(`[DEBUG] Mensagem recebida. Tipo: ${Object.keys(messageContent)[0]}, De: ${message.key.remoteJid}, Corpo: ${messageBody.substring(0, 50)}...`);

    // Filter messages based on keywords
    const messageBodyLower = messageBody.toLowerCase();
    if (messageBodyLower.includes('bom dia')) {
        logger.info(`[FILTRO] Mensagem ignorada devido a bom dia: "${messageBody.substring(0, 50)}..."`);
        return;
    }

    // Get source group info
    const sourceGroup = sourceGroups.find(g => g.id === message.key.remoteJid);
    const actualSourceGroupName = sourceGroup ? sourceGroup.subject : 'Unknown Group';

    logger.info({
        timestamp: new Date().toISOString(),
        source_message_id: message.key.id,
        author: message.key.participant || message.key.remoteJid,
        source_group: actualSourceGroupName,
        original_text: messageBody,
        media_filenames: [],
        status: 'received',
        error_message: null,
    }, 'Nova mensagem recebida de um Grupo de Avisos monitorado.');

    // Deduplication check
    const messageIdentifier = message.key.id || `${messageBody}-${hasMedia}`;
    if (forwardedMessages.has(messageIdentifier)) {
        const lastForwardTime = forwardedMessages.get(messageIdentifier);
        if ((Date.now() - lastForwardTime) / 1000 < DEDUPE_WINDOW_SECONDS) {
            logger.warn({
                timestamp: new Date().toISOString(),
                source_message_id: message.key.id,
                author: message.key.participant || message.key.remoteJid,
                source_group: actualSourceGroupName,
                original_text: messageBody,
                media_filenames: [],
                status: 'skipped',
                error_message: 'Mensagem duplicada ignorada dentro da janela de deduplicação.',
            }, 'Skipping duplicate message.');
            return;
        }
    }

    let mediaFilenames = [];
    let modifiedBody = messageBody;

    // Process text for R$ and Atacado rules
    if (modifiedBody) {
        const lines = modifiedBody.split(/\r?\n/);
        const processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            const hasAtacado = /atacado/gi.test(line);
            const hasVarejo = /varejo/gi.test(line);
            
            if (hasVarejo && !hasAtacado) {
                processedLines.push('');
                continue;
            }
            
            if (hasAtacado) {
                line = line.replace(/\s*-?\s*Atacado\s*:?\s*/gi, '').trim();
            }
            
            const priceRegex = /(?::?\s*)?(R\$|\$\$?)\s*(\d+(?:[.,]\d{2})?)|\b(\d+(?:[.,]\d{2})?)\s*(R\$|\$\$?)|\b(\d+[.,]\d{2})\b/gi;
            
            line = line.replace(priceRegex, (fullMatch, symbolBefore, priceBefore, priceAfter, symbolAfter, priceAlone) => {
                let priceString;
                if (priceBefore) {
                    priceString = priceBefore;
                } else if (priceAfter) {
                    priceString = priceAfter;
                } else if (priceAlone) {
                    priceString = priceAlone;
                }
                
                if (!priceString) return fullMatch;
                
                priceString = priceString.replace(',', '.');
                const originalPrice = parseFloat(priceString);

                if (!isNaN(originalPrice) && originalPrice > 0) {
                    const multipliedPrice = (originalPrice * GLOBAL_PRICE_MULTIPLIER).toFixed(2).replace('.', ',');
                    return `R$${multipliedPrice}`;
                }
                
                return fullMatch;
            });
            
            processedLines.push(line);
        }

        modifiedBody = processedLines.join('\n');
        modifiedBody = modifiedBody.replace(/\n\s*\n\s*\n+/g, '\n\n');
        modifiedBody = modifiedBody.replace(/^\s*\n+/, '').replace(/\n\s*$/, '');
    }

    // Handle media messages
    if (hasMedia) {
        logger.info({
            timestamp: new Date().toISOString(),
            source_message_id: message.key.id,
            status: 'media_detected',
        }, 'Message detected with media. Waiting for text confirmation...');

        // Se não tem texto, aguardar por mensagem de texto nos próximos 20 segundos
        if (!modifiedBody || modifiedBody.trim() === '') {
            logger.info(`Media without text detected. Waiting 20 seconds for accompanying text...`);
            
            // Armazenar mídia pendente
            pendingMediaMessages.set(message.key.id, {
                message: message,
                timestamp: Date.now(),
                processed: false
            });

            // Definir timeout para limpar após 20 segundos
            setTimeout(() => {
                const pendingMedia = pendingMediaMessages.get(message.key.id);
                if (pendingMedia && !pendingMedia.processed) {
                    logger.info(`No text received within 20 seconds. Discarding standalone media: ${message.key.id}`);
                    pendingMediaMessages.delete(message.key.id);
                }
            }, 20000);

            return; // Não processar mídia ainda
        }

        // Se tem texto junto com mídia, processar normalmente
        await processMediaWithText(message, messageContent, modifiedBody, actualSourceGroupName, mediaFilenames);
    } else if (modifiedBody && modifiedBody.trim() !== '') {
        // Verificar se há mídia pendente para este texto
        let foundPendingMedia = false;
        for (const [mediaId, pendingMedia] of pendingMediaMessages.entries()) {
            if (!pendingMedia.processed && (Date.now() - pendingMedia.timestamp) < 20000) {
                logger.info(`Found pending media ${mediaId} for text message. Processing together...`);
                pendingMedia.processed = true;
                
                // Processar mídia pendente com este texto
                const pendingMessageContent = pendingMedia.message.message;
                await processMediaWithText(pendingMedia.message, pendingMessageContent, modifiedBody, actualSourceGroupName, mediaFilenames);
                
                pendingMediaMessages.delete(mediaId);
                foundPendingMedia = true;
                break;
            }
        }

        // Se não há mídia pendente, enviar apenas texto
        if (!foundPendingMedia) {
            try {
                logger.info({ timestamp: new Date().toISOString(), source_message_id: message.key.id, status: 'attempting_send_text_only' }, 'Attempting to send text-only message.');
                await new Promise(resolve => setTimeout(resolve, MEDIA_SEND_DELAY_MS));
                await sock.sendMessage(targetGroup.id, { text: modifiedBody });
                logger.info('Text message (possibly modified) forwarded.');
            } catch (textError) {
                logger.error({
                    timestamp: new Date().toISOString(),
                    source_message_id: message.key.id,
                    author: message.key.participant || message.key.remoteJid,
                    source_group: actualSourceGroupName,
                    original_text: messageBody,
                    modified_text: modifiedBody,
                    media_filenames: mediaFilenames,
                    status: 'error',
                    error_message: `Failed to send text message: ${textError.message}`,
                }, 'Error sending text message.');
            }
        }
    }

    forwardedMessages.set(messageIdentifier, Date.now());

    logger.info({
        timestamp: new Date().toISOString(),
        source_message_id: message.key.id,
        author: message.key.participant || message.key.remoteJid,
        source_group: actualSourceGroupName,
        target_group: targetGroup.subject,
        original_text: messageBody,
        media_filenames: mediaFilenames,
        status: 'sent',
        error_message: null,
    }, 'Message fully processed and forwarded.');
}

// Função auxiliar para processar mídia com texto
async function processMediaWithText(message, messageContent, modifiedBody, actualSourceGroupName, mediaFilenames) {
    try {
        let mediaType;
        let mediaBuffer = null;

        // Try to download media with multiple approaches
        if (messageContent.imageMessage) {
            mediaType = 'image';
            try {
                // Try method 1: Direct download
                const stream = await downloadContentFromMessage(messageContent.imageMessage, 'image');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                mediaBuffer = Buffer.concat(chunks);
            } catch (e1) {
                try {
                    // Try method 2: Using message object
                    const stream = await downloadContentFromMessage(message, 'image');
                    const chunks = [];
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    mediaBuffer = Buffer.concat(chunks);
                } catch (e2) {
                    logger.warn(`Failed to download image: ${e1.message}, ${e2.message}`);
                }
            }
        } else if (messageContent.videoMessage) {
            mediaType = 'video';
            try {
                const stream = await downloadContentFromMessage(messageContent.videoMessage, 'video');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                mediaBuffer = Buffer.concat(chunks);
            } catch (e) {
                logger.warn(`Failed to download video: ${e.message}`);
            }
        } else if (messageContent.documentMessage) {
            mediaType = 'document';
            try {
                const stream = await downloadContentFromMessage(messageContent.documentMessage, 'document');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                mediaBuffer = Buffer.concat(chunks);
            } catch (e) {
                logger.warn(`Failed to download document: ${e.message}`);
            }
        }

        if (mediaBuffer) {
            const extension = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'pdf';
            const filename = `media-${message.key.id}.${extension}`;
            
            // Send media first
            await sock.sendMessage(
                targetGroup.id,
                {
                    [mediaType]: mediaBuffer,
                    caption: '', // No caption for media
                    fileName: filename
                }
            );

            mediaFilenames.push(filename);
            logger.info(`Media sent: ${filename}`);
            
            // If there's text, apply delay and send as separate message
            if (modifiedBody && modifiedBody.trim() !== '') {
                logger.info(`Applying ${MEDIA_SEND_DELAY_MS}ms delay before sending text message.`);
                await new Promise(resolve => setTimeout(resolve, MEDIA_SEND_DELAY_MS));
                await sock.sendMessage(targetGroup.id, { text: modifiedBody });
                logger.info('Text message sent after media.');
            }
        } else {
            // If download failed, try to forward the message
            logger.warn('Download failed, attempting to forward message instead');
            await sock.sendMessage(
                targetGroup.id,
                { 
                    forward: message 
                },
                { 
                    quoted: message 
                }
            );
            logger.info(`Message forwarded as fallback`);
            
            // Send processed text separately if exists
            if (modifiedBody && modifiedBody.trim() !== '') {
                await new Promise(resolve => setTimeout(resolve, MEDIA_SEND_DELAY_MS));
                await sock.sendMessage(targetGroup.id, { text: modifiedBody });
                logger.info('Processed text sent after forwarded message.');
            }
        }

    } catch (mediaError) {
        logger.error({
            timestamp: new Date().toISOString(),
            source_message_id: message.key.id,
            author: message.key.participant || message.key.remoteJid,
            source_group: actualSourceGroupName,
            original_text: modifiedBody,
            media_filenames: [],
            status: 'error',
            error_message: `Failed to process media: ${mediaError.message}`,
        }, 'Error handling media.');
    }
}

// Download media function for Baileys
async function downloadMedia(message) {
    try {
        const stream = await downloadContentFromMessage(
            message.message.imageMessage || message.message.videoMessage || message.message.documentMessage || message.message.audioMessage || message.message.stickerMessage, 
            'buffer'
        );
        
        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch (error) {
        logger.error(`Failed to download media: ${error.message}`);
        logger.error(`Message object: ${JSON.stringify(message.key)}`);
        logger.error(`Message content type: ${Object.keys(message.message || {})}`);
        return null;
    }
}

// Error handling
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    console.log('Erro não capturado:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    console.log('Promise rejeitada:', reason);
});

// Start the bot
connectToWhatsApp();
