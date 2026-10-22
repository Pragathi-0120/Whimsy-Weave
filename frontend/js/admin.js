const API_BASE_URL = window.location.port === '8081' || window.location.port === '8080' || window.location.port === '5500'
  ? 'http://127.0.0.1:5000/api'
  : '/api';

const TOKEN_KEYS = ['authToken', 'admin_jwt_token'];
const USER_KEYS = ['user', 'admin_user'];
const ORDER_STATUSES = ['Order Confirmed', 'Preparing Your Cozy Package', 'Shipped', 'Out for Delivery', 'Delivered', 'cancelled'];

let currentSection = 'dashboard';
let productsCache = [];
let reviewsCache = [];
let ordersCache = [];
let customOrdersCache = [];
let workshopsCache = [];
let usersCache = [];
let subscribersCache = [];

document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (!token) {
    localStorage.setItem('redirectAfterLogin', 'admin.html');
    window.location.href = './login.html';
    return;
  }

  const user = getStoredUser();
  document.getElementById('admin-name').textContent = user.name || user.email || 'Admin';
  document.querySelector('.admin-avatar-text').textContent = (user.name || user.email || 'A').slice(0, 1).toUpperCase();
  loadDashboard();
});

function getToken() {
  return TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || '';
}

function getStoredUser() {
  for (const key of USER_KEYS) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      if (value && Object.keys(value).length) return value;
    } catch {}
  }
  return {};
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : {};

  if (response.status === 401 || response.status === 403) {
    showNotification('Admin access required. Please login with an admin account.', 'error');
    throw new Error(payload.message || 'Admin access required');
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function date(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

function dateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function badge(value, fallback = 'unknown') {
  const label = String(value || fallback);
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `<span class="badge badge-${safe}">${escapeHtml(label)}</span>`;
}

function emptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}">${message}</td></tr>`;
}

