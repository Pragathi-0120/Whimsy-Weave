from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Subscriber, User
from email_utils import send_welcome_email
import re

subscriptions_bp = Blueprint('subscriptions', __name__)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@subscriptions_bp.route('/', methods=['POST'])
def subscribe():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    name = (data.get('name') or '').strip() or None
    source = (data.get('source') or 'homepage').strip()

    if not email or not EMAIL_REGEX.match(email):
        return jsonify(success=False, message='Please provide a valid email'), 400

    try:
        existing = Subscriber.query.filter_by(email=email).first()
        if existing:
            mail_sent, mail_error = send_welcome_email(email, name)
            return jsonify(
                success=True,
                message='You are already subscribed — welcome email resent' if mail_sent else 'Already subscribed',
                mailSent=mail_sent,
                mailError=mail_error,
                subscriber=existing.to_dict()
            )

        sub = Subscriber(email=email, name=name, source=source, is_confirmed=True)
        db.session.add(sub)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        print('Subscription save error:', exc)
        return jsonify(success=False, message='Could not save subscription. Please try again.'), 500

    mail_sent, mail_error = send_welcome_email(email, name)
    if not mail_sent:
        print('Welcome email not sent:', mail_error)

    message = 'Subscribed successfully — check your inbox for a welcome email'
    if not mail_sent:
        message = 'Subscribed successfully (welcome email pending — restart the server with npm start)'
        if mail_error:
            print('Welcome email failed:', mail_error)

    return jsonify(
        success=True,
        message=message,
        mailSent=mail_sent,
        mailError=mail_error,
        subscriber=sub.to_dict()
    ), 201

@subscriptions_bp.route('/', methods=['GET'])
@jwt_required()
def list_subscribers():
    user = User.query.get(get_jwt_identity())
    if not user or user.effective_role != 'admin':
        return jsonify(success=False, message='Admin access required'), 403

    subs = Subscriber.query.order_by(Subscriber.created_at.desc()).all()
    return jsonify(success=True, count=len(subs), subscribers=[s.to_dict() for s in subs])
