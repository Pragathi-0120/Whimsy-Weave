import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000
});

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

/**
 * Stream chat completion via Server-Sent Events style parsing.
 */
export async function streamChat(messages, { onChunk, onDone, onError, signal }) {
  let response;

  try {
    response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    await streamLocalReply(messages, { onChunk, onDone, signal });
    return;
  }

  if (!response.ok) {
    await streamLocalReply(messages, { onChunk, onDone, signal });
    return;
  }

  if (!response.body) {
    await streamLocalReply(messages, { onChunk, onDone, signal });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let dataLine = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7);
        if (line.startsWith('data: ')) dataLine = line.slice(6);
      }

      if (!dataLine) continue;

      try {
        const data = JSON.parse(dataLine);
        if (event === 'chunk') onChunk?.(data.chunk);
        if (event === 'done') {
          doneReceived = true;
          onDone?.(data);
        }
        if (event === 'error') onError?.(new Error(data.error));
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (!doneReceived) onDone?.();
}

export async function sendChat(messages) {
  const { data } = await api.post('/chat', { messages });
  return data;
}

function buildLocalReply(messages) {
  const last = [...messages].reverse().find((message) => message.role === 'user');
  const text = (last?.content || '').trim();
  const lower = text.toLowerCase();

  if (!text) {
    return 'Hi! I can help you choose crochet gifts, understand custom orders, track orders, and find Whimsy & Weave contact details.';
  }

  if (/^(hi|hello|hey|good morning|good evening)/.test(lower)) {
    return 'Hello! Welcome to Whimsy & Weave. I can help with product suggestions, prices, custom crochet orders, tracking, delivery, and support details.';
  }

  if (/track|tracking|order status|where is my order|delivery status/.test(lower)) {
    const tracking = text.match(/\bWW[-\s]?\d{6,8}[-\s]?[A-Z0-9]{4,8}\b/i)?.[0]?.replace(/\s+/g, '').toUpperCase();
    if (tracking) {
      return `You can track this order on the tracking page using **${tracking}**. The usual stages are Order Confirmed, Preparing Your Cozy Package, Shipped, Out for Delivery, and Delivered.`;
    }
    return 'Please enter your tracking number or order ID on the tracking page. Demo tracking numbers usually look like **WW-20260529-ABC123**.';
  }

  if (/custom|personalized|personalised|colour|color|initial|name/.test(lower)) {
    return 'Yes, Whimsy & Weave supports custom crochet orders. Customers can choose colors, yarn style, product type, upload inspiration, and add notes such as initials or special design requests.';
  }

  if (/price|cost|rate|budget|under|how much/.test(lower)) {
    if (/500|rs\.?\s*500|₹\s*500/.test(lower)) {
      return 'For a budget under **Rs. 500**, I would suggest keychains, bag charms, hair clips, bows, scrunchies, small plushies, or cute car hangings.';
    }
    return 'Approximate ranges: small accessories Rs. 120-399, plushies Rs. 350-600, bouquets Rs. 649-1,899, wearables Rs. 899-3,799, and premium bouquet blankets around Rs. 4,200+.';
  }

  if (/gift|birthday|anniversary|friend|girlfriend|boyfriend|mother|mom|father|dad|wife|husband|girl|boy/.test(lower)) {
    return 'For gifting, the safest recommendations are crochet bouquets for elegant gifts, plushies for cute keepsakes, keychains or bag charms for budget gifts, and custom orders when the customer wants favorite colors or initials.';
  }

  if (/product|catalog|catalogue|sell|available|category|categories/.test(lower)) {
    return 'Whimsy & Weave offers handmade crochet bouquets, plushies, dolls, wearables, kids items, keychains, bag charms, hair accessories, car hangings, and custom crochet pieces.';
  }

  if (/delivery|shipping|cod|payment|pay/.test(lower)) {
    return 'For the academic demo, payments are shown in demo mode. Orders can use card/UPI demo flow or cash on delivery depending on the checkout option. Delivery and tracking details are shown after order placement.';
  }

  if (/contact|email|phone|call|support|help/.test(lower)) {
    return 'You can contact Whimsy & Weave at **pragathiprakash79@gmail.com** or **9448015505**.';
  }

  if (/return|refund|cancel/.test(lower)) {
    return 'For cancellation, return, or refund help, the customer should contact support with the order ID or tracking number so the shop can verify the order.';
  }

  return `I can help with Whimsy & Weave products, gifts, custom crochet orders, prices, tracking, delivery, and contact details. For your question, I would start by checking the product category or order details, then suggest the best next step.`;
}

async function streamLocalReply(messages, { onChunk, onDone, signal }) {
  const reply = buildLocalReply(messages);
  const chunks = reply.split(/(\s+)/);

  for (const chunk of chunks) {
    if (signal?.aborted) {
      const error = new DOMException('Aborted', 'AbortError');
      throw error;
    }
    onChunk?.(chunk);
    await new Promise((resolve) => setTimeout(resolve, 12));
  }

  onDone?.({ reply, local: true });
}

export default api;
