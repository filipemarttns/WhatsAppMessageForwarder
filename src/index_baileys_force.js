// Força saída e captura qualquer erro
process.stdout.write('INICIANDO...\n');
process.stderr.write('STDERR TEST...\n');

// Força flush imediato
if (process.stdout.write) process.stdout.write('');
if (process.stderr.write) process.stderr.write('');

try {
    process.stdout.write('Carregando dotenv...\n');
    require('dotenv').config();
    
    process.stdout.write('Carregando Baileys...\n');
    const baileys = require('@whiskeysockets/baileys');
    
    process.stdout.write('Baileys carregado com sucesso!\n');
    
    // Mantém aberto
    setInterval(() => {
        process.stdout.write('.');
    }, 1000);
    
} catch (error) {
    process.stderr.write('ERRO: ' + error.message + '\n');
    process.stderr.write('STACK: ' + error.stack + '\n');
    
    // Mantém aberto por 10 segundos
    let countdown = 10;
    const timer = setInterval(() => {
        process.stderr.write('Encerrando em ' + countdown + '...\n');
        countdown--;
        if (countdown <= 0) {
            clearInterval(timer);
            process.exit(1);
        }
    }, 1000);
}
