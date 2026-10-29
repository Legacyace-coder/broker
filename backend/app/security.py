from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client
from .config import settings

bearer = HTTPBearer(auto_error=False)
public_auth: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
admin_db: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue")
    try:
        response = public_auth.auth.get_user(credentials.credentials)
        user = response.user
        if not user:
            raise ValueError("No user")
        return {"id": str(user.id), "email": user.email, "token": credentials.credentials}
    except Exception:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired")


def member_user(user: dict = Depends(current_user)) -> dict:
    try:
        result = (
            admin_db.table("profiles")
            .select("id,role")
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not verify account permissions.",
        )

    if not result.data:
        raise HTTPException(
            status_code=403,
            detail="Member account required.",
        )

    if result.data.get("role") != "member":
        raise HTTPException(
            status_code=403,
            detail="Member account required.",
        )

    return {**user, "profile": result.data}


def admin_user(user: dict = Depends(current_user)) -> dict:
    try:
        result = (
            admin_db.table("profiles")
            .select("id,role,full_name,email")
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not verify administrator permissions.",
        )

    if not result.data or result.data.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    return {**user, "profile": result.data}
