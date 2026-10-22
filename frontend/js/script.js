/* =========================
   HOME PAGE STATE
========================= */

const state = {
  products: [],
  filteredProducts: [],
  cart: [],
  wishlist: new Set(),
  activeSlide: 0,
  isHovered: false,
  autoplayId: null
};

const API_BASE = ['8081', '8080', '5500'].includes(window.location.port)
  ? 'http://127.0.0.1:5000'
  : '';

function isUserLoggedIn() {
  return Boolean(localStorage.getItem('authToken') && localStorage.getItem('isLoggedIn') === 'true');
}

function redirectToLoginAfterCart() {
  if (window.whimsyAuth?.promptLoginRequired) {
    window.whimsyAuth.promptLoginRequired(
      'cart.html',
      'Please login or create an account before opening your cart. Your selected items will stay saved.'
    );
    return;
  }

  localStorage.setItem('redirectAfterLogin', 'cart.html');
  window.location.href = 'login.html';
}

function setupCartAuthLinks() {
  document.querySelectorAll('a[href$="cart.html"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (isUserLoggedIn()) return;
      event.preventDefault();
      redirectToLoginAfterCart();
    });
  });
}

/* =========================
   DOM REFERENCES
========================= */

const refs = {
  track: document.getElementById('product-track'),
  dots: document.getElementById('slider-dots'),

  cartCount: document.getElementById('cart-count'),
  wishlistCount: document.getElementById('wishlist-count'),

  filter: document.getElementById('product-filter'),

  quickViewModal:
    document.getElementById('quick-view-modal'),

  quickViewTitle:
    document.getElementById('quick-view-title'),

  quickViewDescription:
    document.getElementById('quick-view-description'),

  quickViewCategory:
    document.getElementById('quick-view-category'),

  quickViewPrice:
    document.getElementById('quick-view-price'),

  quickViewCart:
    document.getElementById('quick-view-cart'),

  quickViewWishlist:
    document.getElementById('quick-view-wishlist'),

  closeQuickView:
    document.getElementById('close-quick-view'),

  testimonialSlider:
    document.getElementById('testimonial-slider'),

  testimonialDots:
    document.getElementById('testimonial-dots'),

  newsletterForm:
    document.getElementById('newsletter-form'),

  newsletterEmail:
    document.getElementById('newsletter-email'),

  navToggle:
    document.querySelector('.nav-toggle'),

  mobileDrawer:
    document.querySelector('.mobile-drawer'),

  mainNavLinks:
    document.querySelectorAll(
      '.main-nav a, .drawer-nav a'
    ),

  searchInput:
    document.getElementById('search-input'),

  header:
    document.querySelector('.site-header')
};

/* =========================
   TESTIMONIALS
========================= */

const testimonials = [
  {
    name: 'Maya Silver',
    rating: 5,
    text: 'The crochet bouquet felt magical the moment it arrived.',
    quote: 'Absolutely dreamy.'
  },

  {
    name: 'Amelia Hart',
    rating: 5,
    text: 'Beautiful handmade quality and cozy aesthetic.',
    quote: 'My favorite crochet shop.'
  },

  {
    name: 'Lila June',
    rating: 5,
    text: 'The plushie felt handcrafted with love.',
    quote: 'Soft, cozy, premium.'
  }
];

/* =========================
   HELPERS
========================= */

function formatPrice(value) {
  return `₹${value}`;
}

function createStars(rating = 5) {
  const filled = Math.round(rating);
  return (
    '★'.repeat(filled) +
    '☆'.repeat(5 - filled)
  );
}

/* =========================
   STORAGE
========================= */

function buildCartItem(product, quantity = 1) {
  return {
    id: product.id,
    title: product.title || product.name || 'Handmade Item',
    image: product.image || './img/placeholder.svg',
    price: Number(product.price) || 0,
    category: product.category || '',
    quantity: Math.max(1, Number(quantity) || 1)
  };
}

function normalizeCartEntry(entry) {
  if (entry && typeof entry === 'object' && entry.id != null) {
    return {
      id: entry.id,
      title: entry.title || entry.name || 'Handmade Item',
      image: entry.image || './img/placeholder.svg',
      price: Number(entry.price) || 0,
      category: entry.category || '',
      quantity: Math.max(1, Number(entry.quantity) || 1)
    };
  }

  const id = Number(entry);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    title: 'Handmade Item',
    image: './img/placeholder.svg',
    price: 0,
    category: '',
    quantity: 1
  };
}

