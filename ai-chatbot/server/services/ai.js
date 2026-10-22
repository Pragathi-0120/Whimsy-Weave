import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are Whimsy Assistant, the ecommerce chatbot for Whimsy & Weave, a handmade crochet store.
Your job is to help customers with product discovery, gift recommendations, pricing guidance, custom crochet orders, order tracking, delivery, payment demo flow, returns, and contact details.
Keep the tone warm, clear, and shop-focused. Avoid robotic phrases like "As an AI language model" or "Certainly!".
If the user asks something outside the shop context, gently redirect them back to Whimsy & Weave support.
Use markdown when helpful, but keep replies concise enough for a shopping chat widget.
Contact details: pragathiprakash79@gmail.com and 9448015505.`;

let openaiClient = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function buildMockReply(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const text = (last?.content || '').trim();
  const lower = text.toLowerCase();

  if (!text) {
    return "Hi! I can help you choose crochet gifts, understand custom orders, track orders, and find Whimsy & Weave contact details.";
  }

  if (/^(hi|hello|hey|good morning|good evening)/.test(lower)) {
    return "Hello! Welcome to Whimsy & Weave. I can help with product suggestions, prices, custom crochet orders, tracking, delivery, and support details.";
  }

  if (/thank|thanks|thx/.test(lower)) {
    return "You're very welcome! Happy to help with anything related to Whimsy & Weave.";
  }

  if (/product|sell|shop|catalog|available/.test(lower)) {
    return `Whimsy & Weave sells handmade crochet:

- Bouquets and bouquet blankets
- Plushies and crochet dolls
- Wearables like cardigans, tops, coverups, and mufflers
- Kids items like blankets, dresses, footwear, and cardigans
- Accessories like keychains, bag charms, hair clips, bows, and car hangings

Tell me your budget or occasion and I can suggest a good category.`;
  }

  if (/track|tracking|where is my order|order status|delivery status/.test(lower)) {
    const tracking = text.match(/\bWW[-\s]?\d{6,8}[-\s]?[A-Z0-9]{4,8}\b/i)?.[0]?.replace(/\s+/g, '').toUpperCase();
    if (tracking) {
      return `You can track your order here: tracking.html?tracking=${encodeURIComponent(tracking)}\n\nThe tracking page shows Order Confirmed, Preparing Your Cozy Package, Shipped, Out for Delivery, and Delivered.`;
    }
    return 'To track an order, open tracking.html or share your tracking number. Tracking numbers usually look like WW-20260529-ABC123.';
  }

  if (/price|cost|rate|how much/.test(lower)) {
    if (/500|rs\.?\s*500|₹\s*500/.test(lower)) {
      return 'For a budget under Rs. 500, I would suggest keychains, bag charms, hair clips, bows, scrunchies, small plushies, or cute car hangings.';
    }

    return `Here is a useful price guide:

- Small accessories: about Rs. 120 to Rs. 399
- Bouquets: about Rs. 649 to Rs. 1,899
- Plushies and dolls: about Rs. 350 to Rs. 600
- Wearables: about Rs. 899 to Rs. 3,799
- Premium bouquet blankets: about Rs. 4,200 and above

For an exact item price, ask with the product name.`;
  }

  if (/gift|birthday|anniversary|graduation|valentine|girl|boy|woman|man|mother|father|wife|husband|friend|girlfriend|boyfriend/.test(lower)) {
    if (/man|boy|father|dad|husband|boyfriend|him/.test(lower)) {
      return `For men or boys, good crochet gift ideas are:

- Character plushies or dolls
- Car hanging charms
- Keychains and bag charms
- Mufflers or wearable crochet pieces
- Headphone charms

Share a budget and I can narrow it down.`;
    }

    if (/woman|girl|mother|mom|wife|girlfriend|her/.test(lower)) {
      return `For women or girls, good crochet gift ideas are:

- Crochet flower bouquets
- Hair bows, clips, scrunchies, or parandas
- Cardigans, tops, coverups, or mufflers
- Cute bag charms and keychains
- Custom crochet pieces in favorite colors`;
    }

    return `For gifts, I would suggest:

- Crochet bouquets for romantic or elegant gifting
- Plushies or dolls for cute keepsakes
- Keychains and bag charms for budget-friendly gifts
- Graduation dolls or ducks for achievement gifts
- Custom orders if you want specific colors or initials`;
  }

  if (/invoice|bill/.test(lower)) {
    return 'You can download or print the invoice from the tracking page. Open tracking.html with your order ID or tracking number, then use the Download Invoice button.';
  }

  if (/cancel|refund|return/.test(lower)) {
    return 'For cancellations, returns, or refunds, contact Whimsy & Weave with your order ID or tracking number at pragathiprakash79@gmail.com or 9448015505.';
  }

  if (/custom|personalized|personalised/.test(lower)) {
    return 'Yes, custom orders are available. Customers can choose colors, yarn style, upload inspiration, and add notes or initials from the Custom orders page.';
  }

  if (/delivery|shipping|order/.test(lower)) {
    return 'Orders are handmade with care, and the home page mentions complimentary cozy shipping on handcrafted orders. For exact order timing, contact the shop directly.';
  }

  if (/contact|phone|email|call/.test(lower)) {
    return 'You can contact Whimsy & Weave at pragathiprakash79@gmail.com or 9448015505.';
  }

  if (/code|javascript|python|react|bug|error|function/.test(lower)) {
    return 'I am designed for Whimsy & Weave customer support, so I can help with crochet products, gift suggestions, custom orders, tracking, payments, and contact details.';
  }

  return 'I can help with Whimsy & Weave products, gifts, custom crochet orders, prices, tracking, delivery, and contact details. Please ask me about any of those and I will guide you.';
}

export async function streamChat(messages, onChunk, onDone, onError) {
  const client = getClient();
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content }))
  ];

  if (!client) {
    const reply = buildMockReply(messages);
    const words = reply.split(/(\s+)/);
    for (const word of words) {
      onChunk(word);
      await new Promise((r) => setTimeout(r, 18 + Math.random() * 35));
    }
    onDone(reply);
    return;
  }

  try {
    const stream = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: apiMessages,
      stream: true,
      temperature: 0.78,
      max_tokens: 2048
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    }
    onDone(full);
  } catch (err) {
    onError(err);
  }
}

export async function generateChat(messages) {
  let result = '';
  let capturedError = null;

  await streamChat(
    messages,
    (chunk) => {
      result += chunk;
    },
    () => {},
    (err) => {
      capturedError = err;
    }
  );

  if (capturedError) throw capturedError;
  return result;
}
