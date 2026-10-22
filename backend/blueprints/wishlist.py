from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import WishlistItem, Product, User

wishlist_bp = Blueprint('wishlist', __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id) if user_id else None


@wishlist_bp.route('/', methods=['GET'])
@jwt_required()
def get_wishlist():
    user = _get_current_user()
    from sqlalchemy.orm import joinedload
    items = WishlistItem.query.filter_by(user_id=user.id).options(
        joinedload(WishlistItem.product).joinedload(Product.reviews)
    ).all()
    return jsonify(success=True, wishlist=[{
        'id': item.id,
        'productId': item.product_id,
        'product': item.product.to_dict() if item.product else None,
        'addedAt': item.added_at.isoformat()
    } for item in items])


@wishlist_bp.route('/', methods=['POST'])
@jwt_required()
def add_wishlist_item():
    user = _get_current_user()
    data = request.get_json() or {}
    product_id = data.get('productId')

    if not product_id:
        return jsonify(success=False, message='Product ID is required'), 400

    product = Product.query.get(product_id)
    if not product or not product.is_active:
        return jsonify(success=False, message='Product not found'), 404

    if WishlistItem.query.filter_by(user_id=user.id, product_id=product.id).first():
        return jsonify(success=True, message='Product already in wishlist')

    wishlist_item = WishlistItem(user_id=user.id, product_id=product.id)
    db.session.add(wishlist_item)
    db.session.commit()
    return jsonify(success=True, message='Product added to wishlist')


@wishlist_bp.route('/bulk', methods=['POST'])
@jwt_required()
def bulk_update_wishlist():
    user = _get_current_user()
    data = request.get_json() or {}
    items = data.get('items') or []

    incoming_ids = {int(i.get('productId')) for i in items if i.get('productId')}
    # delete wishlist items not in incoming list
    WishlistItem.query.filter(WishlistItem.user_id == user.id, ~WishlistItem.product_id.in_(incoming_ids)).delete(synchronize_session=False)

    for it in items:
        pid = it.get('productId')
        if not pid:
            continue
        if not WishlistItem.query.filter_by(user_id=user.id, product_id=pid).first():
            if Product.query.get(pid):
                db.session.add(WishlistItem(user_id=user.id, product_id=pid))

    db.session.commit()
    return jsonify(success=True, message='Wishlist updated')


@wishlist_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_wishlist():
    user = _get_current_user()
    WishlistItem.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify(success=True, message='Wishlist cleared')


@wishlist_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def remove_wishlist_item(product_id):
    user = _get_current_user()
    item = WishlistItem.query.filter_by(user_id=user.id, product_id=product_id).first()
    if not item:
        return jsonify(success=False, message='Wishlist item not found'), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify(success=True, message='Product removed from wishlist')
