const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🏗️ BUILD BAILEYS - Gerando executável Node.js puro...');

// Verificar se o pkg está instalado
try {
    execSync('pkg --version', { stdio: 'pipe' });
    console.log('✅ pkg encontrado');
} catch (error) {
    console.log('📦 Instalando pkg...');
    execSync('npm install -g pkg', { stdio: 'inherit' });
}

// Criar pasta dist se não existir
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
}

// Criar pkg.json para configuração específica do build
const pkgConfig = {
    name: "whatsapp-forwarder",
    version: "3.0.0",
    main: "src/index_baileys_dynamic.js",
    bin: "src/index_baileys_dynamic.js",
    pkg: {
        scripts: [
            "src/**/*.js"
        ],
        assets: [
            "package.json",
            "node_modules/**/*.js",
            "node_modules/**/*.json",
            "node_modules/**/*.node"
        ],
        targets: [
            "node18-win-x64"
        ],
        outputPath: "dist",
        ignore: [
            "auth_info_baileys/**/*",
            ".env*",
            "logs/**/*",
            "*.log",
            "src/index.js",
            "src/index_baileys_debug.js",
            "build.js",
            "build.bat",
            "run.*",
            "test*.js",
            "requirements.txt",
            ".git/**/*",
            "node_modules/puppeteer/**/*",
            "node_modules/whatsapp-web.js/**/*"
        ]
    }
};

fs.writeFileSync('dist/pkg.json', JSON.stringify(pkgConfig, null, 2));
console.log('✅ Configuração pkg criada');

// Copiar arquivos essenciais para dist (não para o bundle)
console.log('📁 Preparando arquivos de runtime...');

// Garantir que as pastas necessárias existam no runtime
const runtimeFolders = ['auth_info_baileys', 'logs'];
runtimeFolders.forEach(folder => {
    if (!fs.existsSync(path.join('dist', folder))) {
        fs.mkdirSync(path.join('dist', folder), { recursive: true });
        console.log(`✅ Pasta ${folder} criada para runtime`);
    }
});

// Copiar .env se existir (como template)
if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', 'dist/.env.example');
    console.log('✅ .env copiado como .env.example');
}

// Build do executável
console.log('🔨 Construindo executável com pkg...');
try {
    const buildCommand = `pkg dist/pkg.json --targets node18-win-x64 --output dist/whatsapp-forwarder.exe`;
    console.log(`Executando: ${buildCommand}`);
    
    execSync(buildCommand, { 
        stdio: 'inherit',
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    console.log('\n🎉 BUILD CONCLUÍDO COM SUCESSO!');
    console.log('📂 Executável gerado: dist/whatsapp-forwarder.exe');
    console.log('');
    console.log('📋 INSTRUÇÕES DE USO:');
    console.log('1. Copie toda a pasta dist para onde deseja executar');
    console.log('2. Renomeie .env.example para .env e configure suas variáveis');
    console.log('3. Execute whatsapp-forwarder.exe');
    console.log('4. Escaneie o QR Code no terminal');
    console.log('5. O bot iniciará automaticamente');
    console.log('');
    console.log('📁 Estrutura necessária para runtime:');
    console.log('dist/');
    console.log('├── whatsapp-forwarder.exe');
    console.log('├── .env (configurado)');
    console.log('├── auth_info_baileys/ (será criado automaticamente)');
    console.log('└── logs/ (será criado automaticamente)');
    
} catch (error) {
    console.error('\n❌ ERRO NO BUILD:', error.message);
    console.error('\n🔍 DIANÓSTICO:');
    
    // Verificar problemas comuns
    if (error.message.includes('Cannot find module')) {
        console.log('- Execute npm install antes do build');
    }
    if (error.message.includes('ENOENT')) {
        console.log('- Verifique se src/index_baileys.js existe');
    }
    if (error.message.includes('permission')) {
        console.log('- Execute como administrador ou verifique permissões');
    }
    
    process.exit(1);
}
