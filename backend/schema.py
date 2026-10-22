from sqlalchemy import inspect, text
from extensions import db


SCHEMA_UPDATES = {
    'users': {
        'role': "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'",
        'avatar': "ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL",
        'phone': "ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL",
        'address': "ALTER TABLE users ADD COLUMN address JSON NULL",
        'is_email_verified': "ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT 0",
        'updated_at': "ALTER TABLE users ADD COLUMN updated_at DATETIME NULL",
    },
    'orders': {
        'shipping_address': "ALTER TABLE orders ADD COLUMN shipping_address JSON NULL",
        'payment_result': "ALTER TABLE orders ADD COLUMN payment_result JSON NULL",
        'tax_price': "ALTER TABLE orders ADD COLUMN tax_price FLOAT NOT NULL DEFAULT 0",
        'shipping_price': "ALTER TABLE orders ADD COLUMN shipping_price FLOAT NOT NULL DEFAULT 0",
        'items_price': "ALTER TABLE orders ADD COLUMN items_price FLOAT NOT NULL DEFAULT 0",
        'is_paid': "ALTER TABLE orders ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT 1",
        'paid_at': "ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL",
        'is_delivered': "ALTER TABLE orders ADD COLUMN is_delivered BOOLEAN NOT NULL DEFAULT 0",
        'delivered_at': "ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL",
        'status': "ALTER TABLE orders ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Order Confirmed'",
        'tracking_number': "ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(120) NULL",
        'estimated_delivery': "ALTER TABLE orders ADD COLUMN estimated_delivery DATETIME NULL",
        'notes': "ALTER TABLE orders ADD COLUMN notes TEXT NULL",
        'updated_at': "ALTER TABLE orders ADD COLUMN updated_at DATETIME NULL",
    },
    'order_items': {
        'name': "ALTER TABLE order_items ADD COLUMN name VARCHAR(120) NULL",
        'image': "ALTER TABLE order_items ADD COLUMN image VARCHAR(255) NULL",
        'customization': "ALTER TABLE order_items ADD COLUMN customization JSON NULL",
    },
    'workshop_registrations': {
        '_create': """
            CREATE TABLE IF NOT EXISTS workshop_registrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                workshop_id INT NOT NULL,
                workshop_title VARCHAR(255) NOT NULL,
                workshop_data JSON NULL,
                customer_name VARCHAR(120) NULL,
                customer_email VARCHAR(150) NULL,
                customer_phone VARCHAR(30) NULL,
                experience_level VARCHAR(80) NULL,
                special_requirements TEXT NULL,
                payment_method VARCHAR(50) NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        'customer_name': "ALTER TABLE workshop_registrations ADD COLUMN customer_name VARCHAR(120) NULL",
        'customer_email': "ALTER TABLE workshop_registrations ADD COLUMN customer_email VARCHAR(150) NULL",
        'customer_phone': "ALTER TABLE workshop_registrations ADD COLUMN customer_phone VARCHAR(30) NULL",
        'experience_level': "ALTER TABLE workshop_registrations ADD COLUMN experience_level VARCHAR(80) NULL",
        'special_requirements': "ALTER TABLE workshop_registrations ADD COLUMN special_requirements TEXT NULL",
    },
    'payment_transactions': {
        '_create': """
            CREATE TABLE IF NOT EXISTS payment_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                order_id INT NULL,
                amount FLOAT NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'INR',
                method VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                provider VARCHAR(50) NULL,
                provider_response JSON NULL,
                client_token VARCHAR(255) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
    },
    'reviews': {
        'reviewer_name': "ALTER TABLE reviews ADD COLUMN reviewer_name VARCHAR(120) NULL",
        'photo': "ALTER TABLE reviews ADD COLUMN photo TEXT NULL",
    },
}


def ensure_schema():
    """Add non-destructive columns/tables needed by the Flask ecommerce flow."""
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())

    for table, updates in SCHEMA_UPDATES.items():
        if table not in existing_tables and '_create' in updates:
            db.session.execute(text(updates['_create']))
            db.session.commit()
            existing_tables.add(table)

        if table not in existing_tables:
            continue

        existing_columns = {column['name'] for column in inspector.get_columns(table)}
        for column_name, ddl in updates.items():
            if column_name == '_create' or column_name in existing_columns:
                continue
            db.session.execute(text(ddl))
            db.session.commit()

    if 'workshop_registrations' in existing_tables:
        dialect = db.engine.dialect.name
        if dialect in {'mysql', 'mariadb'}:
            try:
                db.session.execute(text("ALTER TABLE workshop_registrations MODIFY COLUMN customer_name VARCHAR(120) NULL"))
                db.session.execute(text("ALTER TABLE workshop_registrations MODIFY COLUMN customer_email VARCHAR(150) NULL"))
                db.session.execute(text("ALTER TABLE workshop_registrations MODIFY COLUMN customer_phone VARCHAR(30) NULL"))
                db.session.commit()
            except Exception as e:
                print('Warning: Failed to modify workshop_registrations columns to NULLable:', e)

    if 'reviews' in existing_tables:
        review_columns = {column['name']: column for column in inspector.get_columns('reviews')}
        user_id_column = review_columns.get('user_id')
        if user_id_column and not user_id_column.get('nullable', True):
            dialect = db.engine.dialect.name
            if dialect in {'mysql', 'mariadb'}:
                db.session.execute(text("ALTER TABLE reviews MODIFY COLUMN user_id INT NULL"))
                db.session.commit()

    # migrate legacy workshop_enrollments data if it exists and workshop_registrations is missing
    if 'workshop_registrations' not in existing_tables and 'workshop_enrollments' in existing_tables:
        db.session.execute(text(SCHEMA_UPDATES['workshop_registrations']['_create']))
        db.session.execute(text("""
            INSERT INTO workshop_registrations (
                user_id, workshop_id, workshop_title, workshop_data,
                customer_name, customer_email, customer_phone,
                experience_level, special_requirements, payment_method,
                status, created_at
            )
            SELECT
                NULL, workshop_id, workshop_title, workshop_data,
                customer_name, customer_email, customer_phone,
                experience_level, special_requirements, payment_method,
                status, created_at
            FROM workshop_enrollments
        """))
        db.session.commit()
        existing_tables.add('workshop_registrations')
