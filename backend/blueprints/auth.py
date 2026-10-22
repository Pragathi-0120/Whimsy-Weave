from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from extensions import db
from models import User

auth_bp = Blueprint('auth', __name__)


def _json_body():
    data = request.get_json()
    if not data:
        return {}
    return data


def _user_response(user):
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.effective_role,
        'avatar': user.avatar,
        'phone': user.phone,
        'address': user.address
    }


@auth_bp.route('/register', methods=['POST'])
def register():
    data = _json_body()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if len(name) < 2 or len(name) > 50:
        return jsonify(success=False, message='Name must be 2-50 characters'), 400
    if '@' not in email or len(email) == 0:
        return jsonify(success=False, message='Please provide a valid email'), 400
    if len(password) < 6:
        return jsonify(success=False, message='Password must be at least 6 characters'), 400

    if User.query.filter_by(email=email).first():
        return jsonify(success=False, message='User already exists'), 400

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify(success=True, message='User registered successfully', token=token, user=_user_response(user)), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = _json_body()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if '@' not in email or len(email) == 0:
        return jsonify(success=False, message='Please provide a valid email'), 400
    if not password:
        return jsonify(success=False, message='Password is required'), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(success=False, message='Invalid credentials'), 401

    token = create_access_token(identity=str(user.id))
    return jsonify(success=True, message='Login successful', token=token, user=_user_response(user))


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify(success=False, message='User not found'), 404
    return jsonify(success=True, user=_user_response(user))


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify(success=False, message='User not found'), 404

    data = _json_body()
    if 'name' in data:
        name = data.get('name', '').strip()
        if name and 2 <= len(name) <= 50:
            user.name = name
        else:
            return jsonify(success=False, message='Name must be 2-50 characters'), 400

    if 'email' in data:
        email = data.get('email', '').strip().lower()
        if email and '@' in email:
            if User.query.filter(User.email == email, User.id != user.id).first():
                return jsonify(success=False, message='Email already in use'), 400
            user.email = email
        else:
            return jsonify(success=False, message='Please provide a valid email'), 400

    if 'phone' in data:
        user.phone = data.get('phone')
    if 'address' in data:
        user.address = data.get('address')

    db.session.commit()
    return jsonify(success=True, message='Profile updated successfully', user=_user_response(user))


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    data = _json_body()
    current_password = data.get('currentPassword', '')
    new_password = data.get('newPassword', '')

    if not current_password or len(new_password) < 6:
        return jsonify(success=False, message='Password validation failed'), 400

    user = User.query.get(get_jwt_identity())
    if not user or not user.check_password(current_password):
        return jsonify(success=False, message='Current password is incorrect'), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify(success=True, message='Password changed successfully')
