/* =========================
WHIMSY & WEAVE CART SYSTEM
FULLY FIXED
========================= */
const CART_KEY = "whimsyCart";

const STORAGE_FALLBACK = {
  primary: CART_KEY,
  fallback: "cart"
};

const API_BASE = ['8081', '8080', '5500'].includes(window.location.port)
  ? 'http://127.0.0.1:5000'
  : '';

let cart = [];

function isUserLoggedIn() {
  return Boolean(localStorage.getItem('authToken') && localStorage.getItem('isLoggedIn') === 'true');
}

function requireLoginForCartPage() {
  const page = window.location.pathname.split('/').pop().toLowerCase();
  if (page !== 'cart.html' || isUserLoggedIn()) {
    return false;
  }

  if (window.whimsyAuth?.promptLoginRequired) {
    window.whimsyAuth.promptLoginRequired(
      'cart.html',
      'Please login or create an account before viewing your cart. Your selected items will stay saved.'
    );
  } else {
    localStorage.setItem('redirectAfterLogin', 'cart.html');
    window.location.href = 'login.html';
  }
  return true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================
DOM REFS
========================= */

const refs = {
  cartGrid:
    document.getElementById("cartItems"),

  cartCount:
    document.getElementById("cartCount"),

  subtotal:
    document.getElementById("subtotal"),

  tax:
    document.getElementById("tax"),

  finalTotal:
    document.getElementById("finalTotal"),

  checkoutBtn:
    document.getElementById("checkoutBtn"),
    
  shipping:
    document.getElementById("shipping"),

  recommendGrid:
    document.querySelector(".recommend-grid")
};

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function hasCheckoutAuth() {
  return Boolean(getAuthToken() && localStorage.getItem('isLoggedIn') === 'true');
}

function showCheckoutAuthPrompt() {
  localStorage.setItem('redirectAfterLogin', 'checkout.html');

  const goToLogin = () => {
    window.location.href = 'login.html';
  };

  const goToRegister = () => {
    window.location.href = 'signup.html';
  };

  if (typeof whimsyModal !== 'undefined' && typeof whimsyModal.show === 'function') {
    whimsyModal.show({
      type: 'info',
      title: 'Login Required',
      message: 'Please login or register before checkout. Your cart will stay saved while you sign in.',
      primaryBtn: {
        text: 'Login',
        callback: goToLogin
      },
      secondaryBtn: {
        text: 'Register',
        callback: goToRegister
      }
    });
    return;
  }

  if (window.confirm('Please login or register before checkout.\n\nChoose OK to login, or Cancel to register.')) {
    goToLogin();
  } else {
    goToRegister();
  }
}

function normalizeImagePath(image) {
  if (!image) {
    return './img/images/logo.jpg';
  }

  if (/^(https?:|data:|\.\/|\/)/.test(image)) {
    return image;
  }

  return `./${image}`;
}

function normalizeStoredCart(items) {
  const grouped = {};

  (Array.isArray(items) ? items : []).forEach((item) => {
    let normalized;

    if (item && typeof item === 'object') {
      const id = item.id ?? item.productId ?? item.product_id;
      if (id === undefined || id === null) {
        return;
      }

      normalized = {
        id,
        title: item.title || item.name || 'Handmade Item',
        image: normalizeImagePath(item.image),
        price: Number(item.price) || 0,
        category: item.category || '',
        quantity: Math.max(1, Number(item.quantity) || 1),
        customization: item.customization || {}
      };
    } else {
      const id = Number(item);
      if (!Number.isFinite(id)) {
        return;
      }

      normalized = {
        id,
        title: 'Handmade Item',
        image: './img/images/logo.jpg',
        price: 0,
        category: '',
        quantity: 1,
        customization: {}
      };
    }

    const key = String(normalized.id);
    if (grouped[key]) {
      grouped[key].quantity += normalized.quantity;
    } else {
      grouped[key] = normalized;
    }
  });

  return Object.values(grouped);
}

async function loadCartFromStorage() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_FALLBACK.primary)
      || localStorage.getItem(STORAGE_FALLBACK.fallback)
      || '[]'
    ) || [];
    cart = normalizeStoredCart(stored);
    await enrichCartFromCatalog();
  } catch (err) {
    console.error('Cart load error', err);
    cart = [];
  }
}

