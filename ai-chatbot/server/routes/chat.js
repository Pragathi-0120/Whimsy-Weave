import { Router } from 'express';
import { streamChat, generateChat } from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const reply = await generateChat(messages);
    res.json({ reply, mock: !process.env.OPENAI_API_KEY });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

router.post('/stream', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await streamChat(
      messages,
      (chunk) => send('chunk', { chunk }),
      (full) => {
        send('done', { reply: full, mock: !process.env.OPENAI_API_KEY });
        res.end();
      },
      (err) => {
        send('error', { error: err.message || 'Stream failed' });
        res.end();
      }
    );
  } catch (err) {
    send('error', { error: err.message || 'Stream failed' });
    res.end();
  }
});

export default router;
