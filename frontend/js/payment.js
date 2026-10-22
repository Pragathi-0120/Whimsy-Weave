/* ===================================
   WHIMSY & WEAVE PAYMENT SYSTEM
   Premium checkout & payment processing
=================================== */

const CART_KEYS = {
    primary: 'whimsyCart',
    fallback: 'cart'
};

const API_BASE = (() => {
    // If running from a dev server on common ports, point to Flask backend.
    if (['8081', '8080', '5500'].includes(window.location.port)) return 'http://127.0.0.1:5000';
    return '';
})();

document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken');
    const authModal = document.getElementById('authModal');
    if (!authToken) {
        localStorage.setItem('redirectAfterLogin', 'payment.html');
        if (authModal) {
            authModal.classList.add('active');
        } else {
            window.location.href = 'login.html';
        }
    } else {
        initializePaymentPage();
    }
});

async function initializePaymentPage() {
    setupPaymentMethodDisplay();
    restoreCheckoutMethod();
    await loadOrderSummary();
    setupPaymentMethods();
    setupPaymentButton();
    setupCardFormatting();
}

/* ===================================
   PAYMENT METHOD CONDITIONAL DISPLAY
   =================================== */

function setupPaymentMethodDisplay() {
    const methodBtns = document.querySelectorAll(".method-btn");
    const cardBox = document.getElementById("cardBox");

    methodBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            // Update active button
            methodBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const method = btn.dataset.method;
            const paymentBoxes = document.querySelectorAll(".payment-box");

            // Hide all boxes
            paymentBoxes.forEach(box => {
                box.classList.remove("active");
            });

            // Show selected method box
            const activeBox = document.getElementById(method + "Box");
            if (activeBox) {
                activeBox.classList.add("active");
            }

            // For UPI apps (GPay, PhonePe, Paytm), hide card details
            if (cardBox) {
                if (method === 'card') {
                    cardBox.style.display = 'block';
                    cardBox.querySelectorAll('input').forEach(field => field.required = true);
                } else {
                    cardBox.style.display = 'none';
                    cardBox.querySelectorAll('input').forEach(field => field.required = false);
                }
            }
        });
    });
}

function getSelectedPaymentMethod(defaultMethod = 'upi') {
    const selectedBtn = document.querySelector('.method-btn.active');
    let method = selectedBtn?.dataset?.method || defaultMethod;

    if (method === 'upi') {
        const activeUpi = document.querySelector('.upi-app.active');
        const label = activeUpi?.textContent?.trim()?.toLowerCase() || '';
        if (label.includes('gpay')) return 'gpay';
        if (label.includes('phonepe')) return 'phonepe';
        if (label.includes('paytm')) return 'paytm';
        return 'upi';
    }

    if (method === 'cod') return 'cod';
    if (method === 'wallet') return 'wallet';
    if (method === 'bank') return 'bank';
    return method;
}

function restoreCheckoutMethod() {
    const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || '{}');
    const savedMethod = checkoutData.paymentMethod || 'upi';
    let methodKey = savedMethod;
    if (['gpay', 'phonepe', 'paytm'].includes(savedMethod)) {
        methodKey = 'upi';
    }
    const button = document.querySelector(`.method-btn[data-method="${methodKey}"]`);
    if (button) button.click();

    if (['gpay', 'phonepe', 'paytm'].includes(savedMethod)) {
        document.querySelectorAll('.upi-app').forEach(app => {
            const appName = app.textContent.trim().toLowerCase();
            app.classList.toggle('active', appName === savedMethod);
        });
    }
}

