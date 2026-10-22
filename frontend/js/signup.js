const password = document.getElementById("password");
const API_BASE = ['8081', '8080', '5500'].includes(window.location.port)
	? 'http://127.0.0.1:5000'
	: '';
const strengthBar = document.querySelector(".strength-bar");
const togglePassword = document.querySelectorAll(".toggle-password");

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
		console.warn('Wishlist sync after signup failed:', err);
	}
}

if (password) {
	password.addEventListener("input", () => {
		const value = password.value.length;
		if (value < 4) strengthBar.style.width = "30%";
		else if (value < 8) strengthBar.style.width = "60%";
		else strengthBar.style.width = "100%";
	});
}

togglePassword.forEach(t => t.addEventListener("click", () => {
	if (!password) return;
	password.type = password.type === 'password' ? 'text' : 'password';
}));

const signupForm = document.getElementById("signupForm");
if (signupForm) {
	signupForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const fullname = document.getElementById("fullname").value.trim();
		const email = document.getElementById("email").value.trim().toLowerCase();
		const phone = document.getElementById("phone").value.trim();
		const pwd = password.value;
		const confirmPassword = document.getElementById("confirmPassword").value;
		const terms = document.getElementById("terms");

		if (pwd !== confirmPassword) return showToast("Passwords do not match");
		if (pwd.length < 6) return showToast("Password must be 6+ characters");
		if (!terms || !terms.checked) return showToast("Please accept Terms & Conditions");

		try {
			const res = await fetch(`${API_BASE}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: fullname, email, password: pwd, phone })
			});
			const data = await res.json();
			if (!res.ok) return showToast(data.message || 'Signup failed');
			if (data.token) localStorage.setItem('authToken', data.token);
			if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
			localStorage.setItem('isLoggedIn', 'true');
			sessionStorage.setItem('isLoggedIn', 'true');
			await syncGuestWishlistAfterAuth(data.token);
			document.getElementById('successModal').classList.add('active');
		} catch (err) {
			console.error(err);
			showToast('Network error');
		}
	});
}

document.getElementById("continueBtn")?.addEventListener("click", () => {
	const redirect = localStorage.getItem('redirectAfterLogin') || 'index.html';
	window.location.href = redirect;
});

function showToast(message) {
	const toast = document.getElementById('toast');
	if (!toast) return;
	toast.innerText = message;
	toast.classList.add('show');
	setTimeout(() => toast.classList.remove('show'), 3000);
}