async function enrichCartFromCatalog() {
  const needsDetails = cart.some(
    (item) => !item.title || item.title === 'Handmade Item' || !item.image || !item.price
  );

  if (!needsDetails || !cart.length) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/products/?limit=200`);
    if (!res.ok) {
      return;
    }

    const json = await res.json();
    const products = Array.isArray(json.products)
      ? json.products
      : Array.isArray(json)
        ? json
        : [];

    cart = cart.map((item) => {
      const match = products.find(
        (product) => String(product.id) === String(item.id)
      );

      if (!match) {
        return item;
      }

      return {
        ...item,
        title: match.title || match.name || item.title,
        image: match.image || item.image,
        price: Number(match.price) || item.price,
        category: match.category || item.category || ''
      };
    });

  
  } catch (err) {
    console.error('Cart enrich error', err);
  }
}

async function loadCart() {
  const token = getAuthToken();
  if (!token) {
    await loadCartFromStorage();
    updateCartCount();
    renderCart();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/cart/`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const json = await res.json();
      const backendItems = Array.isArray(json.cart?.items) ? json.cart.items : [];
      cart = backendItems.map(item => ({
        id: item.productId,
        title: item.name,
        image: item.image,
        price: item.price,
        category: item.category || '',
        quantity: Math.max(1, Number(item.quantity) || 1),
        customization: item.customization || {}
      }));
      if (!cart.length) {
        await loadCartFromStorage();
      }
      updateCartCount();
      renderCart();
      return;
    }
  } catch (err) {
    console.error('Cart API load error', err);
  }

  await loadCartFromStorage();
  updateCartCount();
  renderCart();
}

/* =========================
RECOMMENDED PRODUCTS VISUALS
========================= */

function initRecommendedProducts() {
  if (!refs.recommendGrid) return;

  const cards = refs.recommendGrid.querySelectorAll(".recommend-card");
  cards.forEach((card) => {
    const button = card.querySelector("button.add-to-cart");
    const imageHolder = card.querySelector(".recommend-image");
    const dataImage = button && button.getAttribute("data-image");

    if (imageHolder && dataImage) {
      // Use existing design but ensure an actual image is shown.
      if (!imageHolder.querySelector("img")) {
        const img = document.createElement("img");
        img.src = dataImage;
        img.alt = button.getAttribute("data-title") || "Recommended product";
        img.className = "recommend-image-img";
        imageHolder.appendChild(img);
      }
    }
  });
}

/* =========================
SAVE CART
========================= */

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  localStorage.setItem(STORAGE_FALLBACK.fallback, JSON.stringify(cart));
}

/* =========================
UPDATE COUNT
========================= */

function updateCartCount() {
  if (!refs.cartCount) return;

  const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  refs.cartCount.textContent = totalItems;
}

/* =========================
ADD TO CART
========================= */

async function addToCart(product) {
  if (!product || !product.id) {
    console.error('Invalid product');
    return;
  }

  const token = getAuthToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/api/cart/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
    } catch (err) {
      console.error('Cart API add error', err);
    }
    await loadCart();
    return;
  }

  const existingItem = cart.find(item => String(item.id) === String(product.id));
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      image: product.image,
      price: Number(product.price),
      category: product.category || '',
      quantity: 1
    });
  }

  saveCart();
  updateCartCount();
  renderCart();
}

/* =========================
REMOVE FROM CART
========================= */

