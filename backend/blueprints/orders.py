from datetime import datetime, timedelta
import uuid

from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Product, Order, OrderItem, Cart, User, PaymentTransaction
from flask_mail import Message
from extensions import mail
import random

orders_bp = Blueprint('orders', __name__)

TRACKING_STATUSES = [
    'Order Confirmed',
    'Preparing Your Cozy Package',
    'Shipped',
    'Out for Delivery',
    'Delivered',
]


def _get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id) if user_id else None


def _admin_required():
    user = _get_current_user()
    if not user or user.effective_role != 'admin':
        abort(403, description='Admin access required')
    return user


def _recalculate_cart(cart):
    cart.total_items = sum(item.quantity for item in cart.items)
    cart.total_price = sum(item.quantity * item.price for item in cart.items)


def _order_allowed(order, user):
    return order.user_id == user.id or user.effective_role == 'admin'


def _serialize_order(order):
    return {
        'id': order.id,
        'userId': order.user_id,
        'shippingAddress': order.shipping_address,
        'paymentMethod': order.payment_method,
        'paymentStatus': order.payment_status,
        'totalPrice': order.total_price,
        'status': order.status,
        'trackingNumber': order.tracking_number,
        'estimatedDelivery': order.estimated_delivery.isoformat() if order.estimated_delivery else None,
        'orderItems': [{
            'id': item.id,
            'productId': item.product_id,
            'name': item.name,
            'price': item.price,
            'quantity': item.quantity,
            'customization': item.customization
        } for item in order.order_items],
        'createdAt': order.created_at.isoformat() if order.created_at else None
    }


def _money(value):
    return f"Rs.{float(value or 0):.2f}"


