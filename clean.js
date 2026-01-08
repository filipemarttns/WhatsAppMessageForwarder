const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 LIMPANDO PROJETO PARA BUILD BAILEYS...');

// Pastas e arquivos para limpar
const cleanItems = [
    'node_modules',
    'dist',
    'package-lock.json',
    'yarn.lock',
    '.npm',
    '.cache',
    'logs/*.log',
    'wh_relay.log'
];

// Limpar cada item
cleanItems.forEach(item => {
    try {
        if (item.includes('*')) {
            // Para wildcards como logs/*.log
            const dir = path.dirname(item);
            const pattern = path.basename(item);
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    if (file.endsWith('.log')) {
                        fs.removeSync(path.join(dir, file));
                        console.log(`✅ Removido: ${path.join(dir, file)}`);
                    }
                });
            }
        } else if (fs.existsSync(item)) {
            fs.removeSync(item);
            console.log(`✅ Removido: ${item}`);
        }
    } catch (error) {
        console.log(`⚠️  Erro ao remover ${item}: ${error.message}`);
    }
});

// Limpar cache npm
try {
    console.log('🧹 Limpando cache npm...');
    execSync('npm cache clean --force', { stdio: 'inherit' });
    console.log('✅ Cache npm limpo');
} catch (error) {
    console.log(`⚠️  Erro ao limpar cache npm: ${error.message}`);
}

console.log('\n🎉 LIMPEZA CONCLUÍDA!');
console.log('Agora execute: npm install && npm run build:baileys');
