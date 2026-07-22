import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

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

        if (connection === 'close') {
            let shouldReconnect = true;
            if (lastDisconnect?.error) {
                const boomError = lastDisconnect.error;
                if (boomError?.output?.statusCode === DisconnectReason.loggedOut) {
                    shouldReconnect = false;
                }
            }
            if (shouldReconnect) {
                console.log('🔄 Reconectando em 5 segundos...');
                setTimeout(connectToWhatsApp, 5000);
            }
        }

        // Gera código de pareamento
        if (!sock.authState?.creds?.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode('5544999943206');
                    console.log('\n🔥 CÓDIGO DE PAREAMENTO:');
                    console.log(code);
                    console.log('\nUse no WhatsApp → Dispositivos Vinculados → Vincular com código');
                } catch (err) {
                    console.log('❌ Erro ao gerar código:', err.message);
                }
            }, 10000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message?.conversation) {
            const texto = msg.message.conversation.toLowerCase().trim();
            const from = msg.key.remoteJid;

            if (texto === 'ping') {
                await sock.sendMessage(from, { text: '🏓 Pong! Bot online!' });
            } else if (texto === 'pagar') {
                try {
                    const preference = new Preference(client);
                    const response = await preference.create({
                        body: {
                            items: [{ title: 'Teste Bot WhatsApp', quantity: 1, unit_price: 29.90 }]
                        }
                    });
                    await sock.sendMessage(from, { text: `💰 Link para pagar:\n${response.init_point}` });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Erro ao gerar pagamento.' });
                }
            } else {
                await sock.sendMessage(from, { text: 'Comandos: *ping* ou *pagar*' });
            }
        }
    });
}

connectToWhatsApp().catch(console.error);
