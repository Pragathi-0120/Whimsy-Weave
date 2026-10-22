from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail

# Shared extensions for the Flask app.

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()