async function loadCartItems() {
    const authToken = localStorage.getItem('authToken');
    let cart = [];

    if (authToken) {
        try {
            const res = await fetch(`${API_BASE}/api/cart`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (res.ok) {
                const json = await res.json();
                cart = Array.isArray(json.cart?.items) ? json.cart.items.map(item => ({
                    title: item.name,
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 1,
                    id: item.productId,
                    customization: item.customization || {}
                })) : [];
            }
        } catch (err) {
            console.warn('Order summary cart fetch failed', err);
        }
    }

    if (!cart.length) {
        cart = JSON.parse(localStorage.getItem(CART_KEYS.primary) || localStorage.getItem(CART_KEYS.fallback) || '[]') || [];
        cart = (Array.isArray(cart) ? cart : []).map(item => ({
            id: item.id || item.productId,
            title: item.title || item.name || 'Item',
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            customization: item.customization || {}
        }));
    }

    return cart;
}

async function loadOrderSummary() {
    const authToken = localStorage.getItem('authToken');
    const summaryItems = document.getElementById("summaryItems");

    if (!summaryItems) return;

    let cart = [];
    if (authToken) {
        try {
            const res = await fetch(`${API_BASE}/api/cart`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (res.ok) {
                const json = await res.json();
                cart = Array.isArray(json.cart?.items) ? json.cart.items.map(item => ({
                    title: item.name,
                    price: item.price,
                    quantity: item.quantity
                })) : [];
            }
        } catch (err) {
            console.warn('Order summary cart fetch failed', err);
        }
    }

    if (!cart.length) {
        cart = JSON.parse(localStorage.getItem(CART_KEYS.primary) || localStorage.getItem(CART_KEYS.fallback) || '[]') || [];
    }

    summaryItems.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        subtotal += item.price * (item.quantity || 1);

        const itemHTML = `
            <div class="summary-item">
                <span>${item.title}</span>
                <span>₹${item.price * (item.quantity || 1)}</span>
            </div>
        `;
        summaryItems.innerHTML += itemHTML;
    });

    updateTotals(subtotal);
}

function updateTotals(subtotal) {
    const shipping = 99;
    const tax = Math.floor(subtotal * 0.05);
    const total = subtotal + shipping + tax;

    const subtotalEl = document.getElementById("subtotal");
    const taxEl = document.getElementById("tax");
    const finalTotalEl = document.getElementById("finalTotal");

    if (subtotalEl) subtotalEl.innerText = "₹" + subtotal;
    if (taxEl) taxEl.innerText = "₹" + tax;
    if (finalTotalEl) finalTotalEl.innerText = "₹" + total;

    // Generate UPI QR Code dynamically based on the total amount
    generateUpiQrCode(total);
}

// UPI Dynamic QR Code Generator
function generateUpiQrCode(amount) {
    const upiQrCode = document.getElementById("upiQrCode");
    const spinner = document.querySelector(".qr-placeholder-spinner");
    const qrTimer = document.getElementById("qrTimer");

    if (!upiQrCode) return;

    const vpa = "whimsyweave@okaxis";
    const name = "Whimsy & Weave";
    const upiUri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=WW-Order-Payment`;

    // Load QR from robust public API
    upiQrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;
    
    upiQrCode.onload = () => {
        if (spinner) spinner.style.display = "none";
        upiQrCode.style.display = "block";
        startQrTimer(300); // 5 minutes
    };
}

let qrTimerInterval = null;
function startQrTimer(duration) {
    const qrTimer = document.getElementById("qrTimer");
    if (!qrTimer) return;

    if (qrTimerInterval) clearInterval(qrTimerInterval);

    let timer = duration;
    qrTimerInterval = setInterval(() => {
        let minutes = Math.floor(timer / 60);
        let seconds = timer % 60;

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        qrTimer.textContent = `Secure QR code expires in ${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(qrTimerInterval);
            qrTimer.textContent = "QR code expired. Click to refresh payment.";
            const upiQrCode = document.getElementById("upiQrCode");
            if (upiQrCode) upiQrCode.style.opacity = "0.3";
        }
    }, 1000);
}

function setupPaymentMethods() {
    // UPI apps selection
    const upiApps = document.querySelectorAll('.upi-app');
    upiApps.forEach(app => {
        app.addEventListener('click', () => {
            upiApps.forEach(a => a.classList.remove('active'));
            app.classList.add('active');
        });
    });

    // Coupon code handler
    const applyCouponBtn = document.getElementById("applyCoupon");
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener("click", () => {
            const code = document.getElementById("couponInput").value.toUpperCase();
            
            if (!code) {
                if (typeof whimsyModal !== 'undefined') {
                    whimsyModal.toast('Enter a coupon code', 'warning');
                }
                return;
            }

            let discount = 0;
            if (code === "WHIMSY10") {
                discount = 0.10;
            } else if (code === "COZY15") {
                discount = 0.15;
            } else if (code === "HANDMADE20") {
                discount = 0.20;
            } else {
                if (typeof whimsyModal !== 'undefined') {
                    whimsyModal.toast('Invalid coupon code', 'error');
                }
                return;
            }

            if (typeof whimsyModal !== 'undefined') {
                whimsyModal.toast(`Coupon applied! ${discount * 100}% discount ✨`, 'success');
            }
        });
    }
}

/* ===================================
   CARD FORMATTING
=================================== */

