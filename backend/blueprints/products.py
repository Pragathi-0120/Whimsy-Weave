from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload
from extensions import db
from models import Product, Review, User

products_bp = Blueprint('products', __name__)

PRODUCT_FIELD_MAP = {
    'isFeatured': 'is_featured',
    'quantity': 'stock'
}


def _get_current_user():
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(user_id)


def _admin_required():
    user = _get_current_user()
    if not user or user.effective_role != 'admin':
        abort(403, description='Admin access required')
    return user


def _recalculate_product_rating(product):
    reviews = Review.query.filter_by(product_id=product.id).all()
    product.ratings = {
        'average': round(sum(item.rating for item in reviews) / len(reviews), 1) if reviews else 0.0,
        'count': len(reviews)
    }


def _serialize_review(review):
    data = review.to_dict()
    data['date'] = review.created_at.strftime('%d %b %Y') if review.created_at else ''
    return data


@products_bp.route('/', methods=['GET'])
def list_products():
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 100)), 500)
    category = request.args.get('category')
    min_price = request.args.get('minPrice')
    max_price = request.args.get('maxPrice')
    search = request.args.get('search')
    sort = request.args.get('sort')

    query = Product.query.options(joinedload(Product.reviews))

    if category:
        query = query.filter_by(category=category)
    if min_price:
        try:
            query = query.filter(Product.price >= float(min_price))
        except ValueError:
            pass
    if max_price:
        try:
            query = query.filter(Product.price <= float(max_price))
        except ValueError:
            pass
    if search:
        pattern = f'%{search}%'
        query = query.filter(or_(Product.name.ilike(pattern), Product.description.ilike(pattern)))

    if sort == 'price_asc':
        query = query.order_by(Product.price.asc())
    elif sort == 'price_desc':
        query = query.order_by(Product.price.desc())
    elif sort == 'rating':
        # JSON-based rating sort is not supported reliably across all MySQL versions.
        # Fall back to newest-first so the endpoint remains stable.
        query = query.order_by(Product.created_at.desc())
    elif sort == 'newest':
        query = query.order_by(Product.created_at.desc())
    elif sort == 'featured':
        query = query.order_by(Product.is_featured.desc(), Product.created_at.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    pagination = query.paginate(page=page, per_page=limit, error_out=False)
    products = [product.to_dict() for product in pagination.items]

    response = {
        'success': True,
        'count': len(products),
        'pagination': {
            'currentPage': page,
            'totalPages': pagination.pages,
            'totalProducts': pagination.total,
            'hasNext': pagination.has_next,
            'hasPrev': pagination.has_prev
        },
        'products': products
    }

    # Optional legacy shape for older static pages that expect the root response to be an array.
    if request.args.get('format') == 'array':
        return jsonify(products)

    return jsonify(response)


@products_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get(product_id)
    if not product or not product.is_active:
        return jsonify(success=False, message='Product not found'), 404
    return jsonify(success=True, product=product.to_dict())


@products_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    _admin_required()
    data = request.get_json() or {}
    product = Product(
        name=data.get('name', ''),
        description=data.get('description', ''),
        price=data.get('price', 0.0),
        category=data.get('category', ''),
        images=data.get('images') or [],
        tags=data.get('tags') or [],
        is_featured=data.get('isFeatured', False)
    )
    product.inventory = data.get('inventory') or {'quantity': data.get('stock', 0)}
    db.session.add(product)
    db.session.commit()
    return jsonify(success=True, message='Product created successfully', product=product.to_dict()), 201


@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404

    data = request.get_json() or {}
    for key, value in data.items():
        model_key = PRODUCT_FIELD_MAP.get(key, key)
        if hasattr(product, model_key):
            try:
                setattr(product, model_key, value)
            except AttributeError:
                pass
    db.session.commit()
    return jsonify(success=True, message='Product updated successfully', product=product.to_dict())


@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404

    db.session.delete(product)
    db.session.commit()
    return jsonify(success=True, message='Product deleted successfully')


@products_bp.route('/<int:product_id>/reviews', methods=['POST'])
def create_review(product_id):
    verify_jwt_in_request(optional=True)
    user_id = get_jwt_identity()
    user = User.query.get(user_id) if user_id else None
    review_data = request.get_json() or {}
    try:
        rating = int(review_data.get('rating', 0))
    except (TypeError, ValueError):
        rating = 0
    comment = (review_data.get('comment') or review_data.get('text') or '').strip()
    reviewer_name = (review_data.get('name') or review_data.get('reviewerName') or '').strip()
    photo = (review_data.get('photo') or '').strip()

    if rating < 1 or rating > 5:
        return jsonify(success=False, message='Rating must be between 1 and 5'), 400
    if not comment or len(comment) > 500:
        return jsonify(success=False, message='Comment is required and must be less than 500 characters'), 400
    if not user and not reviewer_name:
        return jsonify(success=False, message='Name is required for guest reviews'), 400
    if len(reviewer_name) > 120:
        return jsonify(success=False, message='Name must be less than 120 characters'), 400

    product = Product.query.get(product_id)
    if not product or not product.is_active:
        return jsonify(success=False, message='Product not found'), 404

    review = Review(
        product_id=product.id,
        user_id=user.id if user else None,
        reviewer_name=user.name if user else reviewer_name,
        rating=rating,
        comment=comment,
        photo=photo
    )
    db.session.add(review)
    db.session.flush()
    _recalculate_product_rating(product)
    db.session.commit()
    return jsonify(
        success=True,
        message='Review added successfully',
        review=_serialize_review(review),
        product=product.to_dict()
    ), 201


@products_bp.route('/<int:product_id>/reviews', methods=['GET'])
def list_product_reviews(product_id):
    product = Product.query.get(product_id)
    if not product or not product.is_active:
        return jsonify(success=False, message='Product not found'), 404

    reviews = Review.query.filter_by(product_id=product.id).order_by(Review.created_at.desc()).all()
    return jsonify(
        success=True,
        productId=product.id,
        count=len(reviews),
        reviews=[_serialize_review(review) for review in reviews]
    )
