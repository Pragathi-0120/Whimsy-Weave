const ProductApp = (() => {
    const CART_KEY = 'whimsyCart';
    const CART_FALLBACK_KEY = 'cart';
    const WISHLIST_KEY = 'whimsyWishlist';
    const WISHLIST_FALLBACK_KEY = 'wishlist';
    const REVIEWS_KEY = 'whimsyReviews';
    const API_BASE = ['8081', '8080', '5500'].includes(window.location.port)
        ? 'http://127.0.0.1:5000'
        : '';

    const isUserLoggedIn = () => Boolean(
        localStorage.getItem('authToken') && localStorage.getItem('isLoggedIn') === 'true'
    );

    const redirectToLoginAfterCart = () => {
        if (window.whimsyAuth?.promptLoginRequired) {
            window.whimsyAuth.promptLoginRequired(
                'cart.html',
                'Please login or create an account before opening your cart. Your selected items will stay saved.'
            );
            return;
        }

        localStorage.setItem('redirectAfterLogin', 'cart.html');
        window.location.href = 'login.html';
    };

    const setupCartAuthLinks = () => {
        document.querySelectorAll('a[href$="cart.html"]').forEach((link) => {
            link.addEventListener('click', (event) => {
                if (isUserLoggedIn()) return;
                event.preventDefault();
                redirectToLoginAfterCart();
            });
        });
    };

    const state = {
        products: [],
        activeProducts: [],
        cart: [],
        wishlist: [],
        filters: {
            categories: [],
            price: '',
            search: '',
            sort: ''
        }
    };

    const normalizeCategory = (value) => {
        if (!value) return '';
        return String(value)
            .toLowerCase()
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const normalizeCartItems = (items) => {
        const grouped = {};
        items.forEach((item) => {
            const id = item && typeof item === 'object' ? item.id : item;
            if (id === undefined || id === null) return;
            const normalizedId = String(id);
            const quantity = Math.max(1, Number(item && item.quantity ? item.quantity : 1) || 1);
            if (!grouped[normalizedId]) {
                grouped[normalizedId] = {
                    id: item && typeof item === 'object' ? item.id : id,
                    title: item && item.title ? item.title : undefined,
                    price: item && item.price ? item.price : undefined,
                    image: item && item.image ? item.image : undefined,
                    category: item && item.category ? item.category : undefined,
                    colors: item && item.colors ? item.colors : undefined,
                    quantity
                };
            } else {
                grouped[normalizedId].quantity += quantity;
            }
        });
        return Object.values(grouped);
    };

    // Load wishlist with dual format support
    const loadWishlist = () => {
        const whimsyWishlist = localStorage.getItem(WISHLIST_KEY);
        if (whimsyWishlist) {
            try {
                state.wishlist = JSON.parse(whimsyWishlist);
            } catch (error) {
                state.wishlist = [];
            }
        } else {
            // Try legacy format
            const legacyWishlist = localStorage.getItem(WISHLIST_FALLBACK_KEY);
            if (legacyWishlist) {
                try {
                    const parsed = JSON.parse(legacyWishlist);
                    state.wishlist = Array.isArray(parsed) ? parsed.map(item => ({
                        id: item.id || item,
                        title: item.title || '',
                        image: item.image || '',
                        category: item.category || '',
                        price: item.price || 0,
                        rating: item.rating || 4,
                        colors: item.colors || []
                    })) : [];
                    // Migrate to new format
                    localStorage.setItem(WISHLIST_KEY, JSON.stringify(state.wishlist));
                    localStorage.setItem(WISHLIST_FALLBACK_KEY, JSON.stringify(state.wishlist));
                } catch (error) {
                    state.wishlist = [];
                }
            }
        }
        updateCounters();
    };

    const dom = {
        productsGrid: document.getElementById('productsGrid'),
        resultsCount: document.getElementById('resultsCount'),
        searchInput: document.getElementById('search-input'),
        sortSelect: document.getElementById('sortSelect'),
        clearFiltersBtn: document.getElementById('clearFilters'),
        mobileFilterBtn: document.getElementById('mobileFilterBtn'),
        filtersPanel: document.querySelector('.filters'),
        categoryInputs: Array.from(document.querySelectorAll('.filter-content input[type="checkbox"]')),
        priceInputs: Array.from(document.querySelectorAll('.filter-content input[type="radio"]')),
        quickViewModal: document.getElementById('quick-view-modal'),
        quickViewTitle: document.getElementById('quick-view-title'),
        quickViewDescription: document.getElementById('quick-view-description'),
        quickViewCategory: document.getElementById('quick-view-category'),
        quickViewPrice: document.getElementById('quick-view-price'),
        quickViewStory: document.getElementById('quick-view-story'),
        quickViewImage: document.querySelector('.modal-image'),
        quickViewCart: document.getElementById('quick-view-cart'),
        quickViewWishlist: document.getElementById('quick-view-wishlist'),
        quickViewClose: document.getElementById('close-quick-view'),
        reviewForm: document.getElementById('review-form'),
        reviewProductId: document.getElementById('review-product-id'),
        reviewName: document.getElementById('review-name'),
        reviewRating: document.getElementById('review-rating'),
        reviewText: document.getElementById('review-text'),
        reviewPhoto: document.getElementById('review-photo'),
        reviewPhotoPreview: document.getElementById('review-photo-preview'),
        reviewList: document.getElementById('review-list'),
        reviewCount: document.getElementById('review-count'),
        heroBtn: document.querySelector('.hero-btn'),
        giftOccasion: document.getElementById('giftOccasion'),
        giftBudget: document.getElementById('giftBudget'),
        giftStyle: document.getElementById('giftStyle'),
        findGiftBtn: document.getElementById('findGiftBtn'),
        giftResults: document.getElementById('giftResults'),
        cartCount: document.getElementById('cart-count'),
        wishlistCount: document.getElementById('wishlist-count')
    };

    const CATEGORY_SWATCHES = {
        bouquets: ['#f3c1c6', '#f7efe6', '#d7b7a5'],
        plushies: ['#f7efe6', '#6f4e3f', '#d7b7a5'],
        'hair accessories': ['#f3c1c6', '#fbf6f1', '#e9c9c0'],
        wearables: ['#d7b7a5', '#f3d2c5', '#6f4e3f'],
        accessories: ['#f7efe6', '#e9c9c0', '#6f4e3f'],
        blankets: ['#f7efe6', '#d7b7a5', '#fbf6f1']
    };

    const getColorOptions = (product) => {
        if (Array.isArray(product.colors) && product.colors.length) {
            return product.colors.slice(0, 4);
        }
        const normalizedCategory = normalizeCategory(product.category);
        return CATEGORY_SWATCHES[normalizedCategory] || ['#f3c1c6', '#d7b7a5', '#fbf6f1'];
    };

    const getCraftStory = (product) => {
        const category = normalizeCategory(product.category);
        const title = normalizeText(product.title);
        if (category.includes('bouquet')) {
            return { time: '2-4 days', material: 'Cotton yarn blooms', care: 'Dust gently' };
        }
        if (category.includes('wearable') || title.includes('cardigan')) {
            return { time: '6-10 days', material: 'Breathable cotton', care: 'Hand wash cold' };
        }
        if (category.includes('kids') || category.includes('blanket')) {
            return { time: '7-12 days', material: 'Soft baby yarn', care: 'Dry flat' };
        }
        if (category.includes('hair')) {
            return { time: '1-2 days', material: 'Gentle stretch yarn', care: 'Spot clean' };
        }
        if (category.includes('accessories')) {
            return { time: '1-3 days', material: 'Sturdy charm yarn', care: 'Keep dry' };
        }
        return { time: '3-5 days', material: 'Soft acrylic yarn', care: 'Spot clean' };
    };

    const storyMarkup = (product) => {
        const story = getCraftStory(product);
        return `
          <div class="craft-story" aria-label="Handmade details">
            <span class="story-chip">${story.time}</span>
            <span class="story-chip">${story.material}</span>
            <span class="story-chip">${story.care}</span>
          </div>
        `;
    };
    

    const getCartCount = () => state.cart.reduce((total, item) => {
        if (!item) return total;
        if (typeof item === 'object') {
            return total + (Number(item.quantity) || 1);
        }
        return total + 1;
    }, 0);
    const getWishlistCount = () => state.wishlist.length;

    const updateCounters = () => {
        if (dom.cartCount) {
            dom.cartCount.textContent = getCartCount();
        }
        if (dom.wishlistCount) {
            dom.wishlistCount.textContent = getWishlistCount();
        }
    };

    const normalizeImagePath = (src) => {
        if (!src) {
            return './img/placeholder.svg';
        }
        const trimmed = String(src).trim();
        if (/^(https?:|data:|\/)/.test(trimmed)) {
            return trimmed;
        }
        let normalized = trimmed.replace(/^(?:\.\.\/)+/, './');
        normalized = normalized.replace(/^\.\/?img\/img\/images\//, './img/images/');
        normalized = normalized.replace(/^\.\/?img\/images\//, './img/images/');
        return encodeURI(normalized);
    };

    const saveState = () => {
        state.cart = normalizeCartItems(state.cart);
        try {
            /*localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
            localStorage.setItem(CART_FALLBACK_KEY, JSON.stringify(state.cart));*/
        } catch (error) {
            // ignore storage errors in private browsing
        }
        try {
            localStorage.setItem(WISHLIST_KEY, JSON.stringify(state.wishlist));
            localStorage.setItem(WISHLIST_FALLBACK_KEY, JSON.stringify(state.wishlist));
        } catch (error) {
            // ignore storage errors in private browsing
        }
        updateCounters();
    };

    const renderStars = (rating) => {
        const value = Math.min(Math.max(Math.round(rating || 4), 0), 5);
        let stars = '';
        for (let i = 1; i <= 5; i += 1) {
            stars += i <= value ? '\u2605' : '\u2606';
        }
        return stars;
    };

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const safeImageUrl = (value) => {
        const url = normalizeImagePath(value);
        return /^(https?:|data:image\/|\.\/|\/)/i.test(url)
            ? escapeHtml(url)
            : './img/placeholder.svg';
    };

    const getAllReviews = () => {
        try {
            const stored = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');
            return stored && typeof stored === 'object' ? stored : {};
        } catch (error) {
            return {};
        }
    };

    const saveAllReviews = (reviews) => {
        localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    };

    const getProductReviews = (productId) => {
        const reviews = getAllReviews();
        return Array.isArray(reviews[String(productId)]) ? reviews[String(productId)] : [];
    };

    const normalizeReview = (review) => ({
        id: review.id || Date.now(),
        name: review.name || review.userName || 'Whimsy Customer',
        rating: Number(review.rating) || 5,
        text: review.text || review.comment || '',
        photo: review.photo || '',
        date: review.date || (review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }) : '')
    });

    const fetchProductReviews = async (productId) => {
        const response = await fetch(`${API_BASE}/api/products/${productId}/reviews`);
        if (!response.ok) {
            throw new Error(`Could not load reviews: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data.reviews) ? data.reviews.map(normalizeReview) : [];
    };

    const saveProductReview = async (productId, review) => {
        const token = localStorage.getItem('authToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}/api/products/${productId}/reviews`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: review.name,
                rating: review.rating,
                comment: review.text,
                photo: review.photo
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || `Could not save review: ${response.status}`);
        }
        return normalizeReview(data.review || review);
    };

    const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const updatePhotoPreview = () => {
        if (!dom.reviewPhotoPreview || !dom.reviewPhoto) return;
        const file = dom.reviewPhoto.files && dom.reviewPhoto.files[0];
        dom.reviewPhotoPreview.innerHTML = file ? `<span>${escapeHtml(file.name)}</span>` : '';
    };

    const renderReviewItems = (reviews) => {
        if (!dom.reviewList || !dom.reviewCount) return;
        dom.reviewCount.textContent = `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`;

        if (!reviews.length) {
            dom.reviewList.innerHTML = '<p class="review-empty">No reviews yet. Be the first to share one.</p>';
            return;
        }

        dom.reviewList.innerHTML = reviews.map((review) => `
            <article class="review-card">
                ${review.photo ? `<img src="${safeImageUrl(review.photo)}" alt="Customer review photo" />` : ''}
                <div>
                    <div class="review-card-top">
                        <strong>${escapeHtml(review.name)}</strong>
                        <span>${renderStars(Number(review.rating) || 5)}</span>
                    </div>
                    <p>${escapeHtml(review.text)}</p>
                    <small>${escapeHtml(review.date)}</small>
                </div>
            </article>
        `).join('');
    };

    const renderReviews = async (productId) => {
        if (!dom.reviewList || !dom.reviewCount) return;
        dom.reviewCount.textContent = 'Loading...';
        dom.reviewList.innerHTML = '<p class="review-empty">Loading reviews...</p>';
        try {
            const reviews = await fetchProductReviews(productId);
            renderReviewItems(reviews);
        } catch (error) {
            console.warn('Backend review load failed, using local reviews:', error);
            renderReviewItems(getProductReviews(productId).map(normalizeReview));
        }
    };

    const createProductCard = (product) => {
        const colors = getColorOptions(product);
        const stockLabel = product.stock > 0 ? 'In stock' : 'Sold out';
        const isInWishlist = state.wishlist.some((item) => String(item.id || item) === String(product.id));

        return `
      <article class="product-card" data-id="${escapeHtml(product.id)}">
        <div class="stock-badge">${escapeHtml(stockLabel)}</div>
        <div class="product-image">
          <img src="${safeImageUrl(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.onerror=null;this.src='./img/placeholder.svg'" />
        </div>

        <div class="product-content">
          <p class="product-category">${escapeHtml(product.category)}</p>
          <h3 class="product-title">${escapeHtml(product.title)}</h3>
          <p class="product-description">${escapeHtml(product.description || '')}</p>
           <div class="rating">${renderStars(Number(product.rating) || 4)} <span>${Number(product.rating || 4).toFixed(1)}</span></div>
          <div class="color-list">
            ${colors.map((color) => `<span class="color-swatch" style="background:${color};"></span>`).join('')}
          </div>
          ${storyMarkup(product)}
          <p class="product-price">&#8377;${product.price}</p>
          <div class="card-actions">
            <button class="small-btn wishlist-btn" data-action="wishlist">${isInWishlist ? '&#9829; Saved' : '&#9825; Wishlist'}</button>
            <button class="small-btn button-primary" data-action="cart">Add to cart</button>
          </div>
          <button class="small-btn quick-btn" data-action="quick-view">Quick view</button>
        </div>
      </article>
    `;
    };

    const renderSkeletons = () => {
        if (!dom.productsGrid) return;
        dom.productsGrid.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="product-card skeleton-card">
        <div class="skeleton-image"></div>
        <div class="product-content">
          <div class="skeleton-line" style="width:35%"></div>
          <div class="skeleton-line" style="width:60%"></div>
          <div class="skeleton-line" style="width:90%"></div>
          <div class="skeleton-row">
            <div class="skeleton-line" style="width:20%"></div>
            <div class="skeleton-line" style="width:25%"></div>
          </div>
          <div class="skeleton-row">
            <div class="skeleton-line" style="width:40%"></div>
            <div class="skeleton-line" style="width:40%"></div>
          </div>
        </div>
      </div>
    `).join('');
    };

    const renderProducts = () => {
        if (!dom.productsGrid) return;
        const items = state.activeProducts;
        dom.resultsCount.textContent = Array.isArray(items) ? items.length : 0;

        if (!Array.isArray(items) || !items.length) {
            dom.productsGrid.innerHTML = '<p class="no-results">No products match your search or selected filters.</p>';
            return;
        }

        dom.productsGrid.innerHTML = items.map(createProductCard).join('');
    };

    const normalizeText = (value) => String(value || '').toLowerCase().trim();

    const productMatchesBudget = (product, budget) => {
        if (budget === 'under-500') return product.price < 500;
        if (budget === '500-1000') return product.price >= 500 && product.price <= 1000;
        if (budget === '1000-3000') return product.price >= 1000 && product.price <= 3000;
        if (budget === 'above-3000') return product.price > 3000;
        return true;
    };

    const getGiftKeywords = (occasion, style) => {
        const keywords = {
            birthday: ['plush', 'accessories', 'hair', 'charm'],
            baby: ['kids', 'blanket', 'baby'],
            'self-care': ['wearable', 'bandana', 'scrunchies', 'cardigan'],
            romantic: ['bouquet', 'flower', 'floral']
        };
        const styleKeywords = {
            cute: ['plush', 'charm', 'bow', 'scrunchies'],
            floral: ['bouquet', 'flower', 'floral', 'sunflower'],
            wearable: ['wearable', 'cardigan', 'bandana', 'coverup'],
            keepsake: ['blanket', 'idol', 'bouquet', 'doll']
        };
        return [...(keywords[occasion] || []), ...(styleKeywords[style] || [])];
    };

    const renderGiftFinder = () => {
        if (!dom.giftResults) return;
        const occasion = dom.giftOccasion?.value || 'birthday';
        const budget = dom.giftBudget?.value || 'under-500';
        const style = dom.giftStyle?.value || 'cute';
        const keywords = getGiftKeywords(occasion, style);

        let matches = state.products.filter((product) => {
            const haystack = `${product.title} ${product.category} ${product.description}`.toLowerCase();
            return productMatchesBudget(product, budget) && keywords.some((keyword) => haystack.includes(keyword));
        });

        if (!matches.length) {
            matches = state.products.filter((product) => productMatchesBudget(product, budget));
        }

        matches = matches.slice(0, 3);

        if (!matches.length) {
            dom.giftResults.innerHTML = '<p class="no-results">No gift matches yet. Try a different budget.</p>';
            return;
        }

        dom.giftResults.innerHTML = matches.map((product) => `
            <article class="gift-result-card">
                <img src="${normalizeImagePath(product.image)}" alt="${product.title}" loading="lazy" onerror="this.onerror=null;this.src='./img/placeholder.svg'" />
                <div>
                    <p class="eyebrow">Gift pick</p>
                    <h3>${product.title}</h3>
                    <p>&#8377;${product.price} &middot; ${getCraftStory(product).time}</p>
                </div>
            </article>
        `).join('');
    };

    const applyFilters = () => {
        const { categories, price, search, sort } = state.filters;
        let filtered = Array.isArray(state.products) ? [...state.products] : [];


        if (categories.length) {
            filtered = filtered.filter((product) => {
                const category = normalizeCategory(product.category);
                return categories.some((filterCategory) => category.includes(normalizeText(filterCategory)));
            });
        }

        if (price) {
            filtered = filtered.filter((product) => {
                if (price === 'under-500') return product.price < 500;
                if (price === '500-1000') return product.price >= 500 && product.price <= 1000;
                if (price === '1000-3000') return product.price >= 1000 && product.price <= 3000;
                if (price === 'above-3000') return product.price > 3000;
                return true;
            });
        }

        if (search) {
            filtered = filtered.filter((product) => normalizeText(product.title).includes(search) || normalizeText(product.description).includes(search) || normalizeText(product.category).includes(search));
        }

        if (sort === 'low') {
            filtered.sort((a, b) => a.price - b.price);
        }
        if (sort === 'high') {
            filtered.sort((a, b) => b.price - a.price);
        }
        if (sort === 'rating') {
            filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
        if (sort === 'featured') {
            filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        }

        state.activeProducts = filtered;
        renderProducts();
    };

 const addToCart = async (productId) => {

    const product = state.products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    let cart = JSON.parse(
        localStorage.getItem("whimsyCart") || "[]"
    );

    const existing = cart.find(
        item => String(item.id) === String(productId)
    );

    if (existing) {

        existing.quantity =
            Number(existing.quantity || 1) + 1;

    } else {

        const colors = getColorOptions(product);

        cart.push({
            id: product.id,
            title: product.title,
            image: product.image,
            category: product.category,
            price: Number(product.price),
            colors,
            quantity: 1
        });
    }

    localStorage.setItem(
        "whimsyCart",
        JSON.stringify(cart)
    );

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );

    state.cart = cart;

    updateCounters();

    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            await fetch(`${API_BASE}/api/cart/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    productId: product.id,
                    quantity: 1
                })
            });
        } catch (error) {
            console.error('Backend cart sync failed:', error);
        }
    }
};  


    const toggleWishlist = async (productId) => {
        const existingIndex = state.wishlist.findIndex((item) => String(item.id || item) === String(productId));
        if (existingIndex >= 0) {
            state.wishlist.splice(existingIndex, 1);
        } else {
            const product = state.products.find(
    (item) => String(item.id) === String(productId)
);
            if (!product) return;
            const colors = getColorOptions(product);
            state.wishlist.push({
                id: product.id,
                title: product.title,
                image: product.image,
                category: product.category,
                price: product.price,
                rating: product.rating || 4,
                colors
            });
        }
        saveState();
        await saveWishlistToBackend();
        renderProducts();
    };
    const saveWishlistToBackend = async () => {

    const token = localStorage.getItem('authToken');

    if (!token) return;

    try {

        const payload = {
            items: state.wishlist.map(item => ({
                productId: item.id
            }))
        };

        console.log(
            "Saving wishlist to backend:",
            payload
        );

        const response = await fetch(
            `${API_BASE}/api/wishlist/bulk`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        console.log(
            "Wishlist backend response:",
            data
        );

    } catch (error) {

        console.error(
            "Wishlist backend save failed:",
            error
        );
    }
};

  const openQuickView = (productId) => {

    const product =
        state.products.find(
            (item) =>
                String(item.id) ===
                String(productId)
        );

    if (!product || !dom.quickViewModal) {
        return;
    }

    dom.quickViewTitle.textContent =
        product.title ||
        'Handmade Crochet Piece';

    dom.quickViewDescription.textContent =
        product.description ||
        'Luxury crochet treasure handmade with love.';

    dom.quickViewCategory.textContent =
        product.category ||
        'Crochet';

    dom.quickViewPrice.textContent =
        `\u20B9${product.price || 0}`;

    if (dom.quickViewStory) {
        const story = getCraftStory(product);
        dom.quickViewStory.innerHTML = `
            <div class="modal-story-card">
                <span>Make time</span>
                <b>${story.time}</b>
            </div>
            <div class="modal-story-card">
                <span>Material</span>
                <b>${story.material}</b>
            </div>
            <div class="modal-story-card">
                <span>Care</span>
                <b>${story.care}</b>
            </div>
        `;
    }

    dom.quickViewImage.innerHTML = `
        <img
            src="${product.image}"
            alt="${product.title}"
            class="modal-product-image"
        />
    `;

    dom.quickViewCart.dataset.productId =
        product.id;

    dom.quickViewWishlist.dataset.productId =
        product.id;

    if (dom.reviewProductId) {
        dom.reviewProductId.value = product.id;
    }

    if (dom.reviewForm) {
        dom.reviewForm.reset();
    }

    if (dom.reviewPhotoPreview) {
        dom.reviewPhotoPreview.innerHTML = '';
    }

    renderReviews(product.id);

    dom.quickViewModal.classList.add(
        'visible'
    );

    dom.quickViewModal.setAttribute(
        'aria-hidden',
        'false'
    );
};

    const closeQuickView = () => {

    dom.quickViewModal.classList.remove(
        'visible'
    );

    dom.quickViewModal.setAttribute(
        'aria-hidden',
        'true'
    );
};

    const attachEvents = () => {
        // cross-tab storage updates handled below

        if (dom.searchInput) {
            dom.searchInput.addEventListener('input', (event) => {
                state.filters.search = normalizeText(event.target.value);
                applyFilters();
            });
        }

        if (dom.sortSelect) {
            dom.sortSelect.addEventListener('change', (event) => {
                state.filters.sort = event.target.value;
                applyFilters();
            });
        }

        if (dom.clearFiltersBtn) {
            dom.clearFiltersBtn.addEventListener('click', () => {
                state.filters = { categories: [], price: '', search: '', sort: '' };
                if (dom.searchInput) dom.searchInput.value = '';
                if (dom.sortSelect) dom.sortSelect.value = '';
                dom.categoryInputs.forEach((input) => { input.checked = false; });
                dom.priceInputs.forEach((input) => { input.checked = false; });
                applyFilters();
            });
        }


        dom.categoryInputs.forEach((input) => {
            input.addEventListener('change', () => {
                state.filters.categories = dom.categoryInputs.filter((item) => item.checked).map((item) => normalizeText(item.value));
                applyFilters();
            });
        });

        dom.priceInputs.forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    state.filters.price = input.value;
                }
                applyFilters();
            });
        });

        if (dom.productsGrid) {
            dom.productsGrid.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                const card = event.target.closest('.product-card');
                if (!button || !card) return;

                const productId = Number(card.dataset.id);
                const action = button.dataset.action;

                if (action === 'cart') {
                    addToCart(productId);
                    return;
                }

                if (action === 'wishlist') {
                    toggleWishlist(productId);
                    return;
                }

                if (action === 'quick-view') {

    openQuickView(productId);

    return;
}
            });
        }

       if (dom.quickViewClose) {

    dom.quickViewClose.addEventListener(
        'click',
        closeQuickView
    );
}

