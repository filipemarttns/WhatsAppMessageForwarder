console.log('=== BOT WHATSAPP MINIMAL ===');

// Simplesmente escreve e mantém aberto
console.log('Iniciando bot...');
console.log('Pressione Ctrl+C para encerrar');

// Mantém o processo aberto
setInterval(() => {
    const now = new Date();
    console.log(`Bot ativo: ${now.toLocaleTimeString()}`);
}, 5000);

console.log('Bot iniciado com sucesso!');