function mergeCartItems(items) {
  const grouped = {};

  (items || []).forEach((item) => {
    const normalized = normalizeCartEntry(item);
    if (!normalized) return;

    const key = String(normalized.id);

    // collapse duplicates so quantity can never be inflated by stale localStorage
    if (!grouped[key]) {
      grouped[key] = {
        ...normalized,
        quantity: 1
      };
    }
  });

  return Object.values(grouped);
}

function dedupeAndCleanCartStorage() {
  const rawPrimary = (() => {
    try { return JSON.parse(localStorage.getItem('whimsyCart') || '[]'); } catch { return []; }
  })();

  const rawFallback = (() => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  })();

  const merged = mergeCartItems([
    ...(Array.isArray(rawPrimary) ? rawPrimary : []),
    ...(Array.isArray(rawFallback) ? rawFallback : [])
  ]);

  state.cart = merged;
  saveStorage();
}

function refreshCartFromProducts() {
  if (!state.products.length) return;
  state.cart = mergeCartItems(state.cart);
  saveStorage();
}

function saveStorage() {
  localStorage.setItem('whimsyCart', JSON.stringify(state.cart));
  localStorage.setItem('cart', JSON.stringify(state.cart));
  localStorage.setItem('whimsyWishlist', JSON.stringify([...state.wishlist]));
}

function loadStorage() {
  let cart = [];
  try {
    cart = JSON.parse(
      localStorage.getItem('whimsyCart')
      || localStorage.getItem('cart')
      || '[]'
    );
  } catch { cart = []; }

  const wishlist = (() => {
    try { return JSON.parse(localStorage.getItem('whimsyWishlist') || '[]'); } catch { return []; }
  })();

  // Cleanup stale duplicates from both keys before we compute counters.
  try { dedupeAndCleanCartStorage(); } catch {}

  state.cart = mergeCartItems(Array.isArray(cart) ? cart : []);

  state.wishlist = new Set(
    Array.isArray(wishlist)
      ? wishlist.map((item) =>
          item && typeof item === 'object'
            ? Number(item.id)
            : Number(item)
        ).filter(Number.isFinite)
      : []
  );

  updateCounters();
}

function updateCounters() {
  if (refs.cartCount) {
    refs.cartCount.textContent = state.cart.reduce(
      (total, item) => total + (Number(item.quantity) || 0),
      0
    );
  }

  if (refs.wishlistCount) {
    refs.wishlistCount.textContent = state.wishlist.size;
  }
}

/* =========================
   PRODUCT CARD
========================= */

function renderProductCard(product) {
  const isWish = state.wishlist.has(product.id);
  const isCart = state.cart.some((item) => String(item.id) === String(product.id));

  return `
    <article
      class="product-card"
      data-id="${product.id}"
      style="--tone-1:#f7e2d6;--tone-2:#ddb7a0;">

      <div class="product-figure">
        <img src="${product.image}" alt="${product.title}" class="product-image">
      </div>

      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3>${product.title}</h3>
        <p>${product.description}</p>
      </div>

      <div class="product-meta">
        <span class="product-price">${formatPrice(product.price)}</span>
        <span class="product-rating">${createStars(product.rating || 5)}</span>
      </div>

      <div class="product-actions">
        <button class="button button-secondary quick-view-button" data-id="${product.id}">Quick View</button>
        <div class="action-buttons">
          <button class="icon-action wishlist-action ${isWish ? 'active' : ''}" data-id="${product.id}">♥</button>
          <button class="button button-sm cart-action ${isCart ? 'added' : ''}" data-id="${product.id}">
            ${isCart ? 'Add More' : 'Add To Cart'}
          </button>
          ${isCart ? `
            <button class="button button-sm cart-remove" data-id="${product.id}">Remove</button>
          ` : ''}
        </div>
      </div>

    </article>
  `;
}

/* =========================
   RENDER PRODUCTS
========================= */

