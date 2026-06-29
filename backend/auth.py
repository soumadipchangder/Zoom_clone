import os
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext  # type: ignore[import-untyped]

try:
    import jwt  # PyJWT
except ImportError:
    raise RuntimeError("Install PyJWT: pip install PyJWT")

# Read from environment in production
SECRET_KEY = os.environ.get("SECRET_KEY", "super_secret_zoom_key_for_demo_purposes")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt: str = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)  # type: ignore[attr-defined]
    return encoded_jwt


def decode_access_token(token: str) -> dict | None:
    try:
        payload: dict = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore[attr-defined]
        return payload
    except Exception:
        return None
