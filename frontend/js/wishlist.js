const wishlistGrid = document.getElementById("wishlistGrid");

const emptyState = document.getElementById("emptyState");

const wishlistCount = document.getElementById("wishlistCount");

const clearWishlistBtn = document.getElementById("clearWishlist");

// Cart count in wishlist header (shared with cart.js / script.js)
const headerCartCount = document.getElementById("cartCount");

const STORAGE_KEYS = {
  primary: "whimsyWishlist",
  fallback: "wishlist"
};

const API_BASE = ['8081', '8080', '5500'].includes(window.location.port)
  ? 'http://127.0.0.1:5000'
  : '';

let wishlistItems = [];

const getAuthToken = () => localStorage.getItem('authToken');

function promptWishlistLogin() {
  if (getAuthToken()) return;

  localStorage.setItem('redirectAfterLogin', 'wishlist.html');

  const loginLink = document.querySelector('#authModal .login-btn');
  const signupLink = document.querySelector('#authModal .signup-btn');
  if (loginLink) loginLink.href = 'login.html';
  if (signupLink) signupLink.href = 'signup.html';

  document.getElementById('authModal')?.classList.add('active');
}

function readCartFromStorageForHeader() {
  try {
    const primary = JSON.parse(localStorage.getItem('whimsyCart') || '[]');
    const fallback = JSON.parse(localStorage.getItem('cart') || '[]');
    const merged = Array.isArray(primary) ? primary : Array.isArray(fallback) ? fallback : [];
    return Array.isArray(merged) ? merged : [];
  } catch {
    return [];
  }
}

function updateHeaderCountsFromStorage() {
  // Wishlist count here is driven by wishlistItems array
  if (wishlistCount) {
    wishlistCount.textContent = Array.isArray(wishlistItems) ? wishlistItems.length : 0;
  }

  if (headerCartCount) {
    const items = readCartFromStorageForHeader();
    const total = items.reduce((sum, item) => {
      const qty = Number(item && typeof item === 'object' ? item.quantity : 1) || 0;
      return sum + qty;
    }, 0);
    headerCartCount.textContent = total;
  }
}

/* =========================
   Helpers
========================= */

function pickFirstImage(p) {
  if (!p) return '';
  if (typeof p.image === 'string' && p.image.trim()) return p.image;
  if (typeof p.imageUrl === 'string' && p.imageUrl.trim()) return p.imageUrl;
  if (Array.isArray(p.images) && p.images.length) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') return first.url || first.image || '';
  }
  return '';
}

function mapBackendWishlistItem(i) {
  const p = i?.product;
  return {
    id: i.productId ?? p?.id ?? i?.id,
    title: p?.title ?? p?.name ?? p?.productName ?? '',
    image: pickFirstImage(p),
    category: p?.category ?? p?.categories ?? p?.productCategory ?? '',
    price: Number(p?.price ?? p?.unitPrice ?? 0)
  };
}

/* =========================
   LOAD WISHLIST (DB when logged in)
========================= */

async function loadWishlist() {
  const token = getAuthToken();

  /*if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/wishlist/`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.warn('[Wishlist] GET /api/wishlist not ok:', res.status);
      }

      const json = await res.json();
      console.log('[Wishlist] GET /api/wishlist payload:', json);

      wishlistItems = Array.isArray(json?.wishlist)
        ? json.wishlist.map(mapBackendWishlistItem)
        : [];
        console.log("FINAL WISHLIST ITEMS:", wishlistItems);

      console.log('[Wishlist] mapped wishlistItems:', wishlistItems);

      updateWishlistCount();
      renderWishlist();
      return;
    } catch (err) {
      console.error('Wishlist fetch error', err);
    }
  }*/

  // Fallback to localStorage for guests
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.primary) || localStorage.getItem(STORAGE_KEYS.fallback);
    if (!stored) {
      wishlistItems = [];
      updateWishlistCount();
      renderWishlist();
      return;
    }

    const parsed = JSON.parse(stored);

    // Normalize localStorage which may contain:
    //  - IDs: [1,2,3]
    //  - objects: [{id,title,image,price,category}, ...]
    //  - mixed/legacy shapes
    const rawArray = Array.isArray(parsed) ? parsed : [];

    wishlistItems = rawArray
      .map((item) => {
        if (item && typeof item === 'object') {
          // Ensure we at least have id and keep whatever fields exist
          const id = item.id ?? item.productId;
          if (id == null) return null;
          return {
            id: item.id ?? item.productId,
            title: item.title ?? item.name ?? '',
            image: item.image ?? item.img ?? '',
            category: item.category ?? item.productCategory ?? '',
            price: Number(item.price ?? item.unitPrice ?? 0)
          };
        }

        // ID-only (legacy)
        const id = Number(item);
        if (!Number.isFinite(id)) return null;
        return { id, title: '', image: '', category: '', price: 0 };
      })
      .filter(Boolean);

    // If we only have IDs (title/image/price missing), enrich from catalog
    const needsEnrich = wishlistItems.some(
      (p) => !p.title || !p.image || !p.price
    );

    if (needsEnrich && wishlistItems.length) {
      try {
        const res = await fetch(`${API_BASE}/api/products/?limit=200`);
        if (res.ok) {
          const json = await res.json();
          const productsArray = Array.isArray(json?.products)
            ? json.products
            : Array.isArray(json)
              ? json
              : [];

          const byId = new Map(
            productsArray.map((prod) => [String(prod.id), prod])
          );

          wishlistItems = wishlistItems.map((w) => {
            const match = byId.get(String(w.id));
            if (!match) return w;
            return {
              ...w,
              title: w.title || match.title || match.name || '',
              image: w.image || match.image || '',
              category: w.category || match.category || '',
              price: Number(w.price || match.price || 0)
            };
          });
        }
      } catch (err) {
        console.error('[Wishlist] localStorage enrich error:', err);
      }
    }

    // De-duplicate by product id to avoid repeated entries from mixed sources
    const uniq = new Map();
    for (const item of wishlistItems) uniq.set(String(item.id), item);
    wishlistItems = Array.from(uniq.values());

    updateWishlistCount();
    updateHeaderCountsFromStorage();
    renderWishlist();
  } catch (error) {
    console.error('Wishlist load error:', error);
    wishlistItems = [];
    updateWishlistCount();
    updateHeaderCountsFromStorage();
    renderWishlist();
  }
}

