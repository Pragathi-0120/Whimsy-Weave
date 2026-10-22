from flask import Blueprint, request, jsonify, current_app
from flask_mail import Message
from extensions import db, mail
from models import ContactMessage

contact_bp = Blueprint('contact', __name__)


@contact_bp.route('/', methods=['POST'])
def submit_contact():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip()
    subject = (data.get('subject') or '').strip() or 'New enquiry from website'
    enquiry_type = (data.get('enquiryType') or '').strip()
    message_text = (data.get('message') or '').strip()
    preferred_contact = (data.get('preferredContact') or '').strip()
    attachments = data.get('attachments') or []

    if not name or not email or not message_text:
        return jsonify(success=False, message='Please provide name, email, and message'), 400

    contact = ContactMessage(
        name=name,
        email=email,
        phone=phone,
        subject=subject,
        enquiry_type=enquiry_type,
        message=message_text,
        attachments=attachments,
        preferred_contact=preferred_contact
    )
    db.session.add(contact)
    db.session.commit()

    sender = current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME')
    recipient = current_app.config.get('CONTACT_RECIPIENT') or current_app.config.get('MAIL_DEFAULT_SENDER') or email
    try:
        msg = Message(
            subject=f'Contact Form: {subject}',
            recipients=[recipient],
            sender=('Whimsy & Weave', sender)
        )
        msg.body = (
            f'New contact enquiry from {name} <{email}>\n'
            f'Phone: {phone or "N/A"}\n'
            f'Preferred contact: {preferred_contact or "N/A"}\n'
            f'Enquiry type: {enquiry_type or "N/A"}\n\n'
            f'Message:\n{message_text}\n\n'
            f'Attachments: {attachments or []}'
        )
        mail.send(msg)
    except Exception as e:
        print('Contact email send failed:', e)

    return jsonify(success=True, message='Your enquiry was submitted successfully'), 201