def _build_invoice(order, order_items, shipping_address, tracking_url):
    invoice_number = f"INV-WW-{order.id:05d}"
    invoice_date = order.created_at.strftime('%b %d, %Y') if order.created_at else datetime.utcnow().strftime('%b %d, %Y')
    customer_name = shipping_address.get('name') or 'Customer'
    customer_email = shipping_address.get('email') or ''
    customer_phone = shipping_address.get('phone') or ''

    item_lines = []
    html_rows = []
    for index, item in enumerate(order_items, start=1):
        line_total = float(item.price or 0) * int(item.quantity or 1)
        item_lines.append(
            f"{index}. {item.name}\n"
            f"   Qty: {item.quantity} | Unit: {_money(item.price)} | Total: {_money(line_total)}"
        )
        html_rows.append(f"""
            <tr>
                <td style="padding:10px;border-bottom:1px solid #ead9cf;">{index}</td>
                <td style="padding:10px;border-bottom:1px solid #ead9cf;">{item.name}</td>
                <td style="padding:10px;border-bottom:1px solid #ead9cf;text-align:center;">{item.quantity}</td>
                <td style="padding:10px;border-bottom:1px solid #ead9cf;text-align:right;">{_money(item.price)}</td>
                <td style="padding:10px;border-bottom:1px solid #ead9cf;text-align:right;">{_money(line_total)}</td>
            </tr>
        """)

    address_text = (
        f"{customer_name}\n"
        f"{shipping_address.get('address')}\n"
        f"{shipping_address.get('city')}, {shipping_address.get('state')} {shipping_address.get('pincode')}\n"
        f"{shipping_address.get('country', 'India')}"
    )

    text_body = f"""Hi {customer_name},

Thank you for ordering from Whimsy & Weave!

INVOICE
Invoice Number: {invoice_number}
Invoice Date: {invoice_date}
Order ID: {order.id}
Tracking Number: {order.tracking_number}
Order Status: {order.status}
Payment Method: {order.payment_method.upper()}
Payment Status: {order.payment_status.upper()}

BILL TO
{address_text}
Email: {customer_email}
Phone: {customer_phone}

ITEMS
{chr(10).join(item_lines)}

SUMMARY
Subtotal: {_money(order.items_price)}
Tax (5%): {_money(order.tax_price)}
Shipping: {_money(order.shipping_price)}
Grand Total: {_money(order.total_price)}

Track your order:
{tracking_url}

This email serves as your invoice for the order.

With warm stitches,
Whimsy & Weave
"""

    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;background:#f7efe6;font-family:Inter,Arial,sans-serif;color:#3d2f28;">
  <div style="max-width:720px;margin:0 auto;padding:28px;">
    <div style="background:#fffaf4;border-radius:22px;padding:28px;border:1px solid #ead9cf;">
      <h1 style="font-family:Georgia,serif;margin:0;color:#3d2f28;">Whimsy &amp; Weave</h1>
      <p style="margin:6px 0 24px;color:#7d6c63;">A little whimsy in every weave</p>
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;">
        <div>
          <h2 style="margin:0 0 8px;font-family:Georgia,serif;">Invoice</h2>
          <p style="margin:0;color:#7d6c63;">{invoice_number}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;"><strong>Date:</strong> {invoice_date}</p>
          <p style="margin:6px 0 0;"><strong>Order:</strong> #{order.id}</p>
        </div>
      </div>
      <div style="background:#fbf6f1;border-radius:18px;padding:18px;margin-bottom:22px;">
        <p style="margin:0 0 8px;"><strong>Billed To</strong></p>
        <p style="margin:0;line-height:1.6;color:#7d6c63;">{address_text.replace(chr(10), '<br>')}<br>{customer_email}<br>{customer_phone}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
        <thead>
          <tr style="background:#f7efe6;color:#6f4e3f;">
            <th style="padding:10px;text-align:left;">#</th>
            <th style="padding:10px;text-align:left;">Item</th>
            <th style="padding:10px;text-align:center;">Qty</th>
            <th style="padding:10px;text-align:right;">Unit</th>
            <th style="padding:10px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>{''.join(html_rows)}</tbody>
      </table>
      <div style="max-width:320px;margin-left:auto;">
        <p style="display:flex;justify-content:space-between;margin:8px 0;"><span>Subtotal</span><strong>{_money(order.items_price)}</strong></p>
        <p style="display:flex;justify-content:space-between;margin:8px 0;"><span>Tax (5%)</span><strong>{_money(order.tax_price)}</strong></p>
        <p style="display:flex;justify-content:space-between;margin:8px 0;"><span>Shipping</span><strong>{_money(order.shipping_price)}</strong></p>
        <p style="display:flex;justify-content:space-between;margin:14px 0 0;padding-top:12px;border-top:2px solid #ead9cf;font-size:18px;"><span>Grand Total</span><strong>{_money(order.total_price)}</strong></p>
      </div>
      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #ead9cf;">
        <p style="margin:0 0 8px;"><strong>Tracking:</strong> {order.tracking_number}</p>
        <p style="margin:0 0 14px;"><strong>Status:</strong> {order.status}</p>
        <a href="{tracking_url}" style="display:inline-block;background:#6f4e3f;color:#fff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">Track Order</a>
      </div>
    </div>
  </div>
