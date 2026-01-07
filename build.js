const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Iniciando build do WhatsApp Forwarder...');

// Verificar se o pkg está instalado
try {
    execSync('pkg --version', { stdio: 'inherit' });
} catch (error) {
    console.log('📦 Instalando pkg...');
    execSync('npm install -g pkg', { stdio: 'inherit' });
}

// Criar pasta de build se não existir
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Copiar arquivos necessários
console.log('📁 Copiando arquivos necessários...');

// Copiar .env
if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', 'dist/.env');
}

// Copiar README
if (fs.existsSync('README_BAILEYS.md')) {
    fs.copyFileSync('README_BAILEYS.md', 'dist/README.md');
}

// Copiar pasta src para dist
if (!fs.existsSync('dist/src')) {
    fs.mkdirSync('dist/src');
}

// Copiar arquivo principal
fs.copyFileSync('src/index_baileys.js', 'dist/src/index_baileys.js');

// Build do executável
console.log('🏗️ Construindo executável Windows...');
try {
    execSync('pkg dist/src/index_baileys.js --targets node18-win-x64 --output dist/whatsapp-forwarder.exe', { 
        stdio: 'inherit',
        cwd: process.cwd()
    });
    console.log('✅ Build concluído com sucesso!');
    console.log('📂 Executável salvo em: dist/whatsapp-forwarder.exe');
    console.log('');
    console.log('📋 Para usar:');
    console.log('1. Copie a pasta dist para onde quiser executar');
    console.log('2. Execute whatsapp-forwarder.exe');
    console.log('3. Escaneie o QR Code no terminal');
    console.log('4. O bot iniciará automaticamente');
} catch (error) {
    console.error('❌ Erro no build:', error.message);
    process.exit(1);
}
