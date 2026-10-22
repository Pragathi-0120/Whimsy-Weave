from datetime import datetime
from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import User, WorkshopRegistration

workshops_bp = Blueprint('workshops', __name__)


def _get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id) if user_id else None


@workshops_bp.route('/', methods=['GET'])
def list_workshops():
    # For now workshops are stored in a simple in-memory pattern (extend to models if needed)
    # This endpoint will be used by the frontend to display available workshops
    sample = [
        {
            'id': 1,
            'title': 'Beginner Weaving Workshop',
            'description': 'Intro to weaving techniques',
            'price': 49.0,
            'capacity': 12,
            'startDate': datetime(2026, 6, 15).isoformat(),
            'endDate': datetime(2026, 6, 15).isoformat()
        }
    ]
    return jsonify(success=True, count=len(sample), workshops=sample)


@workshops_bp.route('/register', methods=['POST'])
@jwt_required()
def register_workshop():
    user = _get_current_user()
    if not user:
        return jsonify(success=False, message='User not found'), 404

    data = request.get_json() or {}
    workshop_id = data.get('workshopId')
    workshop_title = data.get('workshopTitle') or f'Workshop {workshop_id}'
    workshop_data = data.get('workshopData') or {}
    payment_method = data.get('paymentMethod', 'cod')

    if not workshop_id:
        return jsonify(success=False, message='workshopId required'), 400

    registration = WorkshopRegistration(
        user_id=user.id,
        workshop_id=int(workshop_id),
        workshop_title=workshop_title,
        workshop_data=workshop_data,
        customer_name=user.name,
        customer_email=user.email,
        customer_phone=user.phone,
        payment_method=payment_method,
        status='registered'
    )
    db.session.add(registration)
    db.session.commit()

    # Send confirmation email
    try:
        from flask_mail import Message
        from extensions import mail
        from flask import current_app
        sender = current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME')
        body = (
            f"Thank you for joining our workshop!\n"
            f"You'll receive all course updates and workshop details here.\n"
            f"Happy learning and happy crocheting!\n\n"
            f"Workshop: {workshop_title}\n"
            f"Registration ID: {registration.id}\n"
        )
        msg = Message(
            subject=f"Workshop Enrollment Confirmation - {workshop_title}",
            recipients=[user.email],
            sender=('Whimsy & Weave', sender),
            body=body
        )
        mail.send(msg)
    except Exception as e:
        print('Workshop confirmation email failed:', e)

    return jsonify(success=True, message='Registered for workshop', registrationId=registration.id, workshopId=workshop_id), 201


@workshops_bp.route('/enroll', methods=['POST'])
@jwt_required(optional=True)
def enroll_workshop():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    workshop = data.get('workshop') or {}
    student = data.get('student') or {}
    payment_method = (data.get('paymentMethod') or 'upi').lower()

    workshop_id = workshop.get('id') or data.get('workshopId')
    workshop_title = workshop.get('title') or data.get('workshopTitle') or 'Crochet Workshop'
    try:
        amount = float(data.get('amount') or workshop.get('total') or workshop.get('price') or 0)
    except (TypeError, ValueError):
        amount = 0
    name = (student.get('name') or '').strip()
    email = (student.get('email') or '').strip().lower()
    phone = (student.get('phone') or '').strip()
    experience_level = (student.get('experienceLevel') or '').strip()
    special_requirements = (student.get('specialRequirements') or '').strip()

    if not workshop_id or not name or '@' not in email or not phone:
        return jsonify(success=False, message='Please complete the enrollment form'), 400
    if payment_method not in ['upi', 'gpay', 'phonepe', 'paytm', 'card', 'razorpay']:
        return jsonify(success=False, message='Please choose a valid payment method'), 400

    registration = WorkshopRegistration(
        user_id=int(user_id) if user_id else None,
        workshop_id=int(workshop_id),
        workshop_title=workshop_title,
        workshop_data={
            'workshop': workshop,
            'student': {
                'name': name,
                'email': email,
                'phone': phone,
                'experienceLevel': experience_level,
                'specialRequirements': special_requirements
            },
            'amount': amount
        },
        customer_name=name,
        customer_email=email,
        customer_phone=phone,
        experience_level=experience_level,
        special_requirements=special_requirements,
        payment_method=payment_method,
        status='confirmed'
    )
    db.session.add(registration)
    db.session.commit()
    enrollment_id = registration.id

    email_sent = False
    try:
        from flask_mail import Message
        from extensions import mail
        body = (
            "Thank you for joining our workshop!\n"
            "You'll receive all course updates and workshop details here.\n"
            "Happy learning and happy crocheting!\n\n"
            f"Workshop: {workshop_title}\n"
            f"Enrollment ID: {enrollment_id}\n"
        )
        sender = current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME')
        msg = Message(
            subject=f"Workshop Enrollment Confirmation - {workshop_title}",
            recipients=[email],
            sender=('Whimsy & Weave', sender),
            body=body
        )
        mail.send(msg)
        email_sent = True
    except Exception as exc:
        print('Workshop enrollment email failed:', exc)

    return jsonify(
        success=True,
        message='Enrollment confirmed',
        enrollmentId=enrollment_id,
        emailSent=email_sent
    ), 201


@workshops_bp.route('/my', methods=['GET'])
@jwt_required()
def my_workshops():
    user = _get_current_user()
    if not user:
        return jsonify(success=False, message='User not found'), 404

    registrations = WorkshopRegistration.query.filter_by(user_id=user.id).order_by(WorkshopRegistration.created_at.desc()).all()
    return jsonify(success=True, count=len(registrations), workshops=[r.to_dict() for r in registrations])
