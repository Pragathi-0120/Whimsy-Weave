const loginForm = document.getElementById("loginForm");
const API_BASE = ['8081', '8080', '5500'].includes(window.location.port)
	? 'http://127.0.0.1:5000'
	: '';
const forgotBtn = document.querySelector(".forgot-btn");
const modal = document.getElementById("forgotModal");
const closeModal = document.querySelector(".close-modal");
const togglePassword = document.querySelectorAll(".toggle-password");
const socialButtons = document.querySelectorAll(".social-btn[data-provider]");

async function syncGuestWishlistAfterAuth(token) {
	if (!token) return;

	try {
		const wishlist = JSON.parse(localStorage.getItem('whimsyWishlist') || localStorage.getItem('wishlist') || '[]');
		const items = (Array.isArray(wishlist) ? wishlist : [])
			.map(item => ({ productId: item && typeof item === 'object' ? item.id || item.productId : item }))
			.filter(item => item.productId != null);

		if (!items.length) return;

		await fetch(`${API_BASE}/api/wishlist/bulk`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ items })
		});
	} catch (err) {
		console.warn('Wishlist sync after login failed:', err);
	}
}

togglePassword.forEach(t => {
	t.innerHTML = "&#128065;";
	t.setAttribute("aria-label", "Show password");
	t.addEventListener("click", () => {
		const input = t.closest(".password-group")?.querySelector("input");
		if (!input) return;
		const isHidden = input.type === "password";
		input.type = isHidden ? "text" : "password";
		t.innerHTML = isHidden ? "Hide" : "&#128065;";
		t.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
	});
});

socialButtons.forEach(button => {
	button.addEventListener("click", () => {
		const provider = button.dataset.provider || "Social";
		showToast(`${provider} login needs OAuth setup first. Please use email login for now.`);
	});
});

if (forgotBtn && modal) {
	forgotBtn.addEventListener("click", () => modal.classList.add("active"));
}
if (closeModal) closeModal.addEventListener("click", () => modal.classList.remove("active"));
window.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });

if (loginForm) {
	loginForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const email = document.getElementById("loginEmail").value.trim();
		const password = document.getElementById("loginPassword").value;
		if (!email || !password) return showToast("Please enter email and password");

		try {
			const res = await fetch(`${API_BASE}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json();
			if (!res.ok) return showToast(data.message || 'Login failed');
			if (data.token) {
				localStorage.setItem('authToken', data.token);
			}
			if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
			localStorage.setItem('isLoggedIn', 'true');
			sessionStorage.setItem('isLoggedIn', 'true');
			showToast('Login successful ✨');
			await syncGuestWishlistAfterAuth(data.token);
			const savedRedirect = localStorage.getItem('redirectAfterLogin');
			const isAdmin = data.user && data.user.role === 'admin';
			const redirect = isAdmin ? 'admin.html' : (savedRedirect || 'index.html');
			localStorage.removeItem('redirectAfterLogin');
			setTimeout(() => window.location.href = redirect, 700);
		} catch (err) {
			showToast('Network error');
			console.error(err);
		}
	});
}

function showToast(message) {
	const toast = document.getElementById('toast');
	if (!toast) return;
	toast.innerText = message;
	toast.classList.add('show');
	setTimeout(() => toast.classList.remove('show'), 3000);
}

