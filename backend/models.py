from datetime import datetime
import json
import os
from sqlalchemy.orm import synonym
from werkzeug.security import check_password_hash, generate_password_hash
from extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column('password', db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    avatar = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    address = db.Column(db.JSON, nullable=True)
    is_email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cart = db.relationship('Cart', uselist=False, back_populates='user', cascade='all, delete-orphan')
    orders = db.relationship('Order', back_populates='user', cascade='all, delete-orphan')
    custom_orders = db.relationship('CustomOrder', back_populates='user', cascade='all, delete-orphan')
    wishlist_items = db.relationship('WishlistItem', back_populates='user', cascade='all, delete-orphan')
    workshop_registrations = db.relationship('WorkshopRegistration', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        stored = self.password_hash or ''
        if stored.startswith(('pbkdf2:', 'scrypt:', 'argon2:')):
            return check_password_hash(stored, password)
        return stored == password

    @property
    def effective_role(self):
        admin_email = (os.environ.get('ADMIN_EMAIL') or '').strip().lower()
        return 'admin' if admin_email and self.email.lower() == admin_email else (self.role or 'user')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.effective_role,
            'avatar': self.avatar,
            'phone': self.phone,
            'address': self.address,
            'isEmailVerified': self.is_email_verified,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    name = synonym('title')
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    image = db.Column(db.String(500), nullable=True)
    rating = db.Column(db.Float, nullable=True, default=0.0)
    stock = db.Column(db.Integer, nullable=True, default=0)
    featured = db.Column(db.Boolean, nullable=True, default=False)
    is_featured = synonym('featured')
    _tags = db.Column('tags', db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reviews = db.relationship('Review', back_populates='product', cascade='all, delete-orphan')

    @property
    def tags(self):
        if not self._tags:
            return []
        if isinstance(self._tags, list):
            return self._tags
        try:
            parsed = json.loads(self._tags)
            return parsed if isinstance(parsed, list) else [str(parsed)]
        except (TypeError, ValueError):
            return [tag.strip() for tag in str(self._tags).split(',') if tag.strip()]

    @tags.setter
    def tags(self, value):
        if isinstance(value, list):
            self._tags = json.dumps(value)
        elif value is None:
            self._tags = None
        else:
            self._tags = str(value)

    @property
    def short_description(self):
        return self.description[:200] if self.description else ''

    @property
    def original_price(self):
        return None

    @property
    def subcategory(self):
        return None

    @property
    def images(self):
        return [{'url': self.image}] if self.image else []

    @images.setter
    def images(self, value):
        if isinstance(value, list) and value:
            first_image = value[0]
            self.image = first_image.get('url') if isinstance(first_image, dict) else str(first_image)
        elif isinstance(value, str):
            self.image = value

    @property
    def inventory(self):
        return {'quantity': self.stock or 0, 'trackInventory': True}

    @inventory.setter
    def inventory(self, value):
        if isinstance(value, dict) and 'quantity' in value:
            self.stock = value.get('quantity') or 0

    @property
    def shipping(self):
        return {}

    @property
    def seo(self):
        return {}

    @property
    def is_active(self):
        return True

    @property
    def is_customizable(self):
        return False

    @property
    def customization_options(self):
        return []

    @property
    def attributes(self):
        return {}

    @property
    def ratings(self):
        if self.reviews:
            total = sum(review.rating for review in self.reviews)
            return {'average': round(total / len(self.reviews), 1), 'count': len(self.reviews)}
        return {'average': self.rating or 0.0, 'count': 0}

    @ratings.setter
    def ratings(self, value):
        if isinstance(value, dict):
            self.rating = float(value.get('average') or 0.0)
        else:
            self.rating = float(value or 0.0)

    def to_dict(self):
        inventory = self.inventory
        ratings = self.ratings

        return {
            'id': self.id,
            'name': self.name,
            'title': self.name,
            'description': self.description,
            'shortDescription': self.short_description,
            'price': self.price,
            'originalPrice': self.original_price,
            'category': self.category,
            'subcategory': self.subcategory,
            'image': self.image or '',
            'images': self.images,
            'inventory': inventory,
            'stock': inventory.get('quantity', 0),
            'shipping': self.shipping or {},
            'seo': self.seo or {},
            'tags': self.tags or [],
            'isActive': self.is_active,
            'active': self.is_active,
            'isFeatured': self.is_featured,
            'featured': self.is_featured,
            'isCustomizable': self.is_customizable,
            'customizationOptions': self.customization_options or [],
            'attributes': self.attributes or {},
            'ratings': ratings,
            'rating': ratings.get('average', 0.0),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': None,
            'reviewCount': ratings.get('count', 0)
        }


class Review(db.Model):
    __tablename__ = 'reviews'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewer_name = db.Column(db.String(120), nullable=True)
    photo = db.Column(db.Text, nullable=True)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    product = db.relationship('Product', back_populates='reviews')
    user = db.relationship('User')

    @property
    def display_name(self):
        return self.user.name if self.user else (self.reviewer_name or 'Whimsy Customer')

    def to_dict(self):
        return {
            'id': self.id,
            'productId': self.product_id,
            'userId': self.user_id,
            'userName': self.display_name,
            'name': self.display_name,
            'rating': self.rating,
            'comment': self.comment,
            'text': self.comment,
            'photo': self.photo or '',
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class Cart(db.Model):
    __tablename__ = 'carts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    total_items = db.Column(db.Integer, default=0)
    total_price = db.Column(db.Float, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', back_populates='cart')
    items = db.relationship('CartItem', back_populates='cart', cascade='all, delete-orphan')


class CartItem(db.Model):
    __tablename__ = 'cart_items'

    id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey('carts.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    image = db.Column(db.String(255), nullable=True)
    price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    customization = db.Column(db.JSON, nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    cart = db.relationship('Cart', back_populates='items')
    product = db.relationship('Product')


class WishlistItem(db.Model):
    __tablename__ = 'wishlist_items'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='wishlist_items')
    product = db.relationship('Product')


class OrderItem(db.Model):
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    image = db.Column(db.String(255), nullable=True)
    price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    customization = db.Column(db.JSON, nullable=True)

    order = db.relationship('Order', back_populates='order_items')
    product = db.relationship('Product')


class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shipping_address = db.Column(db.JSON, nullable=True)
    payment_method = db.Column(db.String(50), nullable=False)
    payment_status = db.Column(db.String(50), nullable=False, default='pending')
    payment_result = db.Column(db.JSON, nullable=True)
    tax_price = db.Column(db.Float, nullable=False, default=0.0)
    shipping_price = db.Column(db.Float, nullable=False, default=0.0)
    items_price = db.Column(db.Float, nullable=False, default=0.0)
    total_price = db.Column('total_amount', db.Float, nullable=False, default=0.0)
    legacy_total = db.Column('total', db.Float, nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    paid_at = db.Column(db.DateTime, nullable=True)
    is_delivered = db.Column(db.Boolean, default=False)
    delivered_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='pending')
    tracking_number = db.Column(db.String(120), nullable=True)
    estimated_delivery = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', back_populates='orders')
    order_items = db.relationship('OrderItem', back_populates='order', cascade='all, delete-orphan')


class CustomOrder(db.Model):
    __tablename__ = 'custom_orders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    customer_info = db.Column(db.JSON, nullable=False)
    product_type = db.Column(db.String(80), nullable=False)
    custom_details = db.Column(db.JSON, nullable=False)
    reference_images = db.Column(db.JSON, nullable=True)
    timeline = db.Column(db.String(50), nullable=False, default='normal')
    status = db.Column(db.String(50), nullable=False, default='pending')
    estimated_price = db.Column(db.JSON, nullable=True)
    final_price = db.Column(db.Float, nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    completion_date = db.Column(db.DateTime, nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    payment_details = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', back_populates='custom_orders')


class WorkshopRegistration(db.Model):
    __tablename__ = 'workshop_registrations'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    workshop_id = db.Column(db.Integer, nullable=False)
    workshop_title = db.Column(db.String(255), nullable=False)
    workshop_data = db.Column(db.JSON, nullable=True)
    customer_name = db.Column(db.String(120), nullable=True)
    customer_email = db.Column(db.String(150), nullable=True)
    customer_phone = db.Column(db.String(30), nullable=True)
    experience_level = db.Column(db.String(80), nullable=True)
    special_requirements = db.Column(db.Text, nullable=True)
    payment_method = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='workshop_registrations')

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'workshopId': self.workshop_id,
            'workshopTitle': self.workshop_title,
            'workshopData': self.workshop_data,
            'customerName': self.customer_name,
            'customerEmail': self.customer_email,
            'customerPhone': self.customer_phone,
            'experienceLevel': self.experience_level,
            'specialRequirements': self.special_requirements,
            'paymentMethod': self.payment_method,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class PaymentTransaction(db.Model):
    __tablename__ = 'payment_transactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='INR')
    method = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='pending')
    provider = db.Column(db.String(50), nullable=True)
    provider_response = db.Column(db.JSON, nullable=True)
    client_token = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User')
    order = db.relationship('Order')


class Subscriber(db.Model):
    __tablename__ = 'subscribers'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=True)
    source = db.Column(db.String(50), nullable=True)
    is_confirmed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'source': self.source,
            'isConfirmed': self.is_confirmed,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class ContactMessage(db.Model):
    __tablename__ = 'contact_messages'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    subject = db.Column(db.String(255), nullable=True)
    enquiry_type = db.Column(db.String(100), nullable=True)
    message = db.Column(db.Text, nullable=False)
    attachments = db.Column(db.JSON, nullable=True)
    preferred_contact = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'subject': self.subject,
            'enquiryType': self.enquiry_type,
            'message': self.message,
            'attachments': self.attachments or [],
            'preferredContact': self.preferred_contact,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }
