from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# SQLite checks threads by default. FastAPI uses multithreading for async operations,
# so we disable check_same_thread for SQLite connections.
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency generator to manage DB connection session lifecycles
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