if (dom.quickViewModal) {

    dom.quickViewModal.addEventListener(
        'click',
        (event) => {

            if (
                event.target ===
                dom.quickViewModal
            ) {

                closeQuickView();
            }
        }
    );
}

        

        window.addEventListener('storage', (event) => {
            if ([WISHLIST_KEY, WISHLIST_FALLBACK_KEY, CART_KEY, CART_FALLBACK_KEY].includes(event.key)) {
                loadWishlist();
                loadCart();
                renderProducts();
            }
        });

        if (dom.quickViewCart) {
            dom.quickViewCart.addEventListener('click', (event) => {
                const productId = Number(event.target.dataset.productId);
                addToCart(productId);
                closeQuickView();
            });
        }

        if (dom.quickViewWishlist) {
            dom.quickViewWishlist.addEventListener('click', (event) => {
                const productId = Number(event.target.dataset.productId);
                toggleWishlist(productId);
                closeQuickView();
            });
        }

        if (dom.reviewPhoto) {
            dom.reviewPhoto.addEventListener('change', updatePhotoPreview);
        }

        if (dom.reviewForm) {
            dom.reviewForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const productId = dom.reviewProductId?.value;
                if (!productId) return;

                const photoFile = dom.reviewPhoto?.files && dom.reviewPhoto.files[0];
                const photo = photoFile ? await fileToDataUrl(photoFile) : '';
                const draftReview = {
                    name: dom.reviewName.value.trim() || 'Whimsy Customer',
                    rating: Number(dom.reviewRating.value) || 5,
                    text: dom.reviewText.value.trim(),
                    photo,
                    date: new Date().toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    })
                };

                try {
                    await saveProductReview(productId, draftReview);
                    dom.reviewForm.reset();
                    updatePhotoPreview();
                    await renderReviews(productId);
                } catch (error) {
                    console.warn('Backend review save failed, saving locally:', error);
                    const reviews = getAllReviews();
                    const productReviews = Array.isArray(reviews[String(productId)]) ? reviews[String(productId)] : [];
                    productReviews.unshift({ id: Date.now(), ...draftReview });
                    reviews[String(productId)] = productReviews;
                    saveAllReviews(reviews);
                    dom.reviewForm.reset();
                    updatePhotoPreview();
                    renderReviewItems(productReviews.map(normalizeReview));
                }
            });
        }

        if (dom.heroBtn) {
            dom.heroBtn.addEventListener('click', () => {
                dom.productsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        [dom.giftOccasion, dom.giftBudget, dom.giftStyle].forEach((select) => {
            if (select) {
                select.addEventListener('change', renderGiftFinder);
            }
        });

        if (dom.findGiftBtn) {
            dom.findGiftBtn.addEventListener('click', renderGiftFinder);
        }
    };

    const loadCartFromStorage = () => {
        const storedCart = localStorage.getItem(CART_KEY) || localStorage.getItem(CART_FALLBACK_KEY);
        if (!storedCart) {
            state.cart = [];
            updateCounters();
            return [];
        }
        try {
            const parsed = JSON.parse(storedCart);
            state.cart = normalizeCartItems(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
            state.cart = [];
        }
        updateCounters();
        return state.cart;
    };

    const loadCart = async () => {
        const token = localStorage.getItem('authToken');

        if (token) {
            try {
                const response = await fetch(`${API_BASE}/api/cart/`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    const json = await response.json();
                    const backendItems = Array.isArray(json.cart?.items) ? json.cart.items : [];
                    state.cart = backendItems.map(item => ({
                        id: item.productId,
                        title: item.name || 'Handmade Item',
                        image: item.image || './img/placeholder.svg',
                        price: Number(item.price) || 0,
                        category: item.category || '',
                        quantity: Math.max(1, Number(item.quantity) || 1)
                    }));

                    if (state.cart.length) {
                        localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
                        localStorage.setItem(CART_FALLBACK_KEY, JSON.stringify(state.cart));
                        updateCounters();
                        return state.cart;
                    }
                }
            } catch (error) {
                console.warn('Product page cart counter backend load failed:', error);
            }
        }

        return loadCartFromStorage();
    };

    const fetchProducts = async () => {
        if (!dom.productsGrid) return;
        renderSkeletons();
        try {
            const response = await fetch(`${API_BASE}/api/products/?limit=200`);
            if (!response.ok) {
                throw new Error(`Could not load products: ${response.status} ${response.statusText}`);
            }
            const json = await response.json();
            console.log('Products API response:', json);

            let productsArray = [];
            if (Array.isArray(json)) {
                productsArray = json;
            } else if (Array.isArray(json.products)) {
                productsArray = json.products;
            } else if (json && Array.isArray(json.data)) {
                productsArray = json.data;
            } else {
                // Some backends return { success: true, products: [...] }
                // Others might return { products: [...] } directly.
                productsArray = [];
            }

            state.products = productsArray.map((product) => ({
                ...product,
                image: normalizeImagePath(product.image),
                price: Number(product.price) || 0,
                rating: Number(product.rating) || Number(product.ratings?.average) || 4.3,
                featured: Boolean(product.featured || product.is_featured || product.isFeatured),
                stock: Number(product.stock || product.quantity || 0) || 0
            }));

          /*  state.cart = normalizeCartItems(state.cart).map((item) => {
                if (item.title && item.price) {
                    return item;
                }
                const matched = state.products.find((product) => String(product.id) === String(item.id));
                return {
                    ...item,
                    title: matched?.title || item.title || 'Handmade Item',
                    price: matched?.price || item.price || 0,
                    image: matched?.image || item.image || './img/placeholder.svg',
                    category: matched?.category || item.category || 'Handmade',
                    colors: matched?.colors || item.colors || []
                };
            });*/
            // AUTO CHECK CATEGORY FILTERS

if (state.filters.categories.length) {

    dom.categoryInputs.forEach((input) => {

        if (
            state.filters.categories.includes(
                normalizeText(input.value)
            )
        ) {
            input.checked = true;
        }

    });

}
            applyFilters();
            renderGiftFinder();
            
      } catch (error) {

    try {
        const fallbackResponse = await fetch('./data/db.json');
        if (!fallbackResponse.ok) {
            throw new Error('Local product data unavailable');
        }
        const fallbackJson = await fallbackResponse.json();
        const fallbackProducts = Array.isArray(fallbackJson.products) ? fallbackJson.products : [];
        state.products = fallbackProducts.map((product) => ({
            ...product,
            image: normalizeImagePath(product.image),
            price: Number(product.price) || 0,
            rating: Number(product.rating) || 4.3,
            featured: Boolean(product.featured),
            stock: Number(product.stock || product.quantity || 8) || 8
        }));
        applyFilters();
        renderGiftFinder();
    } catch (fallbackError) {
        if (dom.productsGrid) {
            dom.productsGrid.innerHTML =
            '<p class="no-results">Unable to load products.</p>';
        }
        console.error(fallbackError);
    }

    console.warn('Product API unavailable; using local product data:', error);
}
    };

 const init = async () => {

    setupCartAuthLinks();

    loadWishlist();

    await loadCart();

    attachEvents();

    const params = new URLSearchParams(
        window.location.search
    );

    const categoryFromURL =
        params.get('category');

    if (categoryFromURL) {

        state.filters.categories = [
            normalizeText(categoryFromURL)
        ];
    }

    fetchProducts();
};
    return { init };
})();

window.addEventListener('DOMContentLoaded', () => {
    ProductApp.init();
})

;