function setupCardFormatting() {
    const cardNumber = document.getElementById("cardNumber");
    const expiry = document.getElementById("expiry");
    const cvv = document.getElementById("cvv");

    if (cardNumber) {
        cardNumber.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.match(/.{1,4}/g)?.join(' ') || '';
            e.target.value = value;

            const previewNumber = document.getElementById("previewNumber");
            if (previewNumber) {
                previewNumber.innerText = value || "#### #### #### ####";
            }
        });
    }

    if (document.getElementById("cardName")) {
        document.getElementById("cardName").addEventListener("input", (e) => {
            const previewName = document.getElementById("previewName");
            if (previewName) {
                previewName.innerText = e.target.value || "YOUR NAME";
            }
        });
    }

    if (expiry) {
        expiry.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;

            const previewExpiry = document.getElementById("previewExpiry");
            if (previewExpiry) {
                previewExpiry.innerText = value || "MM/YY";
            }
        });
    }

    if (cvv) {
        cvv.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

/* ===================================
   PAYMENT PROCESSING
=================================== */

function setupPaymentButton() {
    const payBtn = document.getElementById("payBtn");
    if (!payBtn) return;

    payBtn.addEventListener("click", async () => {
        const authToken = localStorage.getItem('authToken');
        const authModal = document.getElementById("authModal");
        
        if (!authToken) {
            localStorage.setItem('redirectAfterLogin', 'payment.html');
            if (authModal) {
                authModal.classList.add("active");
            } else {
                window.location.href = 'login.html';
            }
            return;
        }

        // Get checkout data
        const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || '{}');
        const shippingAddress = checkoutData.shippingAddress || {};
        const paymentMethod = getSelectedPaymentMethod(checkoutData.paymentMethod || 'upi');

        if (!checkoutData || !checkoutData.shippingAddress || !checkoutData.shippingAddress.name) {
            window.location.href = 'checkout.html';
            return;
        }

        // Validate card if selected
        if (paymentMethod === 'card') {
            if (!validateCardDetails()) {
                if (typeof whimsyModal !== 'undefined') {
                    whimsyModal.error('Card Error', 'Please enter valid card details');
                }
                return;
            }
        }

        await processPayment(payBtn, authToken, shippingAddress, paymentMethod);
    });
}

function validateCardDetails() {
    const cardNumber = document.getElementById("cardNumber")?.value.replace(/\s/g, '') || '';
    const expiry = document.getElementById("expiry")?.value || '';
    const cvv = document.getElementById("cvv")?.value || '';
    const cardName = document.getElementById("cardName")?.value || '';

    if (!cardNumber || cardNumber.length < 12) return false;
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return false;
    if (!/^\d{3}$/.test(cvv)) return false;
    if (!cardName.trim()) return false;

    return true;
}

// Interactive Secure Scanner modal runner
function runPaymentScanner(paymentMethod) {
    return new Promise((resolve) => {
        // If Cash on Delivery, resolve immediately with 'pending'
        if (paymentMethod === 'cod') {
            resolve({ paymentStatus: 'pending' });
            return;
        }

        const scannerModal = document.getElementById("scannerModal");
        const scannerProgress = document.getElementById("scannerProgress");
        const scannerPercent = document.getElementById("scannerPercent");
        const scannerLogs = document.getElementById("scannerLogs");

        if (!scannerModal || !scannerProgress || !scannerPercent || !scannerLogs) {
            resolve({ paymentStatus: 'paid' });
            return;
        }

        // Open the academic demo payment simulation.
        scannerModal.classList.add("active");

        // Clear and reset values
        scannerProgress.style.width = "0%";
        scannerPercent.innerText = "0%";
        scannerLogs.innerHTML = `
            <div class="log-entry"><span class="log-bullet">⚡</span> Connecting to secure gateway host...</div>
        `;

        const logs = [
            { time: 600, text: "🔒 Establishing TLS 1.3 encrypted session...", success: false },
            { time: 1200, text: "🔑 Authenticating merchant VPA and tokens...", success: false },
            { time: 1800, text: "🛡️ Invoking 3D Secure 2.0 authorization...", success: false },
            { time: 2400, text: "💸 Executing gateway transaction clearance...", success: false },
            { time: 3000, text: "✓ Callback payload validated by server webhook...", success: true },
            { time: 3400, text: "✨ Payment verified successfully! Finalizing order...", success: true }
        ];

        logs.forEach(log => {
            setTimeout(() => {
                const div = document.createElement("div");
                div.className = "log-entry" + (log.success ? " success" : "");
                div.innerHTML = `<span class="log-bullet">${log.success ? "✓" : "⚡"}</span> ${log.text}`;
                scannerLogs.appendChild(div);
                scannerLogs.scrollTop = scannerLogs.scrollHeight;
            }, log.time);
        });

        let progress = 0;
        const interval = setInterval(() => {
            progress += 1;
            if (progress > 100) {
                clearInterval(interval);
                setTimeout(() => {
                    scannerModal.classList.remove("active");
                    resolve({ paymentStatus: 'paid' });
                }, 400);
            } else {
                scannerProgress.style.width = `${progress}%`;
                scannerPercent.innerText = `${progress}%`;
            }
        }, 34); // ~3.4 seconds total simulation
    });
}