function navigateTo(section, evt) {
  currentSection = section;
  document.querySelectorAll('.section').forEach((node) => node.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((node) => node.classList.remove('active'));

  const sectionNode = document.getElementById(`${section}-section`);
  if (sectionNode) sectionNode.classList.add('active');
  if (evt?.currentTarget) evt.currentTarget.classList.add('active');

  const titles = {
    dashboard: 'Admin Dashboard',
    products: 'Products Management',
    orders: 'Orders Management',
    'custom-orders': 'Custom Orders',
    workshops: 'Workshop Registrations',
    reviews: 'Reviews Management',
    users: 'Users Management',
    subscribers: 'Newsletter Subscribers'
  };
  document.getElementById('page-title').textContent = titles[section] || 'Admin Panel';

  const loaders = {
    dashboard: loadDashboard,
    products: loadProducts,
    orders: loadOrders,
    'custom-orders': loadCustomOrders,
    workshops: loadWorkshops,
    reviews: loadReviews,
    users: loadUsers,
    subscribers: loadSubscribers
  };
  loaders[section]?.();
}

function toggleSidebar() {
  document.querySelector('.admin-sidebar')?.classList.toggle('collapsed');
}

async function loadDashboard() {
  try {
    const data = await apiFetch('/admin/dashboard');
    const dashboard = data.dashboard || {};

    document.getElementById('stat-users').textContent = dashboard.totalUsers || 0;
    document.getElementById('stat-products').textContent = dashboard.totalProducts || 0;
    document.getElementById('stat-orders').textContent = dashboard.totalOrders || 0;
    document.getElementById('stat-reviews').textContent = dashboard.totalReviews || 0;
    document.getElementById('stat-revenue').textContent = money(dashboard.totalRevenue);
    document.getElementById('stat-custom').textContent = dashboard.totalCustomOrders || 0;
    document.getElementById('stat-workshops').textContent = dashboard.totalWorkshops || 0;
    document.getElementById('stat-subscribers').textContent = dashboard.totalSubscribers || 0;

    const recent = dashboard.recentOrders || [];
    document.getElementById('recent-orders-body').innerHTML = recent.length ? recent.map((order) => `
      <tr>
        <td>#${order.id}</td>
        <td>${escapeHtml(order.userName || `User #${order.userId}`)}</td>
        <td>${money(order.totalPrice)}</td>
        <td>${badge(order.status)}</td>
        <td>${escapeHtml(order.trackingNumber || '-')}</td>
        <td>${date(order.createdAt)}</td>
      </tr>
    `).join('') : emptyRow(6, 'No recent orders yet.');
  } catch (error) {
    showNotification(`Error loading dashboard: ${error.message}`, 'error');
  }
}

async function loadProducts() {
  const tbody = document.getElementById('products-body');
  tbody.innerHTML = emptyRow(7, 'Loading products...');
  try {
    const data = await apiFetch('/admin/products');
    productsCache = data.products || [];
    renderProducts(productsCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(7, error.message);
    showNotification(`Error loading products: ${error.message}`, 'error');
  }
}

function renderProducts(products) {
  const tbody = document.getElementById('products-body');
  tbody.innerHTML = products.length ? products.map((product) => `
    <tr>
      <td>#${product.id}</td>
      <td>${escapeHtml(product.name || product.title)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${money(product.price)}</td>
      <td>${Number(product.stock ?? product.inventory?.quantity ?? 0)}</td>
      <td>${badge(product.isFeatured || product.featured ? 'featured' : 'standard')}</td>
      <td>
        <button class="btn btn-sm btn-edit" onclick="editProduct(${product.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">Delete</button>
      </td>
    </tr>
  `).join('') : emptyRow(7, 'No products found.');
}

function openAddProductForm() {
  const form = document.getElementById('productForm');
  form.reset();
  delete form.dataset.productId;
  document.getElementById('product-modal-title').textContent = 'Add Product';
  document.getElementById('productModal').style.display = 'flex';
}

async function editProduct(productId) {
  try {
    const data = await apiFetch(`/admin/products/${productId}`);
    const product = data.product;
    const form = document.getElementById('productForm');
    form.dataset.productId = productId;

    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('product-name').value = product.name || product.title || '';
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-image').value = product.image || product.images?.[0]?.url || '';
    document.getElementById('product-price').value = product.price || 0;
    document.getElementById('product-quantity').value = product.stock ?? product.inventory?.quantity ?? 0;
    document.getElementById('product-category').value = product.category || '';
    document.getElementById('product-tags').value = (product.tags || []).join(', ');
    document.getElementById('product-featured').checked = Boolean(product.isFeatured || product.featured);
    document.getElementById('productModal').style.display = 'flex';
  } catch (error) {
    showNotification(`Error loading product: ${error.message}`, 'error');
  }
}

async function saveProduct(event) {
  event.preventDefault();
  const form = document.getElementById('productForm');
  const productId = form.dataset.productId;
  const image = document.getElementById('product-image').value.trim();
  const payload = {
    name: document.getElementById('product-name').value.trim(),
    description: document.getElementById('product-description').value.trim(),
    price: Number(document.getElementById('product-price').value || 0),
    category: document.getElementById('product-category').value,
    quantity: Number(document.getElementById('product-quantity').value || 0),
    stock: Number(document.getElementById('product-quantity').value || 0),
    image,
    images: image ? [{ url: image }] : [],
    tags: document.getElementById('product-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
    isFeatured: document.getElementById('product-featured').checked
  };

  try {
    await apiFetch(productId ? `/admin/products/${productId}` : '/admin/products', {
      method: productId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    showNotification(productId ? 'Product updated successfully' : 'Product added successfully', 'success');
    closeProductModal();
    loadProducts();
    loadDashboard();
  } catch (error) {
    showNotification(`Error saving product: ${error.message}`, 'error');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;
  try {
    await apiFetch(`/admin/products/${productId}`, { method: 'DELETE' });
    showNotification('Product deleted successfully', 'success');
    loadProducts();
    loadDashboard();
  } catch (error) {
    showNotification(`Error deleting product: ${error.message}`, 'error');
  }
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
}

function searchProducts() {
  const term = document.getElementById('product-search').value.toLowerCase();
  renderProducts(productsCache.filter((product) => `${product.name} ${product.title} ${product.category} ${product.description}`.toLowerCase().includes(term)));
}

async function loadOrders() {
  const tbody = document.getElementById('orders-body');
  tbody.innerHTML = emptyRow(8, 'Loading orders...');
  try {
    const status = document.getElementById('order-status-filter').value;
    const data = await apiFetch(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    ordersCache = data.orders || [];
    renderOrders(ordersCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(8, error.message);
    showNotification(`Error loading orders: ${error.message}`, 'error');
  }
}

function renderOrders(orders) {
  document.getElementById('orders-body').innerHTML = orders.length ? orders.map((order) => `
    <tr>
      <td>#${order.id}</td>
      <td>${escapeHtml(order.userName || 'Customer')}</td>
      <td>${money(order.totalPrice)}</td>
      <td>${badge(order.status)}</td>
      <td>${badge(order.isPaid ? 'paid' : 'pending')}</td>
      <td>${escapeHtml(order.trackingNumber || '-')}</td>
      <td>${date(order.createdAt)}</td>
      <td><button class="btn btn-sm btn-view" onclick="viewOrder(${order.id})">View</button></td>
    </tr>
  `).join('') : emptyRow(8, 'No orders found.');
}

async function viewOrder(orderId) {
  try {
    const data = await apiFetch(`/admin/orders/${orderId}`);
    const order = data.order;
    const address = order.shippingAddress || {};
    const items = order.items || [];

    document.getElementById('orderDetails').innerHTML = `
      <div class="order-details-grid">
        <div class="detail-section">
          <h3>Order Information</h3>
          <p><strong>Order ID:</strong> #${order.id}</p>
          <p><strong>Status:</strong> ${badge(order.status)}</p>
          <p><strong>Tracking:</strong> ${escapeHtml(order.trackingNumber || '-')}</p>
          <p><strong>Estimated Delivery:</strong> ${date(order.estimatedDelivery)}</p>
          <p><strong>Date:</strong> ${dateTime(order.createdAt)}</p>
          <p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod || '-')} / ${order.isPaid ? 'Paid' : 'Pending'}</p>
        </div>
        <div class="detail-section">
          <h3>Customer</h3>
          <p><strong>Name:</strong> ${escapeHtml(order.userName || address.name || '-')}</p>
          <p><strong>Email:</strong> ${escapeHtml(order.userEmail || address.email || '-')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(address.phone || '-')}</p>
          <p>${escapeHtml(address.address || address.street || '')}</p>
          <p>${escapeHtml([address.city, address.state, address.pincode || address.pinCode].filter(Boolean).join(', '))}</p>
        </div>
      </div>
      <div class="detail-section">
        <h3>Update Tracking</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Status</label>
            <select id="order-update-status">${ORDER_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${status === order.status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select>
          </div>
          <div class="form-group">
            <label>Tracking Number</label>
            <input id="order-update-tracking" value="${escapeHtml(order.trackingNumber || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Estimated Delivery</label>
            <input id="order-update-delivery" type="date" value="${order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString().slice(0, 10) : ''}">
          </div>
          <div class="form-group">
            <label>Notes</label>
            <input id="order-update-notes" value="${escapeHtml(order.notes || '')}">
          </div>
        </div>
        <div style="margin-bottom: 1rem; display: flex; gap: 1.5rem; align-items: center;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600;">
            <input type="checkbox" id="order-update-paid" ${order.isPaid ? 'checked' : ''}> Order is Paid
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600;">
            <input type="checkbox" id="order-update-email"> Email customer update
          </label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" onclick="updateOrder(${order.id})">Save Order Update</button></div>
      </div>
      <div class="detail-section">
        <h3>Order Items</h3>
        <table class="data-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
          <tbody>${items.length ? items.map((item) => `
            <tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.price)}</td><td>${money(item.price * item.quantity)}</td></tr>
          `).join('') : emptyRow(4, 'No items found.')}</tbody>
        </table>
      </div>
      <div class="order-summary">
        <p><strong>Items Total:</strong> ${money(order.itemsPrice)}</p>
        <p><strong>Tax:</strong> ${money(order.taxPrice)}</p>
        <p><strong>Shipping:</strong> ${money(order.shippingPrice)}</p>
        <p><strong>Total:</strong> ${money(order.totalPrice)}</p>
      </div>
    `;
    document.getElementById('orderModal').style.display = 'flex';
  } catch (error) {
    showNotification(`Error loading order: ${error.message}`, 'error');
  }
}

async function updateOrder(orderId) {
  try {
    await apiFetch(`/admin/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: document.getElementById('order-update-status').value,
        trackingNumber: document.getElementById('order-update-tracking').value.trim(),
        estimatedDelivery: document.getElementById('order-update-delivery').value || null,
        notes: document.getElementById('order-update-notes').value.trim(),
        isDelivered: document.getElementById('order-update-status').value === 'Delivered',
        isPaid: document.getElementById('order-update-paid').checked,
        sendEmail: document.getElementById('order-update-email').checked
      })
    });
    showNotification('Order updated successfully', 'success');
    closeOrderModal();
    loadOrders();
    loadDashboard();
  } catch (error) {
    showNotification(`Error updating order: ${error.message}`, 'error');
  }
}

