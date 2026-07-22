import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

// Configuração correta do Mercado Pago (nova versão)
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ BOT CONECTADO COM SUCESSO!');
        }

        if (!sock.authState?.creds?.registered) {
            try {
                const code = await sock.requestPairingCode('5511999999999'); // ← TROQUE PELO SEU NÚMERO
                console.log('\n🔑 CÓDIGO DE PAREAMENTO: ' + code);
            } catch (e) {
                console.log('Erro ao gerar código:', e);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message?.conversation) {
            const texto = msg.message.conversation.toLowerCase().trim();
            const from = msg.key.remoteJid;

            if (texto === 'ping') {
                await sock.sendMessage(from, { text: '🏓 Pong! Bot online!' });
            } 
            else if (texto === 'pagar') {
                try {
                    const preference = new Preference(client);
                    const response = await preference.create({
                        body: {
                            items: [
                                {
                                    title: 'Produto Teste Bot',
                                    quantity: 1,
                                    unit_price: 29.90
                                }
                            ]
                        }
                    });

                    await sock.sendMessage(from, { 
                        text: `💰 Link de pagamento:\n${response.init_point}` 
                    });
                } catch (e) {
                    console.error(e);
                    await sock.sendMessage(from, { text: '❌ Erro ao gerar pagamento.' });
                }
            } 
            else {
                await sock.sendMessage(from, { 
                    text: '👋 Comandos disponíveis:\n• ping\n• pagar' 
                });
            }
        }
    });
}

connectToWhatsApp().catch(console.error);
