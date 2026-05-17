from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite is used for the MVP. It stores everything locally in medilens.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./medilens.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get a database session for each API request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
