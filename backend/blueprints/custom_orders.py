from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import CustomOrder, User

custom_orders_bp = Blueprint('custom_orders', __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id) if user_id else None


@custom_orders_bp.route('/', methods=['POST'])
@jwt_required()
def create_custom_order():
    user = _get_current_user()
    data = request.get_json() or {}
    customer_info = data.get('customerInfo') or {}
    product_type = data.get('productType')
    custom_details = data.get('customDetails') or {}

    if not product_type or not customer_info or not custom_details:
        return jsonify(success=False, message='Missing required fields'), 400

    custom_order = CustomOrder(
        user_id=user.id,
        customer_info=customer_info,
        product_type=product_type,
        custom_details=custom_details,
        reference_images=data.get('referenceImages') or [],
        timeline=data.get('timeline', 'normal'),
        status='pending',
        estimated_price=data.get('estimatedPrice'),
        final_price=data.get('finalPrice'),
        admin_notes=data.get('adminNotes'),
        completion_date=data.get('completionDate'),
        is_paid=data.get('isPaid', False),
        payment_details=data.get('paymentDetails') or {}
    )

    db.session.add(custom_order)
    db.session.commit()

    return jsonify(success=True, message='Custom order created successfully', customOrderId=custom_order.id), 201


@custom_orders_bp.route('/', methods=['GET'])
@jwt_required()
def list_custom_orders():
    user = _get_current_user()
    orders = CustomOrder.query.filter_by(user_id=user.id).order_by(CustomOrder.created_at.desc()).all()
    return jsonify(success=True, count=len(orders), customOrders=[{
        'id': order.id,
        'productType': order.product_type,
        'status': order.status,
        'createdAt': order.created_at.isoformat()
    } for order in orders])


@custom_orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_custom_order(order_id):
    user = _get_current_user()
    order = CustomOrder.query.get(order_id)
    if not order or order.user_id != user.id:
        return jsonify(success=False, message='Custom order not found'), 404

    return jsonify(success=True, customOrder={
        'id': order.id,
        'customerInfo': order.customer_info,
        'productType': order.product_type,
        'customDetails': order.custom_details,
        'referenceImages': order.reference_images,
        'timeline': order.timeline,
        'status': order.status,
        'estimatedPrice': order.estimated_price,
        'finalPrice': order.final_price,
        'adminNotes': order.admin_notes,
        'completionDate': order.completion_date.isoformat() if order.completion_date else None,
        'isPaid': order.is_paid,
        'paymentDetails': order.payment_details,
        'createdAt': order.created_at.isoformat()
    })