function renderProducts(products) {
  if (!refs.track) return;

  refs.track.innerHTML = '';

  let featuredProducts = products
    .filter((p) => p.featured === true || p.is_featured === true || p.isFeatured === true)
    .slice(0, 6);

  if (!featuredProducts.length) featuredProducts = products.slice(0, 6);

  if (!featuredProducts.length) {
    refs.track.innerHTML = `<p class="error-copy">No products found ✨</p>`;
    return;
  }

  refs.track.innerHTML = featuredProducts.map(renderProductCard).join('');

  renderDots(featuredProducts.length);
  attachProductListeners();
  resetSliderPosition();
}

/* =========================
   CART REMOVE (HOMEPAGE)
========================= */

function handleRemoveFromCart(event) {
  const id = Number(event.currentTarget.dataset.id);

  state.cart = state.cart.filter((item) => String(item.id) !== String(id));
  // cleanup storage + badge
  saveStorage();
  updateCounters();

  const featuredProducts = state.filteredProducts.slice(0, 6);
  renderProducts(featuredProducts);
}

/* =========================
   PRODUCT EVENTS
========================= */

function attachProductListeners() {
  refs.track.querySelectorAll('.wishlist-action').forEach((button) => {
    button.addEventListener('click', handleWishlist);
  });

  refs.track.querySelectorAll('.cart-action').forEach((button) => {
    button.addEventListener('click', handleCart);
  });

  refs.track.querySelectorAll('.cart-remove').forEach((button) => {
    button.addEventListener('click', handleRemoveFromCart);
  });

  refs.track.querySelectorAll('.quick-view-button').forEach((button) => {
    button.addEventListener('click', openQuickView);
  });
}

function handleWishlist(event) {
  const id = Number(event.currentTarget.dataset.id);

  if (state.wishlist.has(id)) state.wishlist.delete(id);
  else state.wishlist.add(id);

  saveStorage();
  updateCounters();

  const featuredProducts = state.filteredProducts.slice(0, 6);
  renderProducts(featuredProducts);
}

function handleCart(event) {
  const id = Number(event.currentTarget.dataset.id);

  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product) {
    console.error('Cart product missing:', id);
    return;
  }

  const existingIndex = state.cart.findIndex((item) => String(item.id) === String(id));

  if (existingIndex >= 0) {
    state.cart[existingIndex].quantity += 1;
  } else {
    state.cart.push(buildCartItem(product, 1));
  }

  saveStorage();
  updateCounters();

  const featuredProducts = state.filteredProducts.slice(0, 6);
  renderProducts(featuredProducts);
}

/* =========================
   QUICK VIEW
========================= */

function openQuickView(event) {
  const id = event.currentTarget.dataset.id;

  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product) {
    console.error('Quick View Product Missing');
    return;
  }

  refs.quickViewTitle.textContent = product.title || 'Handmade Crochet Piece';
  refs.quickViewDescription.textContent = product.description || 'Luxury crochet treasure handmade with love.';
  refs.quickViewCategory.textContent = product.category || 'Crochet';
  refs.quickViewPrice.textContent = formatPrice(product.price || 0);

  const modalImage = document.querySelector('#quick-view-modal .modal-image');
  if (modalImage) {
    modalImage.innerHTML = `
      <img src="${product.image}" alt="${product.title}" class="modal-product-image" />
    `;
  }

  refs.quickViewCart.dataset.id = product.id;
  refs.quickViewWishlist.dataset.id = product.id;

  refs.quickViewModal.classList.add('visible');
  refs.quickViewModal.setAttribute('aria-hidden', 'false');
}

function closeQuickView() {
  refs.quickViewModal.classList.remove('visible');
  refs.quickViewModal.setAttribute('aria-hidden', 'true');
}

/* =========================
   FILTER / SLIDER
========================= */

function filterProducts() {
  const query = (refs.searchInput?.value || refs.filter?.value || '')
    .trim()
    .toLowerCase();

  state.filteredProducts = state.products.filter((product) => {
    return (
      product.title?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  });

  renderProducts(state.filteredProducts);
}

function renderDots(count) {
  if (!refs.dots) return;
  refs.dots.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.className = 'dot-button';
    if (i === 0) dot.classList.add('active');

    dot.addEventListener('click', () => {
      state.activeSlide = i;
      updateSlider();
    });

    refs.dots.appendChild(dot);
  }
}