function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
}

async function loadCustomOrders() {
  const tbody = document.getElementById('custom-orders-body');
  tbody.innerHTML = emptyRow(7, 'Loading custom orders...');
  try {
    const data = await apiFetch('/admin/custom-orders');
    customOrdersCache = data.customOrders || [];
    renderCustomOrders(customOrdersCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(7, error.message);
    showNotification(`Error loading custom orders: ${error.message}`, 'error');
  }
}

function renderCustomOrders(orders) {
  document.getElementById('custom-orders-body').innerHTML = orders.length ? orders.map((order) => `
    <tr>
      <td>#${order.id}</td>
      <td>${escapeHtml(order.customerName || `User #${order.userId}`)}</td>
      <td>${escapeHtml(order.productType || '-')}</td>
      <td>${badge(order.status)}</td>
      <td>${money(order.finalPrice)}</td>
      <td>${date(order.createdAt)}</td>
      <td><button class="btn btn-sm btn-view" onclick="viewCustomOrder(${order.id})">View</button></td>
    </tr>
  `).join('') : emptyRow(7, 'No custom orders found.');
}

async function viewCustomOrder(orderId) {
  try {
    const data = await apiFetch(`/admin/custom-orders/${orderId}`);
    const order = data.customOrder;
    const customer = order.customerInfo || {};
    document.getElementById('customOrderDetails').innerHTML = `
      <div class="order-details-grid">
        <div class="detail-section">
          <h3>Customer</h3>
          <p><strong>Name:</strong> ${escapeHtml(customer.name || '-')}</p>
          <p><strong>Email:</strong> ${escapeHtml(customer.email || '-')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(customer.phone || '-')}</p>
        </div>
        <div class="detail-section">
          <h3>Request</h3>
          <p><strong>Type:</strong> ${escapeHtml(order.productType || '-')}</p>
          <p><strong>Timeline:</strong> ${escapeHtml(order.timeline || '-')}</p>
          <p><strong>Paid:</strong> ${order.isPaid ? 'Yes' : 'No'}</p>
          <pre>${escapeHtml(JSON.stringify(order.customDetails || {}, null, 2))}</pre>
        </div>
      </div>
      <div class="detail-section">
        <h3>Update Custom Order</h3>
        <div class="form-row">
          <div class="form-group"><label>Status</label><input id="custom-update-status" value="${escapeHtml(order.status || '')}"></div>
          <div class="form-group"><label>Final Price</label><input id="custom-update-price" type="number" step="0.01" value="${Number(order.finalPrice || 0)}"></div>
        </div>
        <div class="form-group"><label>Admin Notes</label><textarea id="custom-update-notes" rows="4">${escapeHtml(order.adminNotes || '')}</textarea></div>
        <label><input type="checkbox" id="custom-update-paid" ${order.isPaid ? 'checked' : ''}> Paid</label>
        <div class="form-actions"><button class="btn btn-primary" onclick="updateCustomOrder(${order.id})">Save Custom Order</button></div>
      </div>
    `;
    document.getElementById('customOrderModal').style.display = 'flex';
  } catch (error) {
    showNotification(`Error loading custom order: ${error.message}`, 'error');
  }
}

async function updateCustomOrder(orderId) {
  try {
    await apiFetch(`/admin/custom-orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: document.getElementById('custom-update-status').value.trim(),
        finalPrice: Number(document.getElementById('custom-update-price').value || 0),
        adminNotes: document.getElementById('custom-update-notes').value.trim(),
        isPaid: document.getElementById('custom-update-paid').checked
      })
    });
    showNotification('Custom order updated successfully', 'success');
    closeCustomOrderModal();
    loadCustomOrders();
    loadDashboard();
  } catch (error) {
    showNotification(`Error updating custom order: ${error.message}`, 'error');
  }
}

