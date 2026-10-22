(function () {
  const AUTH_KEYS = [
    'authToken',
    'admin_jwt_token',
    'user',
    'isLoggedIn',
    'redirectAfterLogin',
    'checkoutData',
    'checkoutCart',
    'checkoutTotals',
    'pendingOrderData',
    'pendingPayment',
    'paymentData'
  ];

  function isLoggedIn() {
    return Boolean(localStorage.getItem('authToken') && localStorage.getItem('isLoggedIn') === 'true');
  }

  function logout() {
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('user');
    window.location.href = 'index.html';
  }

  function ensureAuthModal() {
    let modal = document.getElementById('authModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.id = 'authModal';
    modal.innerHTML = `
      <div class="auth-popup">
        <h2>Login Required</h2>
        <p>Please login or create an account to continue your cozy crochet shopping journey.</p>
        <div class="auth-actions">
          <a href="login.html" class="auth-btn login-btn">Login</a>
          <a href="signup.html" class="auth-btn signup-btn">Create Account</a>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .auth-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(12px);display:none;align-items:center;justify-content:center;z-index:5000}
      .auth-modal.active{display:flex}
      .auth-popup{width:90%;max-width:460px;padding:3rem 2rem;border-radius:34px;background:rgba(255,255,255,.88);box-shadow:0 24px 70px rgba(111,78,63,.2);text-align:center}
      .auth-popup h2{font-size:2rem;margin:0 0 1rem;color:#6f4e3f}
      .auth-popup p{line-height:1.7;color:#6f4e3f;margin:0 0 2rem}
      .auth-actions{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
      .auth-btn{padding:1rem 1.6rem;border-radius:999px;font-weight:600;text-decoration:none;transition:.3s ease}
      .login-btn{background:linear-gradient(135deg,#dba58b,#b17261);color:white}
      .signup-btn{background:white;color:#6f4e3f}
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);
    return modal;
  }

  function promptLoginRequired(redirectTarget = 'index.html', message) {
    localStorage.setItem('redirectAfterLogin', redirectTarget);

    const modal = ensureAuthModal();
    const text = modal.querySelector('.auth-popup p');
    const loginLink = modal.querySelector('.login-btn');
    const signupLink = modal.querySelector('.signup-btn');

    if (text && message) text.textContent = message;
    if (loginLink) loginLink.href = 'login.html';
    if (signupLink) signupLink.href = 'signup.html';

    modal.classList.add('active');
  }

  function updateAuthButtons() {
    const buttons = document.querySelectorAll('.profile-button, .profile-btn');
    if (!buttons.length) return;

    buttons.forEach((button) => {
      if (!isLoggedIn()) {
        button.textContent = button.classList.contains('profile-btn') ? 'Login' : 'Login';
        button.setAttribute('href', 'login.html');
        button.removeAttribute('data-logout');
        return;
      }

      button.textContent = 'Logout';
      button.setAttribute('href', '#logout');
      button.setAttribute('data-logout', 'true');
    });
  }

  document.addEventListener('click', (event) => {
    const logoutButton = event.target.closest('[data-logout="true"]');
    if (!logoutButton) return;
    event.preventDefault();
    logout();
  });

  document.addEventListener('DOMContentLoaded', updateAuthButtons);

  window.whimsyAuth = {
    isLoggedIn,
    logout,
    promptLoginRequired,
    updateAuthButtons
  };
})();