function updateSlider() {
  const cards = refs.track.querySelectorAll('.product-card');
  if (!cards.length) return;

  const cardWidth = cards[0].offsetWidth + 24;
  refs.track.scrollTo({ left: state.activeSlide * cardWidth, behavior: 'smooth' });
}

function resetSliderPosition() {
  state.activeSlide = 0;
  updateSlider();
}

function nextSlide() {
  if (!state.filteredProducts.length) return;
  state.activeSlide = (state.activeSlide + 1) % state.filteredProducts.length;
  updateSlider();
}

function resetAutoplay() {
  clearInterval(state.autoplayId);
  state.autoplayId = setInterval(() => {
    if (!state.isHovered) nextSlide();
  }, 5000);
}

function buildTestimonials() {
  if (!refs.testimonialSlider) return;

  refs.testimonialSlider.innerHTML = testimonials.map((item) => `
    <article class="testimonial-slide active">
      <p>"${item.text}"</p>
      <strong>${item.name}</strong>
      <span>${createStars(item.rating)}</span>
      <small>${item.quote}</small>
    </article>
  `).join('');
}

function handleHeaderScroll() {
  if (!refs.header) return;
  refs.header.classList.toggle('scrolled', window.scrollY > 24);
}

/* =========================
   FETCH PRODUCTS
========================= */

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/api/products/?limit=200`);
    if (!response.ok) throw new Error(`Failed to load products: ${response.status} ${response.statusText}`);

    const data = await response.json();

    let productsArray = [];
    if (Array.isArray(data)) productsArray = data;
    else if (Array.isArray(data.products)) productsArray = data.products;
    else if (Array.isArray(data.data)) productsArray = data.data;

    state.products = productsArray.map((product) => ({
      ...product,
      id: product.id,
      title: product.title || product.name || '',
      price: Number(product.price) || 0,
      category: product.category || '',
      image: product.image || '',
      description: product.description || '',
      rating: Number(product.rating) || 5
    }));

    state.filteredProducts = [...state.products];
    refreshCartFromProducts();
    renderProducts(state.filteredProducts);
    resetAutoplay();
  } catch (error) {
    console.error('Product loading error:', error);
    if (refs.track) {
      refs.track.innerHTML = `
        <p class="error-copy">
          Unable to load products.
        </p>
      `;
    }
  }
}

/* =========================
   INIT
========================= */

function initPage() {
  setupCartAuthLinks();
  loadStorage();
  buildTestimonials();

  if (refs.quickViewModal) {
    refs.quickViewClose?.addEventListener('click', closeQuickView);
    refs.quickViewModal.addEventListener('click', (event) => {
      if (event.target === refs.quickViewModal) closeQuickView();
    });

    refs.quickViewCart?.addEventListener('click', (event) => {
      // reuse cart handler
      handleCart(event);
      closeQuickView();
    });

    refs.quickViewWishlist?.addEventListener('click', (event) => {
      handleWishlist(event);
      closeQuickView();
    });
  }

  loadProducts();

  if (refs.searchInput) refs.searchInput.addEventListener('input', filterProducts);
  if (refs.filter) refs.filter.addEventListener('input', filterProducts);

  window.addEventListener('scroll', handleHeaderScroll);

  setupNewsletter();
}

/* =========================
   NEWSLETTER SUBSCRIBE
========================= */

function showSubscribeSuccess() {
  const miniPopup = document.getElementById('miniPopup');
  const subscribeToast = document.getElementById('subscribeToast');

  if (miniPopup) {
    miniPopup.classList.add('show');
    setTimeout(() => miniPopup.classList.remove('show'), 2500);
  }

  if (subscribeToast) {
    subscribeToast.classList.add('active');
    setTimeout(() => subscribeToast.classList.remove('active'), 2500);
  }
}

function setupNewsletter() {
  const form = refs.newsletterForm;
  const emailInput = refs.newsletterEmail;

  if (!form || !emailInput) return;

  form.setAttribute('novalidate', 'novalidate');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    if (!email) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'homepage' })
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : {};

      if (res.ok && payload.success === true) {
        showSubscribeSuccess();
        form.reset();
        return;
      }

      if (res.ok && payload.mailSent === false && payload.success !== false) {
        showSubscribeSuccess();
        form.reset();
        return;
      }

      showSubscribeSuccess();
      form.reset();
    } catch (err) {
      console.error('Subscription error:', err);
      alert('Unable to subscribe.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }, true);
}

/* =========================
   HOME CHATBOT
========================= */

function setupHomeChatbot() {
  const root = document.getElementById('home-chatbot');
  const toggle = document.getElementById('chatbot-toggle');
  const close = document.getElementById('chatbot-close');
  const panel = document.getElementById('chatbot-panel');
  const form = document.getElementById('chatbot-form');
  const input = document.getElementById('chatbot-input');
  const messages = document.getElementById('chatbot-messages');

  if (!root || !toggle || !panel || !form || !input || !messages) return;

  const history = [];
  let chatProducts = [];

  fetch('data/db.json')
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      chatProducts = Array.isArray(data?.products) ? data.products : [];
    })
    .catch(() => {
      chatProducts = [];
    });

  function formatChatPrice(value) {
    return `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
  }

  function getProductsForChat() {
    const liveProducts = Array.isArray(state.products) ? state.products.filter((product) => product.title) : [];
    const fallbackProducts = Array.isArray(chatProducts) ? chatProducts.filter((product) => product.title) : [];
    return liveProducts.length ? liveProducts : fallbackProducts;
  }

  function productLine(product) {
    return `${product.title} - ${formatChatPrice(product.price)} (${product.category || 'crochet'})`;
  }

  function findMatchingProducts(text) {
    const lower = text.toLowerCase();
    const products = getProductsForChat();
    const words = lower
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !['what', 'which', 'show', 'have', 'with', 'for', 'the', 'and', 'price'].includes(word));

    return products
      .map((product) => {
        const haystack = `${product.title} ${product.category} ${product.description}`.toLowerCase();
        const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
        return { product, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || Number(a.product.price) - Number(b.product.price))
      .map((item) => item.product);
  }

  function suggestByCategory(categoryNames, limit = 4) {
    const categories = Array.isArray(categoryNames) ? categoryNames : [categoryNames];
    const products = getProductsForChat();
    return products
      .filter((product) => categories.some((category) => (product.category || '').toLowerCase().includes(category)))
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, limit);
  }

  function getBudget(text) {
    const lower = text.toLowerCase();
    const underMatch = lower.match(/(?:under|below|less than|within|budget|upto|up to)\s*(?:rs\.?|inr)?\s*(\d{2,6})/);
    if (underMatch) return Number(underMatch[1]);

    const plainPrice = lower.match(/(?:rs\.?|inr)\s*(\d{2,6})/);
    if (plainPrice) return Number(plainPrice[1]);

    return null;
  }

  function filterByBudget(products, budget) {
    if (!budget) return products;
    return products.filter((product) => Number(product.price) <= budget);
  }

  function topProducts(products, limit = 5) {
    return products
      .filter((product) => Number(product.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, limit);
  }

  function listOrFallback(products, fallback) {
    if (!products.length) return fallback;
    return products.map(productLine).join('\n');
  }

  function buildTrackingReply(text) {
    const trackingMatch = text.match(/\bWW[-\s]?\d{6,8}[-\s]?[A-Z0-9]{4,8}\b/i);
    const orderMatch = text.match(/\b(?:order|order id|order number|#)\s*#?\s*([A-Z0-9-]{2,})\b/i);
    const trackingNumber = trackingMatch ? trackingMatch[0].replace(/\s+/g, '').toUpperCase() : '';
    const orderId = orderMatch ? orderMatch[1] : '';

    if (trackingNumber) {
      return `You can track this order here:\ntracking.html?tracking=${encodeURIComponent(trackingNumber)}\n\nOpen that link from this site to see the current status, estimated delivery, and invoice option.`;
    }

    if (orderId && /\d/.test(orderId)) {
      return `You can check that order here:\ntracking.html?order=${encodeURIComponent(orderId)}\n\nIf you also have a tracking number starting with WW, use that for the most accurate tracking update.`;
    }

    return 'To track an order, open tracking.html or share your tracking number. Tracking numbers usually look like WW-20260529-ABC123. The tracking page shows Order Confirmed, Preparing Your Cozy Package, Shipped, Out for Delivery, and Delivered.';
  }

  function buildGiftReply(text) {
    const lower = text.toLowerCase();
    const budget = getBudget(text);
    const products = getProductsForChat();
    let candidates = [];
    let intro = 'Here are good crochet gift ideas:';

    const isForHer = /girl|woman|women|female|her|sister|mother|mom|wife|girlfriend|bride|aunt|teacher/.test(lower);
    const isForHim = /boy|man|men|male|him|brother|father|dad|husband|boyfriend|groom|sir/.test(lower);
    const isForBabyOrKid = /baby|kid|child|children|newborn|toddler|daughter|son/.test(lower);
    const isFriend = /friend|bestie|best friend/.test(lower);
    const isRomantic = /anniversary|valentine|romantic|love|wife|girlfriend|boyfriend|husband/.test(lower);
    const isGraduation = /graduation|graduate|convocation/.test(lower);

    if (isForBabyOrKid) {
      intro = 'For babies or kids, I would suggest soft, useful crochet pieces:';
      candidates = suggestByCategory('kids', 8);
    } else if (isGraduation) {
      intro = 'For graduation gifts, these feel celebratory and keepsake-worthy:';
      candidates = products.filter((product) => /graduate|graduation|duck|doll|bouquet|charm/i.test(`${product.title} ${product.category}`));
    } else if (isRomantic) {
      intro = 'For a romantic gift, bouquets and premium soft pieces work best:';
      candidates = [
        ...suggestByCategory('bouquets', 6),
        ...suggestByCategory('bouquet blankets', 4)
      ];
    } else if (isForHer) {
      intro = 'For women or girls, I would suggest pretty, wearable, or floral crochet gifts:';
      candidates = [
        ...suggestByCategory('bouquets', 4),
        ...suggestByCategory('hair accessories', 4),
        ...suggestByCategory('wearables', 4),
        ...suggestByCategory('accessories', 3)
      ];
    } else if (isForHim) {
      intro = 'For men or boys, I would suggest practical, character, or desk/car-friendly crochet gifts:';
      candidates = products.filter((product) =>
        /muffler|charm|keychain|car|deadpool|luffy|spider|panda|duck|frog|dog|headphone/i.test(`${product.title} ${product.category} ${product.description}`)
      );
    } else if (isFriend) {
      intro = 'For a friend, small cheerful gifts usually work beautifully:';
      candidates = [
        ...suggestByCategory('accessories', 5),
        ...suggestByCategory('hair accessories', 4),
        ...suggestByCategory('bouquets', 3)
      ];
    } else {
      candidates = [
        ...suggestByCategory('bouquets', 3),
        ...suggestByCategory('accessories', 4),
        ...suggestByCategory('plushies', 3),
        ...suggestByCategory('gifts', 3)
      ];
    }

    candidates = topProducts(filterByBudget(candidates, budget), 6);
    const budgetLine = budget ? `\nBudget used: under ${formatChatPrice(budget)}.` : '';

    return `${intro}${budgetLine}\n${listOrFallback(candidates, 'I could not find exact products under that budget, but crochet charms, keychains, hair clips, and mini bouquets are usually the safest lower-budget choices.')}\n\nTell me the occasion and budget if you want a tighter shortlist.`;
  }

  function buildShopReply(text) {
    const lower = text.toLowerCase();
    const products = getProductsForChat();

    if (/^(hi|hello|hey|hii|helo)\b/.test(lower)) {
      return 'Hi! I am Whimsy Assistant. I can help you choose crochet bouquets, plushies, wearables, kids items, accessories, custom orders, and gifts. What are you looking for today?';
    }

    if (lower.includes('track') || lower.includes('tracking') || lower.includes('where is my order') || lower.includes('order status') || lower.includes('delivery status')) {
      return buildTrackingReply(text);
    }

    if (lower.includes('invoice') || lower.includes('bill')) {
      return 'You can download or print the invoice from the order tracking page. Open tracking.html with your order ID or tracking number, then use the "Download Invoice" button.';
    }

    if (lower.includes('cancel')) {
      return 'Orders can usually be cancelled only while they are still at Order Confirmed or Preparing Your Cozy Package stage. For cancellation help, contact 9448015505 with your order ID or tracking number.';
    }

    if (lower.includes('contact') || lower.includes('phone') || lower.includes('email') || lower.includes('call')) {
      return 'You can contact Whimsy & Weave at pragathiprakash79@gmail.com or 9448015505. You can also use the Contact page from the menu.';
    }

    if (lower.includes('custom') || lower.includes('personalized') || lower.includes('personalised')) {
      return 'Yes, custom orders are available. You can choose colors, yarn style, upload inspiration, and add notes or initials. Click "Custom orders" on the home page to start.';
    }

    if (lower.includes('delivery') || lower.includes('shipping')) {
      return 'The home page mentions complimentary cozy shipping on handcrafted orders. For exact timing on a specific order, contact the shop at 9448015505.';
    }

    if (lower.includes('return') || lower.includes('refund') || lower.includes('cancel')) {
      return 'For returns, refunds, or cancellation questions, please contact the shop directly at pragathiprakash79@gmail.com or 9448015505 so they can check your order details.';
    }

    if (lower.includes('gift') || lower.includes('birthday') || lower.includes('anniversary') || lower.includes('graduation') || lower.includes('valentine') || lower.includes('friend') || lower.includes('girl') || lower.includes('boy') || lower.includes('woman') || lower.includes('man') || lower.includes('mother') || lower.includes('father') || lower.includes('wife') || lower.includes('husband') || lower.includes('girlfriend') || lower.includes('boyfriend')) {
      return buildGiftReply(text);
    }

    if (lower.includes('recommend') || lower.includes('suggest') || lower.includes('best')) {
      const budget = getBudget(text);
      const matches = filterByBudget(findMatchingProducts(text), budget);
      const fallback = filterByBudget([
        ...suggestByCategory('bouquets', 3),
        ...suggestByCategory('accessories', 3),
        ...suggestByCategory('wearables', 3)
      ], budget);
      const choices = topProducts(matches.length ? matches : fallback, 5);
      return `My suggestions:\n${listOrFallback(choices, 'Tell me the category, occasion, or budget and I will suggest better matches.')}`;
    }

    if (lower.includes('workshop') || lower.includes('class') || lower.includes('learn')) {
      return 'You can check crochet workshops from the Workshops page in the navigation. It is the best place for class details and enrollment.';
    }

    if (lower.includes('bouquet')) {
      const items = suggestByCategory(['bouquets', 'bouquet blankets'], 5);
      return `Popular crochet bouquets and bouquet blankets:\n${items.map(productLine).join('\n')}\n\nOpen Products and choose the bouquet category to see more.`;
    }

    if (lower.includes('plush') || lower.includes('doll') || lower.includes('toy')) {
      const items = suggestByCategory('plushies', 5);
      return `Cute plushie picks:\n${items.map(productLine).join('\n')}\n\nThese are good for playful gifts and keepsakes.`;
    }

    if (lower.includes('wear') || lower.includes('cardigan') || lower.includes('top') || lower.includes('muffler') || lower.includes('coverup')) {
      const items = suggestByCategory('wearables', 5);
      return `Wearable crochet options:\n${items.map(productLine).join('\n')}\n\nYou can find more under Products > Wearables.`;
    }

    if (lower.includes('kid') || lower.includes('baby') || lower.includes('child') || lower.includes('dress')) {
      const items = suggestByCategory('kids', 5);
      return `Kids and baby crochet picks:\n${items.map(productLine).join('\n')}\n\nThese include blankets, dresses, footwear, and cardigans.`;
    }

    if (lower.includes('accessor') || lower.includes('keychain') || lower.includes('charm') || lower.includes('hair') || lower.includes('clip') || lower.includes('bow')) {
      const items = suggestByCategory(['accessories', 'hair accessories', 'car-accessories'], 6);
      return `Accessory ideas:\n${items.map(productLine).join('\n')}\n\nAccessories are great for small gifts, bags, keys, cars, and hair styling.`;
    }

    if (lower.includes('gift') || lower.includes('birthday') || lower.includes('anniversary') || lower.includes('graduation')) {
      const items = [
        ...suggestByCategory('bouquets', 2),
        ...suggestByCategory('gifts', 2),
        ...suggestByCategory('accessories', 2)
      ].slice(0, 5);
      return `For gifting, I would suggest:\n${items.map(productLine).join('\n')}\n\nBouquets feel romantic, plushies feel cute, and charms/keychains are budget-friendly.`;
    }

    if (lower.includes('cheap') || lower.includes('budget') || lower.includes('low price') || lower.includes('affordable')) {
      const items = products
        .filter((product) => Number(product.price) > 0)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 6);
      return `Most affordable picks right now:\n${items.map(productLine).join('\n')}\n\nYou can add them from the Products page.`;
    }

    if (lower.includes('expensive') || lower.includes('premium') || lower.includes('luxury')) {
      const items = products
        .filter((product) => Number(product.price) > 0)
        .sort((a, b) => Number(b.price) - Number(a.price))
        .slice(0, 5);
      return `Premium crochet pieces:\n${items.map(productLine).join('\n')}\n\nThese are better for statement gifts or custom-style pieces.`;
    }

    if (lower.includes('price') || lower.includes('cost') || lower.includes('rate') || lower.includes('how much')) {
      const budget = getBudget(text);
      const matches = filterByBudget(findMatchingProducts(text), budget).slice(0, 5);
      if (matches.length) {
        return `Here are the matching prices:\n${matches.map(productLine).join('\n')}`;
      }
      return 'Prices vary by product. Small accessories start around Rs. 120 to Rs. 399, bouquets are often around Rs. 649 to Rs. 1,899, wearables can go from around Rs. 899 to Rs. 3,799, and premium bouquet blankets can be Rs. 4,200 and above.';
    }

    if (lower.includes('product') || lower.includes('sell') || lower.includes('available') || lower.includes('catalog') || lower.includes('shop')) {
      return 'Whimsy & Weave sells handmade crochet bouquets, bouquet blankets, plushies, wearables, kids items, hair accessories, bag/key charms, car hangings, and custom orders. Tell me a category or budget and I will suggest specific products.';
    }

    const matches = findMatchingProducts(text).slice(0, 4);
    if (matches.length) {
      return `I found these matching products:\n${matches.map(productLine).join('\n')}\n\nYou can search the same name on the Products page to add it to cart or wishlist.`;
    }

    return '';
  }

  function setOpen(isOpen) {
    root.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    panel.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) input.focus();
  }

  function addMessage(role, content) {
    const bubble = document.createElement('div');
    bubble.className = `chatbot-message ${role === 'user' ? 'user' : 'bot'}`;
    bubble.textContent = content;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function fallbackReply(text) {
    return buildShopReply(text) || 'I can help with product ideas, prices, gifting, custom crochet orders, delivery, and shop contact details. Try asking "show bouquet prices" or "suggest a birthday gift under 500".';
  }

  async function askBot(text) {
    history.push({ role: 'user', content: text });
    const thinkingBubble = addMessage('bot', 'Thinking...');
    input.disabled = true;
    form.querySelector('button')?.setAttribute('disabled', 'disabled');

    try {
      const shopReply = buildShopReply(text);
      if (shopReply) {
        thinkingBubble.textContent = shopReply;
        history.push({ role: 'assistant', content: shopReply });
        return;
      }

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) })
      });

      if (!response.ok) throw new Error('Chat API unavailable');

      const data = await response.json();
      const reply = data.mock ? fallbackReply(text) : (data.reply || fallbackReply(text));
      thinkingBubble.textContent = reply;
      history.push({ role: 'assistant', content: reply });
    } catch (error) {
      const reply = fallbackReply(text);
      thinkingBubble.textContent = reply;
      history.push({ role: 'assistant', content: reply });
    } finally {
      input.disabled = false;
      form.querySelector('button')?.removeAttribute('disabled');
      input.focus();
    }
  }

  toggle.addEventListener('click', () => {
    setOpen(!root.classList.contains('open'));
  });

  close?.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);
    askBot(text);
  });
}

/* =========================
   START
========================= */

window.addEventListener('storage', (event) => {
  if (!event.key || ['whimsyCart', 'cart', 'whimsyWishlist', 'wishlist'].includes(event.key)) {
    loadStorage();
  }
});

document.addEventListener('DOMContentLoaded', initPage);
document.addEventListener('DOMContentLoaded', setupHomeChatbot);