</body>
</html>"""

    return invoice_number, text_body, html_body


@orders_bp.route('', methods=['POST'])
@orders_bp.route('/', methods=['POST'])
@jwt_required()
def create_order():
    user = _get_current_user()
    if not user:
        return jsonify(success=False, message='User not found'), 404

    data = request.get_json() or {}
    items = data.get('orderItems') or data.get('items') or []
    shipping_address = data.get('shippingAddress') or {}
    payment_method = (data.get('paymentMethod') or '').lower()
    transaction_id = data.get('transactionId') or data.get('paymentTransactionId')
    payment_result = data.get('paymentResult') or {}
    payment_status_override = (data.get('paymentStatus') or '').lower()
    transaction = None

    if transaction_id:
        transaction = PaymentTransaction.query.get(transaction_id)
        if transaction and transaction.user_id and transaction.user_id != user.id:
            transaction = None

    if not items:
        return jsonify(success=False, message='Order must have at least one item'), 400
    if payment_method not in ['gpay', 'phonepe', 'paytm', 'card', 'cod', 'upi', 'razorpay', 'bank', 'wallet']:
        return jsonify(success=False, message='Invalid payment method'), 400

    required_address = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode']
    if any(not str(shipping_address.get(field, '')).strip() for field in required_address):
        return jsonify(success=False, message='Please complete all checkout details'), 400

    order_items = []
    items_price = 0.0

    for item_data in items:
        product_id = item_data.get('product') or item_data.get('productId') or item_data.get('id')
        quantity = int(item_data.get('quantity', 0))
        if not product_id or quantity < 1:
            return jsonify(success=False, message='Invalid order item'), 400

        product = Product.query.get(product_id)
        if not product or not product.is_active:
            return jsonify(success=False, message=f'Product {product_id} not available'), 400

        inventory = product.inventory or {}
        if inventory.get('trackInventory', True) and inventory.get('quantity', 0) < quantity:
            return jsonify(success=False, message=f'Insufficient stock for {product.name}'), 400

        item_price = float(product.price) * quantity
        items_price += item_price
        order_items.append(OrderItem(
            product_id=product.id,
            name=product.name,
            image=(product.images or [{}])[0].get('url'),
            price=float(product.price),
            quantity=quantity,
            customization=item_data.get('customization', {})
        ))

    tax_price = round(items_price * 0.05, 2)
    shipping_price = 0.0 if items_price > 999 else 99.0
    total_price = items_price + tax_price + shipping_price
    tracking_number = f"WW-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    payment_confirmed = False
    if payment_method == 'cod':
        payment_status = 'pending'
        is_paid = False
        paid_at = None
    elif transaction and transaction.status == 'paid':
        payment_confirmed = True
        payment_status = 'paid'
        is_paid = True
        paid_at = datetime.utcnow()
    elif (
        current_app.config.get('DEMO_PAYMENT_MODE', False)
        and payment_status_override in ['paid', 'success', 'completed']
    ):
        payment_confirmed = True
        payment_status = 'paid'
        is_paid = True
        paid_at = datetime.utcnow()
    else:
        payment_status = 'pending'
        is_paid = False
        paid_at = None

    order = Order(
        user_id=user.id,
        shipping_address=shipping_address,
        payment_method=payment_method,
        payment_status=payment_status,
        payment_result=transaction.provider_response if transaction else (payment_result or None),
        tax_price=tax_price,
        shipping_price=shipping_price,
        items_price=items_price,
        total_price=total_price,
        legacy_total=total_price,
        is_paid=is_paid,
        paid_at=paid_at,
        status='Order Confirmed',
        tracking_number=tracking_number,
        estimated_delivery=datetime.utcnow() + timedelta(days=6)
    )
    order.order_items = order_items
    db.session.add(order)

    for item in order_items:
        product = Product.query.get(item.product_id)
        inventory = product.inventory or {}
        if inventory.get('trackInventory', True):
            inventory['quantity'] = max(0, inventory.get('quantity', 0) - item.quantity)
            product.inventory = inventory

    cart = Cart.query.filter_by(user_id=user.id).first()
    if cart:
        cart.items = []
        _recalculate_cart(cart)

    db.session.commit()

    if transaction and not transaction.order_id:
        transaction.order_id = order.id
        db.session.commit()

    try:
        tracking_url = f"{request.host_url.rstrip('/')}/tracking.html?order={order.id}&tracking={tracking_number}"
        invoice_number, body, html_body = _build_invoice(order, order_items, shipping_address, tracking_url)
        recipient = shipping_address.get('email') or user.email
        msg = Message(subject=f"Invoice {invoice_number} - Whimsy & Weave", recipients=[recipient])
        msg.body = body
        msg.html = html_body
        msg.attach(
            filename=f"{invoice_number}.txt",
            content_type='text/plain',
            data=body
        )
        mail.send(msg)
    except Exception as exc:
        print('Order confirmation email failed:', exc)

    return jsonify(
        success=True,
        message='Order created successfully',
        order_id=order.id,
        transactionId=transaction.id if transaction else None,
        paymentStatus=payment_status,
        trackingNumber=tracking_number,
        trackingUrl=f"/tracking.html?order={order.id}&tracking={tracking_number}",
        order={
            'id': order.id,
            'status': order.status,
            'paymentStatus': payment_status,
            'paymentMode': 'demo' if current_app.config.get('DEMO_PAYMENT_MODE', False) else 'live',
            'trackingNumber': tracking_number,
            'totalPrice': total_price
        }
    ), 201


@orders_bp.route('/myorders', methods=['GET'])
@jwt_required()
def my_orders():
    user = _get_current_user()
    orders = Order.query.filter_by(user_id=user.id).order_by(Order.created_at.desc()).all()
    return jsonify(success=True, count=len(orders), orders=[{
        'id': order.id,
        'totalPrice': order.total_price,
        'status': order.status,
        'trackingNumber': order.tracking_number,
        'createdAt': order.created_at.isoformat() if order.created_at else None
    } for order in orders])


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    user = _get_current_user()
    order = Order.query.get(order_id)
    if not order or not _order_allowed(order, user):
        return jsonify(success=False, message='Order not found or access denied'), 404
    return jsonify(success=True, order=_serialize_order(order))


@orders_bp.route('/tracking/<tracking_number>', methods=['GET'])
def track_order(tracking_number):
    order = Order.query.filter_by(tracking_number=tracking_number).first()
    if not order:
        return jsonify(success=False, message='Tracking number not found'), 404

    current_status = order.status if order.status in TRACKING_STATUSES else 'Order Confirmed'
    current_index = TRACKING_STATUSES.index(current_status)
    return jsonify(success=True, tracking={
        'orderId': order.id,
        'trackingNumber': order.tracking_number,
        'currentStatus': current_status,
        'statuses': [
            {'label': status, 'complete': index <= current_index}
            for index, status in enumerate(TRACKING_STATUSES)
        ],
        'estimatedDelivery': order.estimated_delivery.isoformat() if order.estimated_delivery else None,
        'totalPrice': order.total_price,
        'createdAt': order.created_at.isoformat() if order.created_at else None
    })


@orders_bp.route('/<int:order_id>/status', methods=['PUT'])
@jwt_required()
def update_order_status(order_id):
    _admin_required()
    order = Order.query.get(order_id)
    if not order:
        return jsonify(success=False, message='Order not found'), 404

    data = request.get_json() or {}
    status = data.get('status')
    if status not in TRACKING_STATUSES + ['cancelled']:
        return jsonify(success=False, message='Invalid status'), 400

    order.status = status
    order.tracking_number = data.get('trackingNumber', order.tracking_number)
    if data.get('estimatedDelivery'):
        order.estimated_delivery = data.get('estimatedDelivery')
    if status == 'Delivered':
        order.is_delivered = True
        order.delivered_at = datetime.utcnow()

    db.session.commit()
    return jsonify(success=True, message='Order status updated successfully')


@orders_bp.route('/<int:order_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_order(order_id):
    user = _get_current_user()
    order = Order.query.get(order_id)
    if not order or not _order_allowed(order, user):
        return jsonify(success=False, message='Order not found or access denied'), 404

    if order.status not in ['Order Confirmed', 'Preparing Your Cozy Package']:
        return jsonify(success=False, message='Order cannot be cancelled at this stage'), 400

    for item in order.order_items:
        product = Product.query.get(item.product_id)
        inventory = product.inventory or {}
        if inventory.get('trackInventory', True):
            inventory['quantity'] = inventory.get('quantity', 0) + item.quantity
            product.inventory = inventory

    order.status = 'cancelled'
    db.session.commit()
    return jsonify(success=True, message='Order cancelled successfully')
