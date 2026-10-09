from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,
    pool_use_lifo=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def warm_database_pool() -> None:
    """
    Open one database connection during application startup so
    the first user-facing request does not pay the full remote
    connection/TLS setup cost.
    """
    with engine.connect() as connection:
        connection.execute(
            text("SELECT 1")
        ).scalar_one()
