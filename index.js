import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import MercadoPago from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

const mp = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN });

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
            const code = await sock.requestPairingCode('5511999999999'); // TROQUE PELO SEU NÚMERO
            console.log('\n🔑 CÓDIGO DE PAREAMENTO: ' + code);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message?.conversation) {
            const texto = msg.message.conversation.toLowerCase().trim();
            const from = msg.key.remoteJid;

            if (texto === 'ping') {
                await sock.sendMessage(from, { text: '🏓 Pong!' });
            } else if (texto === 'pagar') {
                const preference = await mp.preferences.create({
                    items: [{ title: 'Teste Bot', quantity: 1, unit_price: 29.90 }]
                });
                await sock.sendMessage(from, { text: `💰 Pague aqui: ${preference.body.init_point}` });
            } else {
                await sock.sendMessage(from, { text: 'Comandos: ping ou pagar' });
            }
        }
    });
}

connectToWhatsApp().catch(console.error);
