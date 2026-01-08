// Versão simplificada para debug de execução
console.log('=== INICIANDO BOT WHATSAPP ===');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('CWD:', process.cwd());
console.log('Script:', __filename);

try {
    require('dotenv').config();
    console.log('✅ dotenv carregado');
    
    const fs = require('fs');
    console.log('✅ fs carregado');
    
    // Verificar .env
    const envExists = fs.existsSync('.env');
    console.log('.env exists:', envExists);
    
    if (envExists) {
        const envContent = fs.readFileSync('.env', 'utf8');
        console.log('.env content length:', envContent.length);
        console.log('SOURCE_COMMUNITY_NAMES:', process.env.SOURCE_COMMUNITY_NAMES);
    }
    
    // Testar import do Baileys
    console.log('Carregando Baileys...');
    const baileys = require('@whiskeysockets/baileys');
    console.log('✅ Baileys carregado');
    console.log('Baileys version:', baileys.VERSION || 'unknown');
    
    // Testar QR Terminal
    const qrcode = require('qrcode-terminal');
    console.log('✅ qrcode-terminal carregado');
    
    // Testar Pino
    const pino = require('pino');
    console.log('✅ pino carregado');
    
    console.log('\n🎉 TODAS AS DEPENDÊNCIAS CARREGADAS COM SUCESSO!');
    console.log('📱 Iniciando WhatsApp...');
    
    // Manter aberto por 30 segundos para debug
    setTimeout(() => {
        console.log('\n⏰ Debug concluído. Encerrando...');
        process.exit(0);
    }, 30000);
    
} catch (error) {
    console.error('\n❌ ERRO FATAL:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    
    // Manter aberto por 15 segundos para mostrar erro
    setTimeout(() => {
        console.log('\n💀 Encerrando após erro...');
        process.exit(1);
    }, 15000);
}
