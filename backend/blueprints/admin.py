from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message
from datetime import datetime
from extensions import db, mail
from email_utils import build_welcome_email
from models import User, Product, Review, Order, OrderItem, CustomOrder, WorkshopRegistration, Subscriber

admin_bp = Blueprint('admin', __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id) if user_id else None


def _admin_required():
    user = _get_current_user()
    if not user or user.effective_role != 'admin':
        abort(403, description='Admin access required')
    return user


# ================== DASHBOARD ==================

@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def admin_dashboard():
    _admin_required()
    
    total_users = User.query.count()
    total_products = Product.query.count()
    total_orders = Order.query.count()
    total_reviews = Review.query.count()
    total_custom_orders = CustomOrder.query.count()
    total_workshop_enrollments = WorkshopRegistration.query.count()
    total_subscribers = Subscriber.query.count()
    
    # Revenue calculation
    total_revenue = db.session.query(db.func.sum(Order.total_price)).filter(
        Order.is_paid == True
    ).scalar() or 0.0

    low_stock = Product.query.filter(Product.stock <= 10).order_by(Product.stock.asc()).limit(5).all()
    recent_orders = Order.query.order_by(Order.created_at.desc()).limit(5).all()
    recent_activity = []
    recent_activity.extend([{
        'type': 'order',
        'label': f'Order #{o.id} placed',
        'detail': f'{o.user.name if o.user else "Guest"} • ₹{o.total_price}',
        'time': o.created_at.isoformat()
    } for o in recent_orders[:3]])
    recent_activity.extend([{
        'type': 'workshop',
        'label': f'Workshop enrollment #{w.id}',
        'detail': f'{w.workshop_title} • {w.status}',
        'time': w.created_at.isoformat()
    } for w in WorkshopRegistration.query.order_by(WorkshopRegistration.created_at.desc()).limit(2).all()])

    return jsonify(success=True, dashboard={
        'totalUsers': total_users,
        'totalProducts': total_products,
        'totalOrders': total_orders,
        'totalReviews': total_reviews,
        'totalCustomOrders': total_custom_orders,
        'totalWorkshops': total_workshop_enrollments,
        'totalSubscribers': total_subscribers,
        'totalRevenue': float(total_revenue),
        'lowStock': [{
            'id': p.id,
            'name': p.name,
            'stock': p.stock
        } for p in low_stock],
        'recentOrders': [{
            'id': o.id,
            'userId': o.user_id,
            'userName': o.user.name if o.user else None,
            'totalPrice': o.total_price,
            'status': o.status,
            'isPaid': o.is_paid,
            'createdAt': o.created_at.isoformat()
        } for o in recent_orders],
        'recentActivity': recent_activity
    })


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    _admin_required()
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify(success=True, count=len(users), users=[u.to_dict() for u in users])


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    _admin_required()
    user = User.query.get(user_id)
    if not user:
        return jsonify(success=False, message='User not found'), 404
    return jsonify(success=True, user=user.to_dict())


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    _admin_required()
    user = User.query.get(user_id)
    if not user:
        return jsonify(success=False, message='User not found'), 404

    data = request.get_json() or {}
    if 'role' in data and data.get('role') in ['user', 'admin']:
        user.role = data.get('role')
    if 'name' in data:
        user.name = data.get('name')
    db.session.commit()
    return jsonify(success=True, message='User updated', user=user.to_dict())


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    _admin_required()
    user = User.query.get(user_id)
    if not user:
        return jsonify(success=False, message='User not found'), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify(success=True, message='User deleted')


