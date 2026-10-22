from datetime import datetime
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import PaymentTransaction, Order, User
from gateways.phonepe import build_upi_uri, sign_payload, verify_signature
import os
import uuid

payment_bp = Blueprint('payment', __name__)


@payment_bp.route('/create', methods=['POST'])
@jwt_required(optional=True)
def create_payment():
    """Create a payment transaction.

    Accepts JSON: {orderId, amount, method}
    method: 'phonepe' | 'gpay' | 'upi' | 'card' | 'cod'
    Returns payment instructions depending on method. Frontend remains unchanged — this
    endpoint provides server-side support for future wiring.
    """
    data = request.get_json() or {}
    order_id = data.get('orderId')
    amount = float(data.get('amount', 0))
    method = (data.get('method') or 'upi').lower()
    user_id = get_jwt_identity()

    if amount <= 0:
        return jsonify(success=False, message='Invalid amount'), 400

    txn = PaymentTransaction(
        user_id=user_id,
        order_id=order_id,
        amount=amount,
        method=method,
        status='pending',
        provider=('phonepe' if method in ['phonepe', 'gpay', 'upi'] else 'card')
    )
    # for card flow, return a client token that frontend can use to tokenize cards (mock)
    if method == 'card':
        txn.client_token = str(uuid.uuid4())

    db.session.add(txn)
    db.session.commit()

    if order_id:
        order = Order.query.get(order_id)
        if order and not txn.order_id:
            txn.order_id = order.id
            db.session.commit()

    # UPI deep-link support (works with Google Pay / PhonePe apps)
    if method in ['phonepe', 'gpay', 'upi']:
        vpa = os.environ.get('PHONEPE_VPA') or os.environ.get('UPI_VPA')
        merchant_name = os.environ.get('MERCHANT_NAME', 'Whimsy & Weave')
        if not vpa:
            # If merchant VPA isn't configured, return the UPI template information only.
            return jsonify(success=True, payment={
                'type': 'upi',
                'message': 'UPI VPA not configured on server',
                'upiUri': None,
                'transactionId': txn.id
            })

        upi_uri = build_upi_uri(vpa=vpa, name=merchant_name, amount=amount, txn_id=f"WW{txn.id}")
        return jsonify(success=True, payment={
            'type': 'upi',
            'upiUri': upi_uri,
            'transactionId': txn.id
        })

    if method == 'card':
        return jsonify(success=True, payment={
            'type': 'card',
            'clientToken': txn.client_token,
            'transactionId': txn.id
        })

    if method == 'cod':
        txn.status = 'pending'
        db.session.commit()
        return jsonify(success=True, payment={'type': 'cod', 'message': 'Cash on Delivery selected', 'transactionId': txn.id})

    return jsonify(success=False, message='Unsupported payment method'), 400


@payment_bp.route('/confirm', methods=['POST'])
@jwt_required()
def confirm_payment():
    """Confirm a simulated payment for the authenticated user in demo mode."""
    if not current_app.config.get('DEMO_PAYMENT_MODE', False):
        return jsonify(success=False, message='Demo payment confirmation is disabled'), 403

    data = request.get_json() or {}
    txn_id = data.get('transactionId')
    provider_resp = data.get('providerResponse') or {}
    user_id = get_jwt_identity()

    if not txn_id:
        return jsonify(success=False, message='transactionId required'), 400

    txn = PaymentTransaction.query.get(txn_id)
    if not txn or str(txn.user_id) != str(user_id):
        return jsonify(success=False, message='Transaction not found'), 404

    status = data.get('status') or provider_resp.get('status') or 'failed'
    if status in ['success', 'SUCCESS', 'paid']:
        txn.status = 'paid'
    else:
        txn.status = 'failed'

    txn.provider_response = provider_resp
    db.session.commit()

    if txn.order_id:
        order = Order.query.get(txn.order_id)
        if order:
            if txn.status == 'paid':
                order.is_paid = True
                order.payment_status = 'paid'
                order.paid_at = order.paid_at or datetime.utcnow()
            elif txn.status == 'failed':
                order.payment_status = 'failed'
            order.payment_result = txn.provider_response
            db.session.commit()

    return jsonify(success=True, transactionId=txn.id, status=txn.status)


@payment_bp.route('/webhook/phonepe', methods=['POST'])
def phonepe_webhook():
    """A simple webhook endpoint for PhonePe/UPI provider callbacks.

    PhonePe sends signed payloads; configure `PHONEPE_SECRET` in your `.env` to verify.
    """
    secret = os.environ.get('PHONEPE_SECRET')
    signature = request.headers.get('X-Signature') or request.headers.get('X-VERIFY')
    body = request.get_data()

    if not secret or not signature:
        return jsonify(success=False, message='Webhook signature is required'), 503

    try:
        if not verify_signature(body, signature, secret):
            return jsonify(success=False, message='Invalid signature'), 400
    except Exception:
        return jsonify(success=False, message='Signature verification error'), 400

    payload = request.get_json() or {}
    txn_ref = payload.get('merchantTransactionId') or payload.get('transactionId') or payload.get('txnId')
    status = payload.get('status') or payload.get('transactionStatus') or 'failed'

    # If txn_ref looks like our WW{txn.id} pattern extract id
    txn = None
    if txn_ref and str(txn_ref).startswith('WW'):
        try:
            tid = int(str(txn_ref)[2:])
            txn = PaymentTransaction.query.get(tid)
        except Exception:
            txn = None

    # fallback: try matching by provider data
    if not txn and 'merchantReference' in payload:
        txn = PaymentTransaction.query.filter_by(provider_response={'merchantReference': payload.get('merchantReference')}).first()

    if not txn:
        # nothing to update locally
        return jsonify(success=True, message='No matching transaction'), 200

    txn.provider_response = payload
    txn.status = 'paid' if str(status).lower() in ['success', 'completed', 'paid'] else 'failed'
    db.session.commit()

    return jsonify(success=True, transactionId=txn.id, status=txn.status)


@payment_bp.route('/status/<int:txn_id>', methods=['GET'])
def payment_status(txn_id):
    txn = PaymentTransaction.query.get(txn_id)
    if not txn:
        return jsonify(success=False, message='Transaction not found'), 404
    return jsonify(success=True, transactionId=txn.id, status=txn.status, provider=txn.provider)