async function removeFromCart(id, customization = {}) {
  const token = getAuthToken();

  cart = cart.filter(item => String(item.id) !== String(id));
  saveCart();
  updateCartCount();
  renderCart();

  if (token) {
    try {
      await fetch(`${API_BASE}/api/cart/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ customization })
      });
    } catch (err) {
      console.error('Cart API remove error', err);
    }
    await loadCart();
    return;
  }
}
/* =========================
UPDATE QUANTITY
========================= */

async function updateQuantity(id, change) {

  const item = cart.find(
    item => String(item.id) === String(id)
  );

  if (!item) return;

  const newQuantity =
    Number(item.quantity || 0) + change;

  if (newQuantity <= 0) {
    await removeFromCart(id);
    return;
  }

  item.quantity = newQuantity;

  saveCart();

  updateCartCount();

  renderCart();
}

/* =========================
CALCULATE TOTALS
========================= */

function calculateTotals(){

  const subtotal =
  cart.reduce(
    (sum,item)=>
    sum + (
      Number(item.price) *
      Number(item.quantity)
    ),
    0
  );

  const tax =
  Math.round(
    subtotal * 0.05
  );

  const shipping =
  subtotal > 0 ? 99 : 0;

  const finalTotal =
  subtotal +
  tax +
  shipping;

  if(refs.subtotal){

    refs.subtotal.textContent =
    `₹${subtotal}`;
  }

  if(refs.tax){

    refs.tax.textContent =
    `₹${tax}`;
  }

  if(refs.finalTotal){

    refs.finalTotal.textContent =
    `₹${finalTotal}`;
  }
}

/* =========================
RENDER CART
========================= */

function renderCart(){

  cart = cart.map(item => ({
    ...item,
    customization: item.customization || {} 
  }));


  if(!refs.cartGrid) return;

  refs.cartGrid.innerHTML = "";

  if(cart.length === 0){

    refs.cartGrid.innerHTML = `

      <div class="empty-cart">

        <h2>
          Your cart feels lonely ✨
        </h2>

        <p>
          Add cozy crochet treasures.
        </p>

      </div>

    `;

    calculateTotals();

    return;
  }

  cart.forEach(item => {

    const card =
    document.createElement("div");

    card.className =
    "cart-card";

    card.innerHTML = `

      <div class="cart-image">

        <img
          src="${escapeHtml(item.image)}"
          alt="${escapeHtml(item.title)}">

      </div>

      <div class="cart-info">

        <p class="cart-category">
          ${escapeHtml(item.category || "")}
        </p>

        <h3>
          ${escapeHtml(item.title)}
        </h3>

        <p class="cart-price">
          ₹${item.price}
        </p>

        <div class="quantity-controls">

          <button
            class="qty-btn decrease"
            data-id="${item.id}">
            -
          </button>

          <span>
            ${item.quantity}
          </span>

          <button
            class="qty-btn increase"
            data-id="${item.id}">
            +
          </button>

        </div>

        <button
          class="remove-btn"
          data-id="${item.id}"
      data-customization='${JSON.stringify(item.customization || {})}'>
          Remove
        </button>


      </div>

    `;

    refs.cartGrid.appendChild(card);
  });

  bindCartEvents();

  calculateTotals();
}

/* =========================
BIND EVENTS
========================= */

function bindCartEvents(){

  document
  .querySelectorAll(".increase")
  .forEach(button => {

    button.onclick = () => {

      updateQuantity(
        button.dataset.id,
        1
      );
    };
  });

  document
  .querySelectorAll(".decrease")
  .forEach(button => {

    button.onclick = () => {

      updateQuantity(
        button.dataset.id,
        -1
      );
    };
  });

  document
  .querySelectorAll(".remove-btn")
  .forEach(button => {

    button.onclick = () => {

      const customization = (() => {
        try {
          const raw = button.dataset.customization;
          if (!raw) return {};
          const unescaped = raw.replace(/"/g, '"').replace(/&#39;/g, "'");
          return JSON.parse(unescaped);
        } catch (e) {
          return {};
        }
      })();

      removeFromCart(button.dataset.id, customization);
    };
  });
}

/* =========================
GLOBAL ADD TO CART
========================= */

document.addEventListener(
  "click",
  e => {

    const button =
    e.target.closest(
      ".add-to-cart"
    );

    if(!button) return;

    const product = {

      id:
      button.dataset.id,

      title:
      button.dataset.title,

      image:
      button.dataset.image,

      price:
      Number(
        button.dataset.price
      ),

      category:
      button.dataset.category

    };

    addToCart(product);
  }
);

/* =========================
SYNC ACROSS PAGES
========================= */

window.addEventListener('storage', async () => {

    await loadCartFromStorage();

    updateCartCount();

    renderCart();
});
/* =========================
CHECKOUT FLOW
========================= */

/*function showAuthModal() {
  const redirectTarget = `${window.location.pathname}`.replace(/\.[a-z]+$/i, '') + '/checkout.html';
  localStorage.setItem('redirectAfterLogin', 'checkout.html');

  // If a custom auth modal exists on the page, use it.
  if (refs.authModal) {
    refs.authModal.classList.add('active');
    return;
  }

  // Fallback: show lightweight prompt + links.
  showCheckoutMessage('Login required. Please login or register to continue.', 'error');
  // Hard links for your requested UX
  setTimeout(() => {
    window.location.href = localStorage.getItem('redirectAfterLogin') || 'login.html';
  }, 500);
}


function hideAuthModal() {
  refs.authModal?.classList.remove('active');
}

function getSelectedPaymentMethod() {
  const selected = document.querySelector('input[name="payment"]:checked');
  return selected?.value || selected?.closest('.payment-option')?.textContent.trim().toLowerCase() || 'gpay';
}

function setupPaymentOptions() {
  document.querySelectorAll('.payment-option').forEach((option) => {
    const input = option.querySelector('input');
    const method = option.textContent.trim().toLowerCase();
    if (input && !input.value) input.value = method;

    option.addEventListener('click', () => {
      document.querySelectorAll('.payment-option').forEach(item => item.classList.remove('active'));
      option.classList.add('active');
      if (input) input.checked = true;
      updateCardVisibility();
    });
  });

  updateCardVisibility();
}

function updateCardVisibility() {
  const cardPayment = document.querySelector('.card-payment');
  if (!cardPayment) return;
  cardPayment.style.display = getSelectedPaymentMethod() === 'card' ? 'block' : 'none';
}

function setupCardPreview() {
  const cardNumber = document.getElementById('cardNumber');
  const cardName = document.getElementById('cardName');
  const cardExpiry = document.getElementById('cardExpiry');
  const previewNumber = document.getElementById('previewNumber');
  const previewName = document.getElementById('previewName');
  const previewExpiry = document.getElementById('previewExpiry');

  cardNumber?.addEventListener('input', () => {
    const digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
    cardNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
    previewNumber.textContent = cardNumber.value || '**** **** **** ****';
  });
  cardName?.addEventListener('input', () => {
    previewName.textContent = cardName.value.trim().toUpperCase() || 'YOUR NAME';
  });
  cardExpiry?.addEventListener('input', () => {
    const digits = cardExpiry.value.replace(/\D/g, '').slice(0, 4);
    cardExpiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    previewExpiry.textContent = cardExpiry.value || '00/00';
  });
}

function collectCheckoutDetails() {
  const inputs = Array.from(refs.checkoutForm.querySelectorAll('input'));
  return {
    name: inputs[0]?.value.trim(),
    email: inputs[1]?.value.trim(),
    phone: inputs[2]?.value.trim(),
    city: inputs[3]?.value.trim(),
    address: inputs[4]?.value.trim(),
    state: inputs[5]?.value.trim(),
    pincode: inputs[6]?.value.trim()
  };
}

function validateCardDetails() {
  if (getSelectedPaymentMethod() !== 'card') return true;
  const cardNumber = document.getElementById('cardNumber')?.value.replace(/\D/g, '') || '';
  const cardName = document.getElementById('cardName')?.value.trim() || '';
  const cardExpiry = document.getElementById('cardExpiry')?.value.trim() || '';
  const cvv = document.querySelector('.card-payment input[type="password"]')?.value.trim() || '';
  return cardNumber.length >= 12 && cardName.length > 1 && /^\d{2}\/\d{2}$/.test(cardExpiry) && cvv.length === 3;
}

function showCheckoutMessage(message, type = 'info') {
  const existing = document.querySelector('.checkout-message');
  existing?.remove();
  const msg = document.createElement('div');
  msg.className = `checkout-message checkout-${type}`;
  msg.textContent = message;
  msg.style.cssText = `
    position: fixed;
    top: 22px;
    right: 22px;
    max-width: 340px;
    padding: 1rem 1.4rem;
    border-radius: 18px;
    background: ${type === 'error' ? '#ffd4cc' : '#fff7f1'};
    color: #6f4e3f;
    box-shadow: 0 18px 45px rgba(111,78,63,.18);
    z-index: 7000;
    font-weight: 600;
  `;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 3200);
}

async function submitOrder(event) {
  event.preventDefault();
  if (!isLoggedIn()) {
    showAuthModal();
    return;
  }
  if (!cart.length) {
    showCheckoutMessage('Your cart is empty.', 'error');
    return;
  }
  if (!refs.checkoutForm.checkValidity()) {
    refs.checkoutForm.reportValidity();
    return;
  }
  if (!validateCardDetails()) {
    showCheckoutMessage('Please complete valid card details.', 'error');
    return;
  }

  const submitBtn = refs.checkoutForm.querySelector('.place-order-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing Order...';

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        paymentMethod: getSelectedPaymentMethod(),
        shippingAddress: collectCheckoutDetails(),
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          customization: item.customization || {}
        }))
      })
    });
    const json = await res.json();
    if (!res.ok) {
      showCheckoutMessage(json.message || 'Unable to place order.', 'error');
      return;
    }

    localStorage.setItem('lastOrderTracking', JSON.stringify({
      orderId: json.order_id,
      trackingNumber: json.trackingNumber,
      trackingUrl: json.trackingUrl
    }));
    cart = [];
    localStorage.setItem(CART_KEY, JSON.stringify([]));
    localStorage.setItem(STORAGE_FALLBACK.fallback, JSON.stringify([]));
    updateCartCount();
    renderCart();

    if (refs.orderId) refs.orderId.textContent = json.order_id;
    if (refs.continueShopping) refs.continueShopping.textContent = 'Continue Shopping';
    if (refs.trackOrderBtn) refs.trackOrderBtn.textContent = 'Track Order';
    refs.successModal?.classList.add('active');
  } catch (err) {
    console.error('Order submit error', err);
    showCheckoutMessage('Unable to place order right now.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

function setupCheckoutFlow() {
  refs.checkoutBtn?.addEventListener('click', () => {
    if (!cart.length) {
      showCheckoutMessage('Add at least one item before checkout.', 'error');
      return;
    }
    if (!isLoggedIn()) {
      showAuthModal();
      return;
    }
    refs.checkoutSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  refs.closeAuthModal?.addEventListener('click', hideAuthModal);
  refs.authModal?.addEventListener('click', (event) => {
    if (event.target === refs.authModal) hideAuthModal();
  });

  refs.checkoutForm?.addEventListener('submit', submitOrder);

  refs.trackOrderBtn?.addEventListener('click', () => {
    const tracking = JSON.parse(localStorage.getItem('lastOrderTracking') || '{}');
    if (tracking.trackingUrl) {
      window.location.href = tracking.trackingUrl;
      return;
    }
    if (tracking.trackingNumber) {
      window.location.href = `tracking.html?tracking=${encodeURIComponent(tracking.trackingNumber)}`;
      return;
    }
    window.location.href = 'tracking.html';
  });

  refs.continueShopping?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  setupPaymentOptions();
  setupCardPreview();
}*/

/* =========================
INIT
========================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    if (requireLoginForCartPage()) {
      return;
    }

    await loadCart();
    initRecommendedProducts();

    refs.checkoutBtn?.addEventListener(
      'click',
      () => {

        if (!cart.length) {

          alert(
            'Your cart is empty.'
          );

          return;
        }

        if (!hasCheckoutAuth()) {
          showCheckoutAuthPrompt();
          return;

          localStorage.setItem(
            'redirectAfterLogin',
            'checkout.html'
          );

          whimsyModal.show({
            type: 'info',
            title: 'Checkout Verification ✨',
            message: 'To complete your order, please sign in or register a new customer account. We will keep your cart items safe!',
            primaryBtn: {
              text: 'Log In / Sign In',
              callback: () => {
                window.location.href = 'login.html';
              }
            },
            secondaryBtn: {
              text: 'Register / Sign Up',
              callback: () => {
                window.location.href = 'signup.html';
              }
            }
          });

          return;
        }

        localStorage.setItem(
          'checkoutCart',
          JSON.stringify(cart)
        );

        localStorage.setItem(
          'checkoutTotals',
          JSON.stringify({
            subtotal:
              refs.subtotal?.textContent || '₹0',

            tax:
              refs.tax?.textContent || '₹0',

            total:
              refs.finalTotal?.textContent || '₹0'
          })
        );

        window.location.href =
          'checkout.html';
      }
    );
});
