
import json
import time
import logging
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from supabase import Client

from .member_features import router as member_features_router
from .config import settings
from .security import admin_db, current_user, member_user, admin_user
from .schemas import (
    BankInstructionsUpdate,
    BalanceSetRequest,
    CryptoInstructionsUpdate,
    DepositRequest,
    DepositReviewRequest,
    PlanCreate,
    PlanUpdate,
    ReviewRequest,
    WithdrawalRequest,
    validate_plan_amount_range,
)


app = FastAPI(title="Northstar Capital API", version="1.0.0")
logger = logging.getLogger(__name__)

origins = [
    x.strip()
    for x in settings.cors_origins.split(",")
    if x.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(member_features_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "northstar-capital-api",
    }


# ============================================================
# MARKET DATA
# ============================================================

_market_cache = {
    "items": None,
    "fetched_at": None,
    "cached_at": 0.0,
}


@app.get("/api/market/prices")
def market_prices():
    """Return reference crypto market prices from CoinGecko."""

    now = time.time()

    if (
        _market_cache["items"] is not None
        and now - _market_cache["cached_at"] < 60
    ):
        return {
            "source": "CoinGecko",
            "items": _market_cache["items"],
            "fetched_at": _market_cache["fetched_at"],
            "stale": False,
        }

    api_key = settings.coingecko_api_key.strip()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Market data is not configured.",
        )

    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        "?vs_currency=usd"
        "&ids=bitcoin%2Cethereum%2Csolana%2Ctether"
        "&price_change_percentage=24h"
    )

    request = Request(
        url,
        headers={
            "accept": "application/json",
            "x-cg-demo-api-key": api_key,
            "user-agent": "NorthstarCapital/1.0",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(
                response.read().decode("utf-8")
            )

        if not isinstance(payload, list) or not payload:
            raise ValueError("Unexpected market data response")

        items = []

        for coin in payload:
            price = coin.get("current_price")

            if not isinstance(price, (int, float)):
                continue

            items.append({
                "id": coin.get("id"),
                "name": coin.get("name"),
                "symbol": str(
                    coin.get("symbol") or ""
                ).upper(),
                "price_usd": price,
                "change_24h": coin.get(
                    "price_change_percentage_24h"
                ),
                "market_cap": coin.get("market_cap"),
                "total_volume": coin.get("total_volume"),
                "last_updated": coin.get("last_updated"),
            })

        if not items:
            raise ValueError("No usable market prices returned")

        fetched_at = datetime.now(timezone.utc).isoformat()

        _market_cache.update({
            "items": items,
            "fetched_at": fetched_at,
            "cached_at": time.time(),
        })

        return {
            "source": "CoinGecko",
            "items": items,
            "fetched_at": fetched_at,
            "stale": False,
        }

    except (
        HTTPError,
        URLError,
        TimeoutError,
        ValueError,
        json.JSONDecodeError,
    ) as exc:

        logger.warning(
            "Market data request failed: %s",
            type(exc).__name__,
        )

        if _market_cache["items"] is not None:
            return {
                "source": "CoinGecko",
                "items": _market_cache["items"],
                "fetched_at": _market_cache["fetched_at"],
                "stale": True,
            }

        raise HTTPException(
            status_code=503,
            detail="Live market data is temporarily unavailable.",
        )


# ============================================================
# AUTHENTICATION AND ROLE
# ============================================================

@app.get("/api/auth/role")
def auth_role(user: dict = Depends(current_user)):
    """Return only the signed-in user's role for safe portal routing."""

    try:
        result = (
            admin_db.table("profiles")
            .select("role")
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not verify account permissions.",
        )

    if (
        not result.data
        or result.data.get("role") not in {"member", "admin"}
    ):
        raise HTTPException(
            status_code=403,
            detail="This account does not have an authorised portal role.",
        )

    return {
        "role": result.data["role"],
    }


# ============================================================
# MEMBER PROFILE
# ============================================================

PROFILE_FIELDS = (
    "id,email,full_name,display_name,phone,role,"
    "kyc_status,kyc_uploaded_at,kyc_submitted_at,"
    "kyc_reviewed_at,kyc_reviewed_by,kyc_review_note,"
    "profile_image_path,created_at"
)


@app.get("/api/me")
def me(user: dict = Depends(member_user)):

    result = (
        admin_db.table("profiles")
        .select(PROFILE_FIELDS)
        .eq("id", user["id"])
        .maybe_single()
        .execute()
    )

    wallet = (
        admin_db.table("wallets")
        .select("balance,asset,updated_at")
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    return {
        "profile": result.data or {
            "id": user["id"],
            "email": user.get("email"),
        },
        "wallet": wallet.data or {
            "balance": 0,
            "asset": "USDT",
        },
    }


@app.patch("/api/me")
def update_me(
    payload: dict,
    user: dict = Depends(member_user),
):

    # Members can edit only these profile fields.
    # KYC status and review fields remain admin-controlled.
    allowed = {
        key: payload[key]
        for key in ("full_name", "display_name", "phone")
        if key in payload
    }

    if (
        "full_name" in allowed
        and (
            not isinstance(allowed["full_name"], str)
            or len(allowed["full_name"].strip()) > 120
        )
    ):
        raise HTTPException(422, "Invalid full name")

    if (
        "phone" in allowed
        and (
            not isinstance(allowed["phone"], str)
            or len(allowed["phone"]) > 40
        )
    ):
        raise HTTPException(422, "Invalid phone")

    if "display_name" in allowed and (
        not isinstance(allowed["display_name"], str)
        or len(allowed["display_name"].strip()) > 80
    ):
        raise HTTPException(422, "Invalid display name")

    if "full_name" in allowed:
        allowed["full_name"] = allowed["full_name"].strip()

    if "display_name" in allowed:
        allowed["display_name"] = allowed["display_name"].strip()

    if "phone" in allowed:
        allowed["phone"] = allowed["phone"].strip()

    if not allowed:
        raise HTTPException(
            422,
            "No valid profile fields were provided.",
        )

    result = (
        admin_db.table("profiles")
        .update(allowed)
        .eq("id", user["id"])
        .select(PROFILE_FIELDS)
        .execute()
    )

    return {
        "profile": result.data[0] if result.data else None,
    }


# ============================================================
# MEMBER PLANS
# ============================================================

@app.get("/api/plans")
def plans():

    result = (
        admin_db.table("plans")
        .select(
            "id,name,description,minimum_amount,maximum_amount,"
            "contract_duration_days,terms,active,created_at"
        )
        .eq("active", True)
        .order("minimum_amount")
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# MEMBER DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard(user: dict = Depends(member_user)):

    wallet = (
        admin_db.table("wallets")
        .select("balance,asset,updated_at")
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    deposits = (
        admin_db.table("deposits")
        .select("id,amount,asset,status,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    withdrawals = (
        admin_db.table("withdrawals")
        .select("id,amount,asset,status,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    txs = (
        admin_db.table("transactions")
        .select("id,kind,amount,asset,status,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(8)
        .execute()
    )

    return {
        "wallet": wallet.data or {
            "balance": 0,
            "asset": "USDT",
        },
        "deposits": deposits.data or [],
        "withdrawals": withdrawals.data or [],
        "transactions": txs.data or [],
    }


# ============================================================
# PAYMENT INSTRUCTIONS
# ============================================================

@app.get("/api/payment-instructions")
def payment_instructions(
    _: dict = Depends(member_user),
):

    fields = (
        "method,network,wallet_address,instructions,"
        "bank_name,account_name,account_number,iban,"
        "swift_bic,currency"
    )

    result = (
        admin_db.table("payment_instructions")
        .select(fields)
        .eq("enabled", True)
        .order("method")
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# MEMBER DEPOSITS
# ============================================================

@app.post("/api/deposits", status_code=201)
def create_deposit(
    payload: DepositRequest,
    user: dict = Depends(member_user),
):

    if payload.asset.upper() != "USDT":
        raise HTTPException(
            422,
            "Only USDT deposits are supported",
        )

    configured = (
        admin_db.table("payment_instructions")
        .select("method,network,currency")
        .eq("method", payload.payment_method)
        .eq("enabled", True)
        .maybe_single()
        .execute()
    )

    if not configured.data:
        raise HTTPException(
            409,
            "This deposit method is not currently available",
        )

    if payload.payment_method == "crypto":
        payment_amount = Decimal(str(payload.amount))
        payment_currency = "USDT"
        network = configured.data["network"]

    else:
        payment_amount = payload.payment_amount
        payment_currency = payload.payment_currency.upper()

        if payment_currency != configured.data["currency"]:
            raise HTTPException(
                422,
                "Payment currency does not match the configured bank account",
            )

        network = "BANK"

    data = {
        "user_id": user["id"],
        "amount": payload.amount,
        "asset": "USDT",
        "network": network,
        "payment_method": payload.payment_method,
        "payment_amount": str(payment_amount),
        "payment_currency": payment_currency,
        "reference": payload.reference,
        "status": "pending",
    }

    result = (
        admin_db.table("deposits")
        .insert(data)
        .execute()
    )

    return {
        "message": (
            "Deposit request recorded. No funds are credited until "
            "an administrator verifies the payment."
        ),
        "item": result.data[0],
    }


@app.get("/api/deposits")
def list_deposits(user: dict = Depends(member_user)):

    result = (
        admin_db.table("deposits")
        .select(
            "id,amount,asset,network,payment_method,payment_amount,"
            "payment_currency,credited_amount,reference,status,"
            "review_note,created_at,reviewed_at"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# MEMBER WITHDRAWALS
# ============================================================

@app.post("/api/withdrawals", status_code=201)
def create_withdrawal(
    payload: WithdrawalRequest,
    user: dict = Depends(member_user),
):

    if payload.asset.upper() != "USDT":
        raise HTTPException(
            422,
            "Only USDT withdrawals are supported",
        )

    try:
        result = admin_db.rpc(
            "request_withdrawal",
            {
                "p_user_id": user["id"],
                "p_amount": payload.amount,
                "p_asset": payload.asset.upper(),
                "p_network": payload.network,
                "p_wallet_address": payload.wallet_address,
            },
        ).execute()

        return {
            "message": (
                "Withdrawal request submitted for review. "
                "No transfer has occurred yet."
            ),
            "item": result.data,
        }

    except Exception as exc:
        message = str(exc)

        if "Insufficient balance" in message:
            raise HTTPException(
                400,
                "Insufficient available balance",
            )

        raise HTTPException(
            400,
            "Could not submit withdrawal request. Check your balance and details.",
        )


@app.get("/api/withdrawals")
def list_withdrawals(user: dict = Depends(member_user)):

    result = (
        admin_db.table("withdrawals")
        .select(
            "id,amount,asset,network,wallet_address,status,"
            "review_note,created_at,reviewed_at"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# MEMBER TRANSACTIONS
# ============================================================

@app.get("/api/transactions")
def transactions(user: dict = Depends(member_user)):

    result = (
        admin_db.table("transactions")
        .select(
            "id,kind,amount,asset,status,reference,created_at"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# ADMIN OVERVIEW
# ============================================================

@app.get("/api/admin/overview")
def admin_overview(
    _: dict = Depends(admin_user),
):

    users = (
        admin_db.table("profiles")
        .select("id", count="exact")
        .execute()
    )

    deposits = (
        admin_db.table("deposits")
        .select("id", count="exact")
        .eq("status", "pending")
        .execute()
    )

    withdrawals = (
        admin_db.table("withdrawals")
        .select("id", count="exact")
        .eq("status", "pending")
        .execute()
    )

    approved_withdrawals = (
        admin_db.table("withdrawals")
        .select("id", count="exact")
        .eq("status", "approved")
        .execute()
    )

    return {
        "users": users.count or 0,
        "pending_deposits": deposits.count or 0,
        "pending_withdrawals": withdrawals.count or 0,
        "approved_withdrawals": approved_withdrawals.count or 0,
    }


# ============================================================
# ADMIN USERS
# ============================================================

@app.get("/api/admin/users")
def admin_users(
    _: dict = Depends(admin_user),
    limit: int = Query(100, ge=1, le=500),
):

    result = (
        admin_db.table("profiles")
        .select(
            "id,email,full_name,phone,role,created_at,"
            "wallets(balance,asset)"
        )
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return {
        "items": result.data or [],
    }


@app.put("/api/admin/users/{user_id}/balance")
def set_user_balance(
    user_id: str,
    payload: BalanceSetRequest,
    admin: dict = Depends(admin_user),
):

    try:
        result = admin_db.rpc(
            "admin_set_user_balance",
            {
                "p_user_id": user_id,
                "p_target_balance": str(payload.balance),
                "p_admin_id": admin["id"],
                "p_reason": payload.reason,
            },
        ).execute()

        return {
            "message": "User balance updated and recorded in the ledger",
            "item": result.data,
        }

    except APIError as exc:
        logger.exception(
            "Admin balance update failed for user %s",
            user_id,
        )

        raise HTTPException(
            400,
            "Balance could not be updated; verify the user and USDT wallet, then try again",
        ) from exc


# ============================================================
# ADMIN DEPOSITS
# ============================================================

@app.get("/api/admin/deposits")
def admin_deposits(
    _: dict = Depends(admin_user),
    status: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):

    q = (
        admin_db.table("deposits")
        .select("*,profiles(email,full_name)")
        .order("created_at", desc=True)
        .limit(limit)
    )

    if status:
        q = q.eq("status", status)

    return {
        "items": q.execute().data or [],
    }


@app.patch("/api/admin/deposits/{deposit_id}")
def review_deposit(
    deposit_id: str,
    payload: DepositReviewRequest,
    admin: dict = Depends(admin_user),
):

    deposit_result = (
        admin_db.table("deposits")
        .select("payment_method,amount,status")
        .eq("id", deposit_id)
        .maybe_single()
        .execute()
    )

    if not deposit_result.data:
        raise HTTPException(
            404,
            "Deposit request not found",
        )

    deposit = deposit_result.data

    if deposit["status"] != "pending":
        raise HTTPException(
            409,
            "Deposit request has already been reviewed",
        )

    if (
        payload.status == "approved"
        and deposit["payment_method"] == "bank"
        and payload.credited_amount is None
    ):
        raise HTTPException(
            422,
            "Enter the verified USDT credit amount for a bank transfer",
        )

    if (
        payload.status == "approved"
        and deposit["payment_method"] == "crypto"
        and payload.credited_amount is not None
        and payload.credited_amount != Decimal(str(deposit["amount"]))
    ):
        raise HTTPException(
            422,
            "Crypto deposits are credited at the requested USDT amount",
        )

    if (
        payload.status == "rejected"
        and payload.credited_amount is not None
    ):
        raise HTTPException(
            422,
            "Rejected deposits cannot have a credited amount",
        )

    try:
        result = admin_db.rpc(
            "review_deposit",
            {
                "p_deposit_id": deposit_id,
                "p_status": payload.status,
                "p_admin_id": admin["id"],
                "p_note": payload.note,
                "p_credited_amount": (
                    str(payload.credited_amount)
                    if payload.credited_amount is not None
                    else None
                ),
            },
        ).execute()

        return {
            "message": "Deposit review saved",
            "item": result.data,
        }

    except Exception:
        raise HTTPException(
            400,
            "Deposit could not be reviewed; it may already have been processed",
        )


# ============================================================
# ADMIN WITHDRAWALS
# ============================================================

@app.get("/api/admin/withdrawals")
def admin_withdrawals(
    _: dict = Depends(admin_user),
    status: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):

    q = (
        admin_db.table("withdrawals")
        .select("*,profiles(email,full_name)")
        .order("created_at", desc=True)
        .limit(limit)
    )

    if status:
        q = q.eq("status", status)

    return {
        "items": q.execute().data or [],
    }


@app.patch("/api/admin/withdrawals/{withdrawal_id}")
def review_withdrawal(
    withdrawal_id: str,
    payload: ReviewRequest,
    admin: dict = Depends(admin_user),
):

    if payload.status not in {
        "approved",
        "rejected",
        "completed",
    }:
        raise HTTPException(
            422,
            "Status must be approved, rejected or completed",
        )

    if (
        payload.status == "completed"
        and not (payload.note and payload.note.strip())
    ):
        raise HTTPException(
            422,
            "A transfer reference is required to mark a withdrawal complete",
        )

    try:
        result = admin_db.rpc(
            "review_withdrawal",
            {
                "p_withdrawal_id": withdrawal_id,
                "p_status": payload.status,
                "p_admin_id": admin["id"],
                "p_note": payload.note,
            },
        ).execute()

        message = (
            "Withdrawal marked complete. Confirm the transfer was sent before using this action."
            if payload.status == "completed"
            else "Withdrawal review saved. Approval records a review decision only; it does not send funds."
        )

        return {
            "message": message,
            "item": result.data,
        }

    except Exception:
        raise HTTPException(
            400,
            "Withdrawal could not be reviewed; it may already have been processed",
        )


# ============================================================
# ADMIN PAYMENT INSTRUCTIONS
# ============================================================

@app.get("/api/admin/payment-instructions")
def admin_payment_instructions(
    _: dict = Depends(admin_user),
):

    result = (
        admin_db.table("payment_instructions")
        .select("*")
        .order("method")
        .execute()
    )

    items = {
        item["method"]: item
        for item in result.data or []
    }

    return {
        "items": [
            items.get(
                "crypto",
                {
                    "method": "crypto",
                    "enabled": False,
                    "network": "",
                    "wallet_address": "",
                    "instructions": "",
                },
            ),
            items.get(
                "bank",
                {
                    "method": "bank",
                    "enabled": False,
                    "bank_name": "",
                    "account_name": "",
                    "account_number": "",
                    "iban": "",
                    "swift_bic": "",
                    "currency": "",
                    "instructions": "",
                },
            ),
        ],
    }


@app.put("/api/admin/payment-instructions/crypto")
def update_crypto_instructions(
    payload: CryptoInstructionsUpdate,
    admin: dict = Depends(admin_user),
):

    data = {
        "method": "crypto",
        **payload.model_dump(),
        "updated_by": admin["id"],
    }

    result = (
        admin_db.table("payment_instructions")
        .upsert(data, on_conflict="method")
        .execute()
    )

    admin_db.table("audit_logs").insert({
        "actor_id": admin["id"],
        "action": "payment_instructions_updated",
        "entity_type": "payment_instructions",
        "entity_id": "crypto",
        "details": {
            "method": "crypto",
            "enabled": payload.enabled,
        },
    }).execute()

    return {
        "item": result.data[0],
    }


@app.put("/api/admin/payment-instructions/bank")
def update_bank_instructions(
    payload: BankInstructionsUpdate,
    admin: dict = Depends(admin_user),
):

    data = {
        "method": "bank",
        **payload.model_dump(),
        "updated_by": admin["id"],
    }

    result = (
        admin_db.table("payment_instructions")
        .upsert(data, on_conflict="method")
        .execute()
    )

    admin_db.table("audit_logs").insert({
        "actor_id": admin["id"],
        "action": "payment_instructions_updated",
        "entity_type": "payment_instructions",
        "entity_id": "bank",
        "details": {
            "method": "bank",
            "enabled": payload.enabled,
        },
    }).execute()

    return {
        "item": result.data[0],
    }


# ============================================================
# ADMIN TRANSACTIONS
# ============================================================

@app.get("/api/admin/transactions")
def admin_transactions(
    _: dict = Depends(admin_user),
    limit: int = Query(200, ge=1, le=500),
):

    result = (
        admin_db.table("transactions")
        .select("*,profiles(email,full_name)")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# ADMIN AUDIT LOG
# ============================================================

@app.get("/api/admin/audit-log")
def admin_audit(
    _: dict = Depends(admin_user),
    limit: int = Query(200, ge=1, le=500),
):

    result = (
        admin_db.table("audit_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return {
        "items": result.data or [],
    }


# ============================================================
# ADMIN PLANS
# ============================================================

@app.get("/api/admin/plans")
def admin_plans(
    _: dict = Depends(admin_user),
):

    result = (
        admin_db.table("plans")
        .select("*")
        .order("minimum_amount")
        .execute()
    )

    return {
        "items": result.data or [],
    }


@app.post("/api/admin/plans")
def create_plan(
    payload: PlanCreate,
    _: dict = Depends(admin_user),
):

    result = (
        admin_db.table("plans")
        .insert(payload.model_dump(mode="json"))
        .execute()
    )

    return {
        "item": result.data[0],
    }


@app.patch("/api/admin/plans/{plan_id}")
def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    _: dict = Depends(admin_user),
):

    allowed = payload.model_dump(
        exclude_unset=True,
        mode="json",
    )

    if not allowed:
        raise HTTPException(
            422,
            "At least one plan field must be provided",
        )

    existing = (
        admin_db.table("plans")
        .select("minimum_amount,maximum_amount")
        .eq("id", plan_id)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            404,
            "Plan not found",
        )

    minimum_amount = allowed.get(
        "minimum_amount",
        existing.data["minimum_amount"],
    )

    maximum_amount = allowed.get(
        "maximum_amount",
        existing.data["maximum_amount"],
    )

    try:
        validate_plan_amount_range(
            Decimal(str(minimum_amount)),
            (
                Decimal(str(maximum_amount))
                if maximum_amount is not None
                else None
            ),
        )

    except ValueError as exc:
        raise HTTPException(
            422,
            str(exc),
        ) from exc

    result = (
        admin_db.table("plans")
        .update(allowed)
        .eq("id", plan_id)
        .execute()
    )

    return {
        "items": result.data or [],
    }
