import hashlib
import hmac
import time
import threading
from collections import deque
import uuid
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import pool, jwt_secret, cache, demo_enabled

bearer = HTTPBearer(auto_error=False)


def audit(conn, actor, action, resource):
    conn.execute(
        "INSERT INTO audit_logs(user_id,action,resource_id) VALUES(%s,%s,%s)",
        (str(actor), action, str(resource)),
    )


def password_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def token_for(user):
    now = int(time.time())
    return jwt.encode(
        dict(sub=str(user["id"]), iss="fraudshield", iat=now, exp=now + 3600),
        jwt_secret,
        algorithm="HS256",
    )


def resolve_token(token):
    try:
        claims = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            issuer="fraudshield",
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
        uid = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Session expired. Please sign in again.")
    with pool.connection() as conn:
        user = conn.execute(
            "SELECT id,email,role FROM app_users WHERE id=%s", (uid,)
        ).fetchone()
    if not user:
        raise HTTPException(401, "Account not found")
    user["expiresAt"] = claims["exp"]
    return user


def current_user(
    request: Request, auth: HTTPAuthorizationCredentials = Depends(bearer)
):
    if not auth:
        raise HTTPException(401, "Authentication required")
    user = resolve_token(auth.credentials)
    if request.method == "GET":
        with pool.connection() as conn:
            audit(conn, user["id"], "READ", request.url.path[:100])
    return user


def roles(*allowed):
    def check(user=Depends(current_user)):
        if user["role"] not in allowed:
            raise HTTPException(403, "This action is not allowed for your role")
        return user

    return check


def hashed(value):
    return hmac.new(jwt_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


RATE_SCRIPT = """
local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n
"""

_rate_lock = threading.Lock()
_local_rates = {}


def rate_limit(key, limit=15, seconds=60):
    try:
        if int(cache.eval(RATE_SCRIPT, 1, "rate:" + hashed(key), seconds)) > limit:
            raise HTTPException(429, "Too many requests. Try again in a minute.")
    except HTTPException:
        raise
    except Exception:
        if not demo_enabled:
            raise HTTPException(503, "Rate limiting is temporarily unavailable")
        # The local demo has one API process. Keep enforcing limits during a Redis outage.
        with _rate_lock:
            now = time.monotonic()
            if len(_local_rates) > 10000:
                _local_rates.clear()
            attempts = _local_rates.setdefault(hashed(key), deque())
            while attempts and attempts[0] < now - seconds:
                attempts.popleft()
            if len(attempts) >= limit:
                raise HTTPException(429, "Too many requests. Try again in a minute.")
            attempts.append(now)
