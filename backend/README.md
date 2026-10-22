# Whimsy & Weave Flask Backend

This backend is implemented with Flask and MySQL. It is the active backend for the Whimsy & Weave storefront.

## Setup

1. Copy the example env file:

```bash
cd backend
copy .env.example .env
```

2. Update `.env` with your MySQL credentials.

3. Install Python dependencies:

```bash
pip install -r requirements.txt
```

4. Initialize the database:

```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

5. Start the app:

```bash
python app.py
```

## API

The Flask app exposes API endpoints under `/api/*`:

- `/api/auth/*`
- `/api/products/*`
- `/api/orders/*`
- `/api/cart/*`
- `/api/wishlist/*`
- `/api/custom-orders/*`
- `/api/payment/*`
- `/api/workshops/*` (listing and registrations - placeholder)
- `/api/admin/*` (admin user/inventory management)

- The app serves static frontend files from the `frontend/` folder by default.
- The payment routes are placeholders and need payment gateway integration.

### Payment Integration

The backend now provides a flexible payment API supporting UPI deep-links (PhonePe / GPay) and a mock card flow.

Environment variables to configure:
- `PHONEPE_VPA` or `UPI_VPA` — merchant UPI VPA (e.g. merchant@upi)
- `MERCHANT_NAME` — merchant display name
- `PHONEPE_SECRET` — secret used to verify webhook signatures (if using PhonePe)

Endpoints:
- `POST /api/payment/create` — create a PaymentTransaction. Body: `{orderId, amount, method}`. Returns UPI URI for `method: "phonepe"|"gpay"|"upi"` or `clientToken` for `method: "card"`.
- `POST /api/payment/confirm` — confirm payment result (frontend or gateway can call)
- `POST /api/payment/webhook/phonepe` — webhook endpoint for provider callbacks (verifies HMAC with `PHONEPE_SECRET` if set)
- `GET /api/payment/status/<txn_id>` — check transaction status

Notes:
- The current frontend simulates payment; no frontend changes were made. You can wire the existing payment UI to these endpoints to enable real payments.
- For production PhonePe integration follow PhonePe's merchant API docs and replace the lightweight signing with their official SDK or signing method.


