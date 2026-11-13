import { Router } from 'express';

const router = Router();

router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

router.post('/webhook', async (req, res) => {
    try {
        const entries = req.body.entry || [];

        for (const entry of entries) {
            for (const change of entry.changes || []) {
                const messages = change.value.messages || [];

                for (const message of messages) {
                    if (message.type !== 'text') continue;

                    const numero = message.from;
                    const texto = message.text.body.toLowerCase();

                    let resposta = '';

                    if (texto.includes('oi') || texto.includes('olá')) {
                        resposta = 'Olá! Seja bem-vindo à Sorriso Pleno! 😁 Como podemos ajudar?';
                    } else if (texto.includes('consulta')) {
                        resposta = 'Claro! Gostaria de agendar uma consulta?';
                    } else {
                        resposta = 'Obrigado por entrar em contato com a Sorriso Pleno! Em breve nossa equipe poderá ajudar você.';
                    }

                    const response = await fetch(
                        `https://graph.facebook.com/v27.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                to: numero,
                                type: 'text',
                                text: {
                                    body: resposta
                                }
                            })
                        }
                    );

                    const resultado = await response.json();
                    console.log('Resposta enviada:', resultado);
                }
            }
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro no atendimento WhatsApp:', error);
        return res.sendStatus(500);
    }
});

router.get('/teste', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'Módulo WhatsApp funcionando!',
        projeto: 'Easy Planet'
    });
});

export default router;