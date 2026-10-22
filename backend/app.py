
import os
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    send_from_directory
)

from flask_cors import CORS
from dotenv import load_dotenv

from config import Config
from extensions import db, migrate, jwt, mail

from blueprints.auth import auth_bp
from blueprints.products import products_bp
from blueprints.orders import orders_bp
from blueprints.cart import cart_bp
from blueprints.wishlist import wishlist_bp
from blueprints.custom_orders import custom_orders_bp
from blueprints.payment import payment_bp
from blueprints.workshops import workshops_bp
from blueprints.admin import admin_bp
from blueprints.contact import contact_bp
from blueprints.subscriptions import subscriptions_bp


# =========================
# PATHS
# =========================

basedir = Path(__file__).resolve().parent
rootdir = basedir.parent

load_dotenv(rootdir / '.env')
load_dotenv(basedir / '.env', override=True)


# =========================
# CREATE APP
# =========================

def create_app():

    frontend_path = str(
        basedir.parent / 'frontend'
    )

    app = Flask(
        __name__,
        static_folder=frontend_path,
        static_url_path='/'
    )

    app.config.from_object(Config)

    # =========================
    # CORS
    # =========================

    cors_origins = [

        app.config.get('FRONTEND_URL'),

        'http://localhost:5000',
        'http://127.0.0.1:5000',

        'http://localhost:5500',
        'http://127.0.0.1:5500',

        'http://localhost:8080',
        'http://127.0.0.1:8080',

        'http://localhost:8081',
        'http://127.0.0.1:8081',
    ]

    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/api/*": {
                "origins": cors_origins
            }
        }
    )

    # =========================
    # EXTENSIONS
    # =========================

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)

    # =========================
    # DATABASE
    # =========================

    with app.app_context():

        import models

        db.create_all()

        from schema import ensure_schema
        ensure_schema()

    # =========================
    # BLUEPRINTS
    # =========================

    app.register_blueprint(
        auth_bp,
        url_prefix='/api/auth'
    )

    app.register_blueprint(
        products_bp,
        url_prefix='/api/products'
    )

    app.register_blueprint(
        orders_bp,
        url_prefix='/api/orders'
    )

    app.register_blueprint(
        cart_bp,
        url_prefix='/api/cart'
    )

    app.register_blueprint(
        wishlist_bp,
        url_prefix='/api/wishlist'
    )

    app.register_blueprint(
        custom_orders_bp,
        url_prefix='/api/custom-orders'
    )

    app.register_blueprint(
        payment_bp,
        url_prefix='/api/payment'
    )

    app.register_blueprint(
        workshops_bp,
        url_prefix='/api/workshops'
    )

    app.register_blueprint(
        admin_bp,
        url_prefix='/api/admin'
    )

    app.register_blueprint(
        contact_bp,
        url_prefix='/api/contact'
    )

    app.register_blueprint(
        subscriptions_bp,
        url_prefix='/api/subscriptions'
    )

    # =========================
    # HEALTH CHECK
    # =========================

    @app.route('/api/health')
    def health():

        return jsonify({

            "success": True,
            "status": "OK",
            "message": "Whimsy & Weave API running"

        })

    # =========================
    # FRONTEND ROUTES
    # =========================

    @app.route('/')
    def home():

        return send_from_directory(
            app.static_folder,
            'index.html'
        )

    @app.route('/<path:filename>')
    def frontend_files(filename):

        # Prevent API conflicts
        if filename.startswith('api'):
            return jsonify({
                "success": False,
                "message": "API route not found"
            }), 404

        # Serve requested frontend asset if it exists
        file_path = os.path.join(app.static_folder, filename)
        if os.path.exists(file_path):
            return send_from_directory(app.static_folder, filename)

        # SPA-style fallback: serve index.html for unknown frontend routes
        if os.path.exists(os.path.join(app.static_folder, 'index.html')):
            return send_from_directory(app.static_folder, 'index.html')

        return jsonify({
            "success": False,
            "message": f"{filename} not found"
        }), 404

    # =========================
    # ERROR HANDLERS
    # =========================

    @app.errorhandler(404)
    def not_found(error):

        return jsonify({

            "success": False,
            "message": "Route not found"

        }), 404

    @app.errorhandler(500)
    def internal_error(error):

        return jsonify({

            "success": False,
            "message": "Internal server error"

        }), 500

    return app


# =========================
# RUN APP
# =========================

if __name__ == '__main__':

    app = create_app()

    with app.app_context():

        from models import Product

        try:

            product_count = Product.query.count()

            print(
                f'MySQL connected - '
                f'{product_count} products loaded'
            )

        except Exception as exc:

            print(
                f'MySQL connection warning: {exc}'
            )

    port = Config.PORT

    print(f'Server running:')
    print(f'http://127.0.0.1:{port}/')

    app.run(
        host='0.0.0.0',
        port=port,
        debug=app.config.get('DEBUG', False)
    )