@admin_bp.route('/products/<int:product_id>/inventory', methods=['PUT'])
@jwt_required()
def update_inventory(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404
    data = request.get_json() or {}
    inventory = product.inventory or {}
    # Accepts {'quantity': 10, 'trackInventory': True, 'sku': 'ABC'}
    for k in ['quantity', 'trackInventory', 'sku']:
        if k in data:
            inventory[k] = data.get(k)
    product.inventory = inventory
    db.session.commit()
    return jsonify(success=True, message='Inventory updated', product=product.to_dict())


# ================== PRODUCTS ==================

@admin_bp.route('/products', methods=['GET'])
@jwt_required()
def list_admin_products():
    _admin_required()
    products = Product.query.order_by(Product.created_at.desc()).all()
    return jsonify(success=True, count=len(products), products=[p.to_dict() for p in products])


@admin_bp.route('/products', methods=['POST'])
@jwt_required()
def create_product():
    _admin_required()
    data = request.get_json() or {}
    
    # Validate required fields
    if not data.get('name') or not data.get('price') or not data.get('category'):
        return jsonify(success=False, message='Name, price, and category are required'), 400
    
    product = Product(
        name=data.get('name'),
        description=data.get('description', ''),
        price=float(data.get('price')),
        category=data.get('category'),
        image=data.get('image') or ((data.get('images') or [{}])[0].get('url') if data.get('images') else None),
        is_featured=data.get('isFeatured', False),
        tags=data.get('tags', [])
    )
    product.inventory = {'quantity': int(data.get('quantity', data.get('stock', 0)) or 0)}
    
    db.session.add(product)
    db.session.commit()
    
    return jsonify(success=True, message='Product created', product=product.to_dict()), 201


@admin_bp.route('/products/<int:product_id>', methods=['GET'])
@jwt_required()
def get_admin_product(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404
    return jsonify(success=True, product=product.to_dict())


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404
    
    data = request.get_json() or {}
    
    # Update fields
    if 'name' in data:
        product.name = data['name']
    if 'description' in data:
        product.description = data['description']
    if 'price' in data:
        product.price = float(data['price'])
    if 'category' in data:
        product.category = data['category']
    if 'images' in data:
        product.images = data['images']
    if 'image' in data:
        product.image = data['image']
    if 'isFeatured' in data:
        product.is_featured = data['isFeatured']
    if 'quantity' in data:
        product.stock = int(data['quantity'] or 0)
    if 'stock' in data:
        product.stock = int(data['stock'] or 0)
    if 'tags' in data:
        product.tags = data['tags']
    
    db.session.commit()
    
    return jsonify(success=True, message='Product updated', product=product.to_dict())


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404
    
    db.session.delete(product)
    db.session.commit()
    
    return jsonify(success=True, message='Product deleted')


@admin_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    _admin_required()
    categories = [c[0] for c in db.session.query(Product.category).distinct().all() if c[0]]
    return jsonify(success=True, count=len(categories), categories=sorted(categories))


@admin_bp.route('/workshops', methods=['GET'])
@jwt_required()
def list_workshop_registrations():
    _admin_required()
    regs = WorkshopRegistration.query.order_by(WorkshopRegistration.created_at.desc()).all()
    return jsonify(success=True, count=len(regs), registrations=[r.to_dict() for r in regs])


@admin_bp.route('/workshops/<int:registration_id>', methods=['PUT'])
@jwt_required()
def update_workshop_registration(registration_id):
    _admin_required()
    reg = WorkshopRegistration.query.get(registration_id)
    if not reg:
        return jsonify(success=False, message='Registration not found'), 404
    data = request.get_json() or {}
    if 'status' in data:
        reg.status = data['status']
    db.session.commit()
    return jsonify(success=True, message='Workshop updated', registration=reg.to_dict())


@admin_bp.route('/custom-orders', methods=['GET'])
@jwt_required()
def list_custom_orders():
    _admin_required()
    orders = CustomOrder.query.order_by(CustomOrder.created_at.desc()).all()
    return jsonify(success=True, count=len(orders), customOrders=[{
        'id': o.id,
        'userId': o.user_id,
        'customerName': o.customer_info.get('name') if isinstance(o.customer_info, dict) else None,
        'productType': o.product_type,
        'status': o.status,
        'finalPrice': o.final_price,
        'createdAt': o.created_at.isoformat()
    } for o in orders])


@admin_bp.route('/custom-orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_custom_order(order_id):
    _admin_required()
    order = CustomOrder.query.get(order_id)
    if not order:
        return jsonify(success=False, message='Custom order not found'), 404
    return jsonify(success=True, customOrder={
        'id': order.id,
        'userId': order.user_id,
        'customerInfo': order.customer_info,
        'productType': order.product_type,
        'customDetails': order.custom_details,
        'referenceImages': order.reference_images,
        'timeline': order.timeline,
        'status': order.status,
        'estimatedPrice': order.estimated_price,
        'finalPrice': order.final_price,
        'adminNotes': order.admin_notes,
        'isPaid': order.is_paid,
        'paymentDetails': order.payment_details,
        'createdAt': order.created_at.isoformat()
    })


@admin_bp.route('/custom-orders/<int:order_id>', methods=['PUT'])
@jwt_required()
def update_custom_order(order_id):
    _admin_required()
    order = CustomOrder.query.get(order_id)
    if not order:
        return jsonify(success=False, message='Custom order not found'), 404
    data = request.get_json() or {}
    if 'status' in data:
        order.status = data['status']
    if 'adminNotes' in data:
        order.admin_notes = data['adminNotes']
    if 'finalPrice' in data:
        order.final_price = float(data['finalPrice'] or order.final_price or 0)
    if 'isPaid' in data:
        order.is_paid = bool(data['isPaid'])
    db.session.commit()
    return jsonify(success=True, message='Custom order updated', customOrder={
        'id': order.id,
        'userId': order.user_id,
        'customerInfo': order.customer_info,
        'productType': order.product_type,
        'customDetails': order.custom_details,
        'referenceImages': order.reference_images,
        'timeline': order.timeline,
        'status': order.status,
        'estimatedPrice': order.estimated_price,
        'finalPrice': order.final_price,
        'adminNotes': order.admin_notes,
        'isPaid': order.is_paid,
        'paymentDetails': order.payment_details,
        'createdAt': order.created_at.isoformat() if order.created_at else None
    })


@admin_bp.route('/subscribers', methods=['GET'])
@jwt_required()
def list_subscribers():
    _admin_required()
    subs = Subscriber.query.order_by(Subscriber.created_at.desc()).all()
    return jsonify(success=True, count=len(subs), subscribers=[s.to_dict() for s in subs])


@admin_bp.route('/subscribers/<int:subscriber_id>', methods=['DELETE'])
@jwt_required()
def delete_subscriber(subscriber_id):
    _admin_required()
    sub = Subscriber.query.get(subscriber_id)
    if not sub:
        return jsonify(success=False, message='Subscriber not found'), 404
    db.session.delete(sub)
    db.session.commit()
    return jsonify(success=True, message='Subscriber deleted')


# ================== REVIEWS ==================

@admin_bp.route('/reviews', methods=['GET'])
@jwt_required()
def list_all_reviews():
    _admin_required()
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('perPage', 20, type=int)
    
    reviews_query = Review.query.order_by(Review.created_at.desc())
    total = reviews_query.count()
    reviews = reviews_query.offset((page - 1) * per_page).limit(per_page).all()
    
    return jsonify(success=True, total=total, page=page, reviews=[{
        'id': r.id,
        'productId': r.product_id,
        'productName': r.product.name,
        'userId': r.user_id,
        'userName': r.display_name,
        'rating': r.rating,
        'comment': r.comment,
        'photo': r.photo or '',
        'createdAt': r.created_at.isoformat()
    } for r in reviews])


@admin_bp.route('/reviews/product/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product_reviews(product_id):
    _admin_required()
    product = Product.query.get(product_id)
    if not product:
        return jsonify(success=False, message='Product not found'), 404
    
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc()).all()
    
    return jsonify(success=True, productName=product.name, count=len(reviews), reviews=[{
        'id': r.id,
        'userId': r.user_id,
        'userName': r.display_name,
        'rating': r.rating,
        'comment': r.comment,
        'photo': r.photo or '',
        'createdAt': r.created_at.isoformat()
    } for r in reviews])


@admin_bp.route('/reviews/<int:review_id>', methods=['DELETE'])
@jwt_required()
def delete_review(review_id):
    _admin_required()
    review = Review.query.get(review_id)
    if not review:
        return jsonify(success=False, message='Review not found'), 404
    
    product = review.product
    db.session.delete(review)
    db.session.flush()
    if product:
        remaining = Review.query.filter_by(product_id=product.id).all()
        product.ratings = {
            'average': round(sum(item.rating for item in remaining) / len(remaining), 1) if remaining else 0.0,
            'count': len(remaining)
        }
    db.session.commit()
    
    return jsonify(success=True, message='Review deleted')


# ================== ORDERS ==================

@admin_bp.route('/orders', methods=['GET'])
@jwt_required()
def list_all_orders():
    _admin_required()
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('perPage', 20, type=int)
    status_filter = request.args.get('status', None)
    
    query = Order.query.order_by(Order.created_at.desc())
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    total = query.count()
    orders = query.offset((page - 1) * per_page).limit(per_page).all()
    
    def format_order(order):
        return {
            'id': order.id,
            'userId': order.user_id,
            'userName': order.user.name if order.user else 'Guest',
            'userEmail': order.user.email if order.user else '',
            'shippingAddress': order.shipping_address,
            'paymentMethod': order.payment_method,
            'taxPrice': order.tax_price,
            'shippingPrice': order.shipping_price,
            'itemsPrice': order.items_price,
            'totalPrice': order.total_price,
            'isPaid': order.is_paid,
            'paidAt': order.paid_at.isoformat() if order.paid_at else None,
            'isDelivered': order.is_delivered,
            'deliveredAt': order.delivered_at.isoformat() if order.delivered_at else None,
            'status': order.status,
            'trackingNumber': order.tracking_number,
            'estimatedDelivery': order.estimated_delivery.isoformat() if order.estimated_delivery else None,
            'notes': order.notes,
            'createdAt': order.created_at.isoformat(),
            'itemCount': len(order.order_items)
        }
    
    return jsonify(success=True, total=total, page=page, orders=[format_order(o) for o in orders])


@admin_bp.route('/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order_details(order_id):
    _admin_required()
    order = Order.query.get(order_id)
    if not order:
        return jsonify(success=False, message='Order not found'), 404
    
    items = [{
        'id': item.id,
        'productId': item.product_id,
        'name': item.name,
        'image': item.image,
        'price': item.price,
        'quantity': item.quantity,
        'customization': item.customization
    } for item in order.order_items]
    
    return jsonify(success=True, order={
        'id': order.id,
        'userId': order.user_id,
        'userName': order.user.name if order.user else 'Guest',
        'userEmail': order.user.email if order.user else '',
        'shippingAddress': order.shipping_address,
        'paymentMethod': order.payment_method,
        'taxPrice': order.tax_price,
        'shippingAddress': order.shipping_address,
        'paymentMethod': order.payment_method,
        'taxPrice': order.tax_price,
        'shippingPrice': order.shipping_price,
        'itemsPrice': order.items_price,
        'totalPrice': order.total_price,
        'isPaid': order.is_paid,
        'paidAt': order.paid_at.isoformat() if order.paid_at else None,
        'trackingNumber': order.tracking_number
    })


@admin_bp.route('/orders/<int:order_id>', methods=['PUT'])
@jwt_required()
def update_order(order_id):
    _admin_required()
    order = Order.query.get(order_id)
    if not order:
        return jsonify(success=False, message='Order not found'), 404
    
    data = request.get_json() or {}
    
    if 'status' in data:
        order.status = data['status']
    if 'isPaid' in data:
        order.is_paid = bool(data['isPaid'])
        if order.is_paid:
            order.payment_status = 'paid'
            order.paid_at = order.paid_at or datetime.utcnow()
        else:
            order.payment_status = 'pending'
    if 'isDelivered' in data:
        order.is_delivered = data['isDelivered']
        if data['isDelivered']:
            order.delivered_at = datetime.utcnow()
    if 'trackingNumber' in data:
        order.tracking_number = data['trackingNumber']
    if 'estimatedDelivery' in data:
        if data['estimatedDelivery']:
            order.estimated_delivery = datetime.fromisoformat(data['estimatedDelivery'].replace('Z', '+00:00'))
    if 'notes' in data:
        order.notes = data['notes']
    
    order.updated_at = datetime.utcnow()
    db.session.commit()

    if data.get('sendEmail'):
        try:
            sender = current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME')
            if sender and order.user and order.user.email:
                msg = Message(
                    subject=f'Order Update — #{order.id}',
                    recipients=[order.user.email],
                    sender=('Whimsy & Weave', sender),
                    body=(
                        f'Hello {order.user.name},\n\n'
                        f'Your order #{order.id} has been updated to "{order.status}".\n'
                        f'Tracking number: {order.tracking_number or "N/A"}\n\n'
                        'Thank you for shopping with Whimsy & Weave!'
                    )
                )
                mail.send(msg)
        except Exception as exc:
            print('Admin order update email failed:', exc)

    return jsonify(success=True, message='Order updated', order={
        'id': order.id,
        'status': order.status,
        'isDelivered': order.is_delivered,
        'trackingNumber': order.tracking_number
    })