async function processPayment(btn, authToken, shippingAddress, paymentMethod) {
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = 'Initializing Payment...';

    try {
        // Run the clearly labelled academic payment simulation.
        const scanResult = await runPaymentScanner(paymentMethod);
        const paymentStatus = scanResult.paymentStatus;

        btn.innerText = 'Finalizing Order...';

        // Get cart items
        let items = [];
        const cartRes = await fetch(`${API_BASE}/api/cart`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (cartRes.ok) {
            const cartJson = await cartRes.json();
            items = (cartJson.cart && Array.isArray(cartJson.cart.items))
                ? cartJson.cart.items.map(i => ({
                    product: i.productId || i.product_id || i.product,
                    quantity: i.quantity
                }))
                : [];
        } else {
            // Fallback to local storage
            const stored = JSON.parse(
                localStorage.getItem(CART_KEYS.primary) ||
                localStorage.getItem(CART_KEYS.fallback) ||
                '[]'
            ) || [];
            items = stored.map(i => ({
                product: i.id,
                quantity: i.quantity || 1
            }));
        }

        if (!items.length) {
            if (typeof whimsyModal !== 'undefined') {
                whimsyModal.error('Cart Empty', 'Your cart is empty. Please add items before proceeding.');
            }
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // Create order (must match backend contract used by checkout/cart.js)
        const payload = {
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            shippingAddress: shippingAddress,
            items: items.map(i => ({
                productId: i.product,
                quantity: i.quantity,
                customization: {}
            }))
        };

        const orderRes = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!orderRes.ok) {
            const err = await orderRes.json();
            if (typeof whimsyModal !== 'undefined') {
                whimsyModal.error(
                    'Order Failed',
                    err.message || 'Unable to create your order. Please try again.'
                );
            }
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        const orderJson = await orderRes.json();
        const orderId = orderJson.order_id || Math.floor(Math.random() * 999999);

        // Show success modal
        showSuccessModal(orderId);

        // Clear carts
        try {
            await fetch(`${API_BASE}/api/cart/clear`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });
        } catch (e) {
            console.warn('Clear cart failed', e);
        }

        localStorage.removeItem(CART_KEYS.primary);
        localStorage.removeItem(CART_KEYS.fallback);
        localStorage.removeItem('checkoutData');

        btn.disabled = false;
        btn.innerText = 'Payment Successful ✓';

    } catch (err) {
        console.error('Payment error', err);
        if (typeof whimsyModal !== 'undefined') {
            whimsyModal.error(
                'Payment Error',
                'Something went wrong during payment. Please try again.'
            );
        }
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

/* ===================================
   SUCCESS MODAL
=================================== */

function showSuccessModal(orderId) {
    const successModal = document.getElementById("successModal");
    if (successModal) {
        document.getElementById("orderId").innerText = 'ORDER #' + orderId;
        successModal.classList.add("active");

        // Set up action buttons
        const continueShopping = document.getElementById("continueShopping");
        const downloadInvoice = document.getElementById("downloadInvoice");

        if (continueShopping) {
            continueShopping.onclick = () => {
                window.location.href = 'product.html';
            };
        }

        if (downloadInvoice) {
            downloadInvoice.onclick = () => {
                window.print();
            };
        }

        const trackOrderBtn = document.getElementById('trackOrderBtn');
        if (trackOrderBtn) {
            trackOrderBtn.onclick = () => {
                const trackingData = JSON.parse(localStorage.getItem('lastOrderTracking') || '{}');
                window.location.href = trackingData.trackingUrl || 'tracking.html';
            };
        }
    }
}

/* ===================================
   LEGACY COMPATIBILITY
=================================== */

function initializeRazorpay() {
    console.log("Razorpay Ready");
}

function verifyPayment() {
    console.log("Payment Verified");
}

function handlePaymentSuccess() {
    console.log("Payment Success");
}
