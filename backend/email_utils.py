"""Welcome and notification emails for Whimsy & Weave."""

from flask import current_app
from flask_mail import Message


def build_welcome_email(recipient_email, name=None):
    display_name = name or 'Friend'
    site_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5000')
    sender = current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME')

    subject = 'Thank you for joining the Cozy Crochet Club — Whimsy & Weave'

    text_body = f"""Hi {display_name},

Thank you for subscribing to Whimsy & Weave!

You are now part of our Cozy Crochet Club. We will keep you updated with:
  • New handmade crochet products and collection drops
  • Workshop announcements and early access
  • Special offers and styling inspiration

Visit our shop anytime: {site_url}

With warm stitches,
Whimsy & Weave
A little whimsy in every weave
"""

    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; color: #4a3f3a; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hi {display_name},</p>
  <p><strong>Thank you for subscribing to Whimsy &amp; Weave!</strong></p>
  <p>You are now part of our <em>Cozy Crochet Club</em>. We will keep you updated with:</p>
  <ul>
    <li>New handmade crochet products and collection drops</li>
    <li>Workshop announcements and early access</li>
    <li>Special offers and styling inspiration</li>
  </ul>
  <p><a href="{site_url}" style="color: #8b5e4b;">Browse our latest creations</a></p>
  <p>With warm stitches,<br><strong>Whimsy &amp; Weave</strong><br><small>A little whimsy in every weave</small></p>
</body>
</html>"""

    msg = Message(
        subject=subject,
        recipients=[recipient_email],
        sender=('Whimsy & Weave', sender),
        body=text_body,
        html=html_body,
    )
    return msg


def send_welcome_email(recipient_email, name=None):
    """Send welcome email to the subscriber. Returns (success, error_message)."""
    if not current_app.config.get('MAIL_USERNAME') or not current_app.config.get('MAIL_PASSWORD'):
        return False, 'Mail is not configured (set MAIL_USERNAME and MAIL_PASSWORD in .env)'

    try:
        msg = build_welcome_email(recipient_email, name)
        from extensions import mail
        mail.send(msg)
        return True, None
    except Exception as exc:
        current_app.logger.exception('Welcome email failed for %s', recipient_email)
        return False, str(exc)
