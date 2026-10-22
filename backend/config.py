import os
from pathlib import Path
from urllib.parse import quote_plus
from dotenv import load_dotenv

basedir = Path(__file__).resolve().parent
rootdir = basedir.parent

# Load the project-level .env first, then allow backend/.env to override it.
load_dotenv(rootdir / '.env')
load_dotenv(rootdir / 'email-config.env', override=True)
load_dotenv(basedir / '.env', override=True)


class Config:
    MYSQL_USER = os.environ.get('MYSQL_USER') or os.environ.get('DB_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD') or os.environ.get('DB_PASSWORD', 'password')
    MYSQL_HOST = os.environ.get('MYSQL_HOST') or os.environ.get('DB_HOST', '127.0.0.1')
    MYSQL_PORT = os.environ.get('MYSQL_PORT') or os.environ.get('DB_PORT', '3306')
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE') or os.environ.get('DB_NAME', 'whimsy_weave')

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f"mysql+pymysql://{quote_plus(MYSQL_USER)}:{quote_plus(MYSQL_PASSWORD)}@"
        f"{MYSQL_HOST}:{MYSQL_PORT}/{quote_plus(MYSQL_DATABASE)}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET', 'change-this-secret')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get('JWT_EXPIRE_DAYS', 7)) * 24 * 60 * 60
    DEBUG = os.environ.get('FLASK_DEBUG', '0') in ('1', 'true', 'True')
    DEMO_PAYMENT_MODE = os.environ.get('DEMO_PAYMENT_MODE', '1') in ('1', 'true', 'True')
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5000')
    PORT = int(os.environ.get('PORT', 5000))
    # Email / SMTP settings (use env vars in .env)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', '1') in ('1', 'true', 'True')
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', '0') in ('1', 'true', 'True')
    MAIL_USERNAME = (os.environ.get('MAIL_USERNAME') or '').strip() or None
    MAIL_PASSWORD = (os.environ.get('MAIL_PASSWORD') or '').replace(' ', '').strip() or None
    MAIL_DEFAULT_SENDER = (os.environ.get('MAIL_DEFAULT_SENDER') or MAIL_USERNAME or '').strip() or None