/* =========================
   SAVE WISHLIST (DB when logged in)
========================= */

async function saveWishlist() {
  const token = getAuthToken();

  if (token) {
    try {
      const payload = { items: wishlistItems.map(i => ({ productId: i.id })) };
      await fetch(`${API_BASE}/api/wishlist/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      updateWishlistCount();
      return;
    } catch (err) {
      console.error('Wishlist save error', err);
    }
  }

  // Fallback
  try {
    localStorage.setItem(STORAGE_KEYS.primary, JSON.stringify(wishlistItems));
    localStorage.setItem(STORAGE_KEYS.fallback, JSON.stringify(wishlistItems));
  } catch (err) {
    console.error('Wishlist save error', err);
  }
}

/* =========================
   UPDATE COUNT
========================= */

function updateWishlistCount() {
  if (wishlistCount) {
    wishlistCount.textContent = wishlistItems.length;
  }
}

window.addEventListener('storage', (event) => {
  if (!event.key || ['whimsyCart', 'cart', 'whimsyWishlist', 'wishlist'].includes(event.key)) {
    // Re-compute cart header count and keep wishlist badge in sync when other pages update storage.
    updateHeaderCountsFromStorage();
  }
});

/* =========================
   REMOVE ITEM
========================= */

async function removeFromWishlist(id) {
  const token = getAuthToken();

  if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/wishlist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.warn('[Wishlist] remove failed:', res.status);
      }
    } catch (err) {
      console.error('Wishlist remove error', err);
    }
  }

  wishlistItems = wishlistItems.filter(item => String(item.id) !== String(id));
  await saveWishlist();
  updateWishlistCount();
  updateHeaderCountsFromStorage();
  renderWishlist();
}

/* =========================
   RENDER WISHLIST
========================= */

function renderWishlist() {
  if (!wishlistGrid) return;

  wishlistGrid.innerHTML = "";

  if (wishlistItems.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  wishlistItems.forEach(product => {
    const card = document.createElement("div");
    card.className = "wishlist-card";
    card.innerHTML = `
      <div class="card-image">
        <img src="${product.image}" alt="${product.title}">
      </div>
      <div class="card-content">
        <p class="category">${product.category}</p>
        <h3>${product.title}</h3>
        <p class="price">₹${product.price}</p>
        <div class="card-actions">
          <button class="cart-btn" data-id="${product.id}">Add To Cart</button>
          <button class="remove-btn" data-id="${product.id}">Remove</button>
        </div>
      </div>
    `;
    wishlistGrid.appendChild(card);
  });

  bindEvents();
}

/* =========================
   EVENTS
========================= */

function bindEvents() {
  document.querySelectorAll(".remove-btn").forEach(button => {
    button.onclick = () => removeFromWishlist(button.dataset.id);
  });

  document.querySelectorAll(".cart-btn").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.id;
      const product = wishlistItems.find(p => String(p.id) === String(id));
      if (!product) return;

      const CART_KEYS = { primary: 'whimsyCart', fallback: 'cart' };
      const token = getAuthToken();

      if (token) {
        try {
          await fetch(`${API_BASE}/api/cart`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ productId: product.id, quantity: 1 })
          });
        } catch (err) {
          console.error('Add to cart error', err);
        }
      } else {
        const stored = JSON.parse(
          localStorage.getItem(CART_KEYS.primary) || localStorage.getItem(CART_KEYS.fallback) || '[]'
        ) || [];

        const exists = stored.find(item => String(item.id) === String(product.id));
        if (exists) exists.quantity = (Number(exists.quantity) || 1) + 1;
        else stored.push({
          id: product.id,
          title: product.title,
          price: product.price || 0,
          image: product.image || '',
          quantity: 1
        });

        try {
          localStorage.setItem(CART_KEYS.primary, JSON.stringify(stored));
          localStorage.setItem(CART_KEYS.fallback, JSON.stringify(stored));
        } catch (err) {
          console.error('Cart save error', err);
        }
      }

      // Keep item in wishlist by design.
    };
  });
}

/* =========================
   CLEAR WISHLIST
========================= */

if (clearWishlistBtn) {
  clearWishlistBtn.onclick = async () => {
    const token = getAuthToken();

    if (token) {
      try {
        await fetch(`${API_BASE}/api/wishlist/clear`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error(err);
      }
    }

    wishlistItems = [];
    await saveWishlist();
    updateWishlistCount();
    renderWishlist();
  };
}

/* =========================
   INIT
========================= */

loadWishlist();
updateWishlistCount();
renderWishlist();
promptWishlistLogin();

