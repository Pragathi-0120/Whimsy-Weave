from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from extensions import db
from models import Cart, CartItem, Product, User

cart_bp = Blueprint('cart', __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id) if user_id else None


def _product_image(product):
    images = product.images or []
    if not images:
        return None
    first_image = images[0]
    return first_image.get('url') if isinstance(first_image, dict) else str(first_image)


def _recalculate_cart(cart):
    cart.total_items = sum(item.quantity for item in cart.items)
    cart.total_price = sum(item.quantity * item.price for item in cart.items)


def _same_customization(left, right):
    return (left or {}) == (right or {})


@cart_bp.route('/', methods=['GET'])
@jwt_required()
def get_cart():
    user = _get_current_user()
    from sqlalchemy.orm import joinedload
    cart = Cart.query.filter_by(user_id=user.id).options(
        joinedload(Cart.items).joinedload(CartItem.product)
    ).first()
    if not cart:
        cart = Cart(user_id=user.id, items=[])
        db.session.add(cart)
        db.session.commit()

    active_items = []
    for item in cart.items:
        product = item.product
        if product and product.is_active:
            inventory = product.inventory or {}
            if not inventory.get('trackInventory', True) or inventory.get('quantity', 0) > 0:
                active_items.append(item)

    cart.items = active_items
    _recalculate_cart(cart)
    db.session.commit()

    return jsonify(success=True, cart={
        'items': [{
            'id': item.id,
            'productId': item.product_id,
            'name': item.name,
            'image': item.image,
            'price': item.price,
            'quantity': item.quantity,
            'customization': item.customization
        } for item in cart.items],
        'totalItems': cart.total_items,
        'totalPrice': cart.total_price
    })


@cart_bp.route('/', methods=['POST'])
@jwt_required()
def add_to_cart():
    user = _get_current_user()
    data = request.get_json() or {}
    product_id = data.get('productId') or data.get('product_id')
    try:
        quantity = int(data.get('quantity', 1))
    except (TypeError, ValueError):
        return jsonify(success=False, message='Invalid product or quantity'), 400
    customization = data.get('customization') or {}

    if not product_id or quantity < 1 or quantity > 99:
        return jsonify(success=False, message='Invalid product or quantity'), 400

    product = Product.query.get(product_id)
    if not product or not product.is_active:
        return jsonify(success=False, message='Product not found or unavailable'), 404

    inventory = product.inventory or {}
    if inventory.get('trackInventory', True) and quantity > inventory.get('quantity', 0):
        return jsonify(success=False, message='Insufficient stock'), 400

    cart = Cart.query.filter_by(user_id=user.id).first()
    if not cart:
        cart = Cart(user_id=user.id)
        db.session.add(cart)

    existing = None
    for item in cart.items:
        if item.product_id == product.id and _same_customization(item.customization, customization):
            existing = item
            break

    if existing:
        existing.quantity += quantity
    else:
        item = CartItem(
            cart=cart,
            product_id=product.id,
            name=product.name,
            image=_product_image(product),
            price=product.price,
            quantity=quantity,
            customization=customization
        )
        db.session.add(item)

    _recalculate_cart(cart)
    db.session.commit()

    return jsonify(success=True, message='Item added to cart successfully')


@cart_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_cart_item(product_id):
    user = _get_current_user()
    data = request.get_json() or {}
    quantity = int(data.get('quantity', 0))
    customization = data.get('customization') or {}

    cart = Cart.query.filter_by(user_id=user.id).first()
    if not cart:
        return jsonify(success=False, message='Cart not found'), 404

    item = next((item for item in cart.items if item.product_id == product_id and _same_customization(item.customization, customization)), None)
    if not item:
        return jsonify(success=False, message='Item not found in cart'), 404

    if quantity <= 0:
        db.session.delete(item)
    else:
        product = Product.query.get(product_id)
        if product and product.inventory and product.inventory.get('trackInventory', True) and quantity > product.inventory.get('quantity', 0):
            return jsonify(success=False, message='Insufficient stock'), 400
        item.quantity = quantity

    _recalculate_cart(cart)
    db.session.commit()
    return jsonify(success=True, message='Cart updated successfully')


@cart_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def remove_cart_item(product_id):
    user = _get_current_user()
    data = request.get_json() or {}
    customization = data.get('customization') or {}

    cart = Cart.query.filter_by(user_id=user.id).first()
    if not cart:
        return jsonify(success=False, message='Cart not found'), 404

    item = next((item for item in cart.items if item.product_id == product_id and _same_customization(item.customization, customization)), None)
    if not item:
        return jsonify(success=False, message='Item not found in cart'), 404

    db.session.delete(item)
    _recalculate_cart(cart)
    db.session.commit()
    return jsonify(success=True, message='Item removed from cart successfully')


@cart_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_cart():
    user = _get_current_user()
    cart = Cart.query.filter_by(user_id=user.id).first()
    if not cart or not cart.items:
        return jsonify(success=True, message='Cart already empty')

    for item in list(cart.items):
        db.session.delete(item)

    _recalculate_cart(cart)
    db.session.commit()
    return jsonify(success=True, message='Cart cleared successfully')
