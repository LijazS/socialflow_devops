"""
Feed Service — queries the shared 'post_db' (posts table) and 'auth_db' (follows table)
to build a personalised timeline for the authenticated user.
The DATABASE_URL env var should point to a MySQL instance that has access to both databases,
or you can point to a single combined schema.  In the docker-compose setup we use the same
MySQL host and rely on cross-schema references.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# The feed service talks to the same MySQL host as the other services.
# For RDS: set this to your RDS endpoint.
AUTH_DB_URL = os.getenv("AUTH_DATABASE_URL", "mysql+pymysql://root:password@mysql:3306/auth_db")
POST_DB_URL = os.getenv("POST_DATABASE_URL", "mysql+pymysql://root:password@mysql:3306/post_db")

auth_engine = create_engine(AUTH_DB_URL, pool_pre_ping=True)
post_engine = create_engine(POST_DB_URL, pool_pre_ping=True)

AuthSession = sessionmaker(bind=auth_engine)
PostSession = sessionmaker(bind=post_engine)


def get_auth_db():
    db = AuthSession()
    try:
        yield db
    finally:
        db.close()


def get_post_db():
    db = PostSession()
    try:
        yield db
    finally:
        db.close()