function closeCustomOrderModal() {
  document.getElementById('customOrderModal').style.display = 'none';
}

function filterCustomOrders() {
  const status = document.getElementById('custom-status-filter').value.toLowerCase();
  renderCustomOrders(status ? customOrdersCache.filter((order) => String(order.status).toLowerCase().includes(status)) : customOrdersCache);
}

async function loadWorkshops() {
  const tbody = document.getElementById('workshops-body');
  tbody.innerHTML = emptyRow(7, 'Loading workshops...');
  try {
    const data = await apiFetch('/admin/workshops');
    workshopsCache = data.registrations || [];
    renderWorkshops(workshopsCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(7, error.message);
    showNotification(`Error loading workshops: ${error.message}`, 'error');
  }
}

function renderWorkshops(registrations) {
  document.getElementById('workshops-body').innerHTML = registrations.length ? registrations.map((reg) => `
    <tr>
      <td>#${reg.id}</td>
      <td>${escapeHtml(reg.workshopTitle || '-')}</td>
      <td>${escapeHtml(reg.userId ? `User #${reg.userId}` : 'Guest')}</td>
      <td>${escapeHtml(reg.paymentMethod || '-')}</td>
      <td>${badge(reg.status)}</td>
      <td>${date(reg.createdAt)}</td>
      <td>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-sm btn-view" onclick="viewWorkshop(${reg.id})">View</button>
          <select onchange="updateWorkshop(${reg.id}, this.value)">
            ${['pending', 'registered', 'confirmed', 'completed', 'cancelled'].map((status) => `<option value="${status}" ${status === reg.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
      </td>
    </tr>
  `).join('') : emptyRow(7, 'No workshop registrations found.');
}

async function updateWorkshop(registrationId, status) {
  try {
    await apiFetch(`/admin/workshops/${registrationId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showNotification('Workshop status updated', 'success');
    loadWorkshops();
  } catch (error) {
    showNotification(`Error updating workshop: ${error.message}`, 'error');
  }
}

function filterWorkshops() {
  const status = document.getElementById('workshop-status-filter').value.toLowerCase();
  renderWorkshops(status ? workshopsCache.filter((reg) => String(reg.status).toLowerCase().includes(status)) : workshopsCache);
}

async function loadReviews() {
  const tbody = document.getElementById('reviews-body');
  tbody.innerHTML = emptyRow(7, 'Loading reviews...');
  try {
    const data = await apiFetch('/admin/reviews');
    reviewsCache = data.reviews || [];
    renderReviews(reviewsCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(7, error.message);
    showNotification(`Error loading reviews: ${error.message}`, 'error');
  }
}

function renderReviews(reviews) {
  document.getElementById('reviews-body').innerHTML = reviews.length ? reviews.map((review) => `
    <tr>
      <td>#${review.id}</td>
      <td>${escapeHtml(review.productName)}</td>
      <td>${escapeHtml(review.userName)}</td>
      <td>${'Star '.repeat(Number(review.rating || 0)).trim() || '-'}</td>
      <td>${escapeHtml(review.comment)}</td>
      <td>${date(review.createdAt)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteReview(${review.id})">Delete</button></td>
    </tr>
  `).join('') : emptyRow(7, 'No reviews found.');
}

async function deleteReview(reviewId) {
  if (!confirm('Delete this review?')) return;
  try {
    await apiFetch(`/admin/reviews/${reviewId}`, { method: 'DELETE' });
    showNotification('Review deleted successfully', 'success');
    loadReviews();
    loadDashboard();
  } catch (error) {
    showNotification(`Error deleting review: ${error.message}`, 'error');
  }
}

function filterReviews() {
  const rating = document.getElementById('review-rating-filter').value;
  renderReviews(rating ? reviewsCache.filter((review) => String(review.rating) === rating) : reviewsCache);
}

async function loadUsers() {
  const tbody = document.getElementById('users-body');
  tbody.innerHTML = emptyRow(7, 'Loading users...');
  try {
    const data = await apiFetch('/admin/users');
    usersCache = data.users || [];
    renderUsers(usersCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(7, error.message);
    showNotification(`Error loading users: ${error.message}`, 'error');
  }
}

function renderUsers(users) {
  document.getElementById('users-body').innerHTML = users.length ? users.map((user) => `
    <tr>
      <td>#${user.id}</td>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.phone || '-')}</td>
      <td>${badge(user.role)}</td>
      <td>${date(user.createdAt)}</td>
      <td>
        <button class="btn btn-sm btn-edit" onclick="editUserRole(${user.id}, '${escapeHtml(user.role)}')">Role</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>
      </td>
    </tr>
  `).join('') : emptyRow(7, 'No users found.');
}

async function editUserRole(userId, currentRole) {
  const role = prompt(`Change role for user #${userId}. Use user or admin:`, currentRole);
  if (!role || !['user', 'admin'].includes(role)) return;
  try {
    await apiFetch(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
    showNotification('User role updated', 'success');
    loadUsers();
  } catch (error) {
    showNotification(`Error updating user: ${error.message}`, 'error');
  }
}

async function deleteUser(userId) {
  if (!confirm('Delete this user? This may remove related user data.')) return;
  try {
    await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
    showNotification('User deleted successfully', 'success');
    loadUsers();
    loadDashboard();
  } catch (error) {
    showNotification(`Error deleting user: ${error.message}`, 'error');
  }
}

function searchUsers() {
  const term = document.getElementById('user-search').value.toLowerCase();
  renderUsers(usersCache.filter((user) => `${user.name} ${user.email} ${user.phone} ${user.role}`.toLowerCase().includes(term)));
}

async function loadSubscribers() {
  const tbody = document.getElementById('subscribers-body');
  tbody.innerHTML = emptyRow(7, 'Loading subscribers...');
  try {
    const data = await apiFetch('/admin/subscribers');
    subscribersCache = data.subscribers || [];
    renderSubscribers(subscribersCache);
  } catch (error) {
    tbody.innerHTML = emptyRow(7, error.message);
    showNotification(`Error loading subscribers: ${error.message}`, 'error');
  }
}

function renderSubscribers(subscribers) {
  document.getElementById('subscribers-body').innerHTML = subscribers.length ? subscribers.map((sub) => `
    <tr>
      <td>#${sub.id}</td>
      <td>${escapeHtml(sub.email)}</td>
      <td>${escapeHtml(sub.name || '-')}</td>
      <td>${escapeHtml(sub.source || '-')}</td>
      <td>${sub.isConfirmed ? 'Yes' : 'No'}</td>
      <td>${date(sub.createdAt)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteSubscriber(${sub.id})">Delete</button></td>
    </tr>
  `).join('') : emptyRow(7, 'No subscribers found.');
}

async function deleteSubscriber(subscriberId) {
  if (!confirm('Delete this subscriber?')) return;
  try {
    await apiFetch(`/admin/subscribers/${subscriberId}`, { method: 'DELETE' });
    showNotification('Subscriber deleted successfully', 'success');
    loadSubscribers();
    loadDashboard();
  } catch (error) {
    showNotification(`Error deleting subscriber: ${error.message}`, 'error');
  }
}

function searchSubscribers() {
  const term = document.getElementById('subscriber-search').value.toLowerCase();
  renderSubscribers(subscribersCache.filter((sub) => `${sub.email} ${sub.name} ${sub.source}`.toLowerCase().includes(term)));
}

function showNotification(message, type = 'info') {
  const toast = document.getElementById('notificationToast');
  toast.textContent = message;
  toast.className = `notification-toast show notification-${type}`;
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function logout() {
  if (!confirm('Logout from admin?')) return;
  TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
  USER_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('isLoggedIn');
  window.location.href = './login.html';
}

function viewWorkshop(regId) {
  const reg = workshopsCache.find((r) => r.id === regId);
  if (!reg) {
    showNotification('Registration not found', 'error');
    return;
  }

  const student = reg.workshopData?.student || {};
  const name = reg.customerName || student.name || 'Guest';
  const email = reg.customerEmail || student.email || '-';
  const phone = reg.customerPhone || student.phone || '-';
  const experience = reg.experienceLevel || student.experienceLevel || '-';
  const specialReq = reg.specialRequirements || student.specialRequirements || 'None';
  const amountPaid = reg.workshopData?.amount || reg.workshopData?.workshop?.price || 'TBA';

  document.getElementById('workshopDetails').innerHTML = `
    <div class="order-details-grid" style="margin-bottom: 2rem;">
      <div class="detail-section">
        <h3>Workshop Information</h3>
        <p><strong>Registration ID:</strong> #${reg.id}</p>
        <p><strong>Workshop Title:</strong> ${escapeHtml(reg.workshopTitle || '-')}</p>
        <p><strong>Enrolled Date:</strong> ${dateTime(reg.createdAt)}</p>
        <p><strong>Payment Method:</strong> ${escapeHtml((reg.paymentMethod || '-').toUpperCase())}</p>
        <p><strong>Status:</strong> ${badge(reg.status)}</p>
        <p><strong>Fee / Amount:</strong> ${typeof amountPaid === 'number' ? money(amountPaid) : amountPaid}</p>
      </div>
      <div class="detail-section">
        <h3>Student Information</h3>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Experience Level:</strong> ${escapeHtml(experience)}</p>
        <p><strong>Special Requirements:</strong></p>
        <p style="background: #fdfaf7; padding: 0.75rem; border-radius: 8px; font-style: italic; white-space: pre-wrap;">
          ${escapeHtml(specialReq)}
        </p>
      </div>
    </div>
  `;
  document.getElementById('workshopModal').style.display = 'flex';
}

function closeWorkshopModal() {
  document.getElementById('workshopModal').style.display = 'none';
}

window.onclick = function closeModalOnBackdrop(event) {
  ['productModal', 'orderModal', 'customOrderModal', 'workshopModal'].forEach((id) => {
    const modal = document.getElementById(id);
    if (event.target === modal) modal.style.display = 'none';
  });
};
