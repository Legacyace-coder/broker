import logging
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from supabase import Client
from decimal import Decimal
from .member_features import router as member_features_router
from .config import settings
from .security import admin_db, current_user, admin_user
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
origins = [x.strip() for x in settings.cors_origins.split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "northstar-capital-api"}

@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    result = admin_db.table("profiles").select("id,email,full_name,phone,role,created_at").eq("id", user["id"]).maybe_single().execute()
    wallet = admin_db.table("wallets").select("balance,asset,updated_at").eq("user_id", user["id"]).maybe_single().execute()
    return {"profile": result.data or {"id": user["id"], "email": user.get("email")}, "wallet": wallet.data or {"balance": 0, "asset": "USDT"}}

@app.patch("/api/me")
def update_me(payload: dict, user: dict = Depends(current_user)):
    allowed = {k: payload[k] for k in ("full_name", "phone") if k in payload}
    if "full_name" in allowed and (not isinstance(allowed["full_name"], str) or len(allowed["full_name"].strip()) > 120):
        raise HTTPException(422, "Invalid full name")
    if "phone" in allowed and (not isinstance(allowed["phone"], str) or len(allowed["phone"]) > 40):
        raise HTTPException(422, "Invalid phone")
    result = admin_db.table("profiles").update(allowed).eq("id", user["id"]).select("id,email,full_name,phone,role,created_at").execute()
    return {"profile": result.data[0] if result.data else None}

@app.get("/api/plans")
def plans():
    result = admin_db.table("plans").select("id,name,description,minimum_amount,maximum_amount,active,created_at").eq("active", True).order("minimum_amount").execute()
    return {"items": result.data or []}

@app.get("/api/dashboard")
def dashboard(user: dict = Depends(current_user)):
    wallet = admin_db.table("wallets").select("balance,asset,updated_at").eq("user_id", user["id"]).maybe_single().execute()
    deposits = admin_db.table("deposits").select("id,amount,asset,status,created_at").eq("user_id", user["id"]).order("created_at", desc=True).limit(5).execute()
    withdrawals = admin_db.table("withdrawals").select("id,amount,asset,status,created_at").eq("user_id", user["id"]).order("created_at", desc=True).limit(5).execute()
    txs = admin_db.table("transactions").select("id,kind,amount,asset,status,created_at").eq("user_id", user["id"]).order("created_at", desc=True).limit(8).execute()
    return {"wallet": wallet.data or {"balance": 0, "asset": "USDT"}, "deposits": deposits.data or [], "withdrawals": withdrawals.data or [], "transactions": txs.data or []}

@app.get("/api/payment-instructions")
def payment_instructions(_: dict = Depends(current_user)):
    fields = "method,network,wallet_address,instructions,bank_name,account_name,account_number,iban,swift_bic,currency"
    result = admin_db.table("payment_instructions").select(fields).eq("enabled", True).order("method").execute()
    return {"items": result.data or []}

@app.post("/api/deposits", status_code=201)
def create_deposit(payload: DepositRequest, user: dict = Depends(current_user)):
    if payload.asset.upper() != "USDT":
        raise HTTPException(422, "Only USDT deposits are supported")
    configured = admin_db.table("payment_instructions").select("method,network,currency").eq("method", payload.payment_method).eq("enabled", True).maybe_single().execute()
    if not configured.data:
        raise HTTPException(409, "This deposit method is not currently available")
    if payload.payment_method == "crypto":
        payment_amount = Decimal(str(payload.amount))
        payment_currency = "USDT"
        network = configured.data["network"]
    else:
        payment_amount = payload.payment_amount
        payment_currency = payload.payment_currency.upper()
        if payment_currency != configured.data["currency"]:
            raise HTTPException(422, "Payment currency does not match the configured bank account")
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
    result = admin_db.table("deposits").insert(data).execute()
    return {"message": "Deposit request recorded. No funds are credited until an administrator verifies the payment.", "item": result.data[0]}

@app.get("/api/deposits")
def list_deposits(user: dict = Depends(current_user)):
    result = admin_db.table("deposits").select("id,amount,asset,network,payment_method,payment_amount,payment_currency,credited_amount,reference,status,review_note,created_at,reviewed_at").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return {"items": result.data or []}

@app.post("/api/withdrawals", status_code=201)
def create_withdrawal(payload: WithdrawalRequest, user: dict = Depends(current_user)):
    if payload.asset.upper() != "USDT":
        raise HTTPException(422, "Only USDT withdrawals are supported")
    try:
        result = admin_db.rpc("request_withdrawal", {"p_user_id": user["id"], "p_amount": payload.amount, "p_asset": payload.asset.upper(), "p_network": payload.network, "p_wallet_address": payload.wallet_address}).execute()
        return {"message": "Withdrawal request submitted for review. No transfer has occurred yet.", "item": result.data}
    except Exception as exc:
        message = str(exc)
        if "Insufficient balance" in message:
            raise HTTPException(400, "Insufficient available balance")
        raise HTTPException(400, "Could not submit withdrawal request. Check your balance and details.")

@app.get("/api/withdrawals")
def list_withdrawals(user: dict = Depends(current_user)):
    result = admin_db.table("withdrawals").select("id,amount,asset,network,wallet_address,status,review_note,created_at,reviewed_at").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return {"items": result.data or []}

@app.get("/api/transactions")
def transactions(user: dict = Depends(current_user)):
    result = admin_db.table("transactions").select("id,kind,amount,asset,status,reference,created_at").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return {"items": result.data or []}

@app.get("/api/admin/overview")
def admin_overview(_: dict = Depends(admin_user)):
    users = admin_db.table("profiles").select("id", count="exact").execute()
    deposits = admin_db.table("deposits").select("id", count="exact").eq("status", "pending").execute()
    withdrawals = admin_db.table("withdrawals").select("id", count="exact").eq("status", "pending").execute()
    approved_withdrawals = admin_db.table("withdrawals").select("id", count="exact").eq("status", "approved").execute()
    return {"users": users.count or 0, "pending_deposits": deposits.count or 0, "pending_withdrawals": withdrawals.count or 0, "approved_withdrawals": approved_withdrawals.count or 0}

@app.get("/api/admin/users")
def admin_users(_: dict = Depends(admin_user), limit: int = Query(100, ge=1, le=500)):
    result = admin_db.table("profiles").select("id,email,full_name,phone,role,created_at,wallets(balance,asset)").order("created_at", desc=True).limit(limit).execute()
    return {"items": result.data or []}

@app.put("/api/admin/users/{user_id}/balance")
def set_user_balance(user_id: str, payload: BalanceSetRequest, admin: dict = Depends(admin_user)):
    try:
        result = admin_db.rpc("admin_set_user_balance", {
            "p_user_id": user_id,
            "p_target_balance": str(payload.balance),
            "p_admin_id": admin["id"],
            "p_reason": payload.reason,
        }).execute()
        return {"message": "User balance updated and recorded in the ledger", "item": result.data}
    except APIError as exc:
        logger.exception("Admin balance update failed for user %s", user_id)
        raise HTTPException(400, "Balance could not be updated; verify the user and USDT wallet, then try again") from exc

@app.get("/api/admin/deposits")
def admin_deposits(_: dict = Depends(admin_user), status: str | None = None, limit: int = Query(100, ge=1, le=500)):
    q = admin_db.table("deposits").select("*,profiles(email,full_name)").order("created_at", desc=True).limit(limit)
    if status: q = q.eq("status", status)
    return {"items": q.execute().data or []}

@app.patch("/api/admin/deposits/{deposit_id}")
def review_deposit(deposit_id: str, payload: DepositReviewRequest, admin: dict = Depends(admin_user)):
    deposit_result = admin_db.table("deposits").select("payment_method,amount,status").eq("id", deposit_id).maybe_single().execute()
    if not deposit_result.data:
        raise HTTPException(404, "Deposit request not found")
    deposit = deposit_result.data
    if deposit["status"] != "pending":
        raise HTTPException(409, "Deposit request has already been reviewed")
    if payload.status == "approved" and deposit["payment_method"] == "bank" and payload.credited_amount is None:
        raise HTTPException(422, "Enter the verified USDT credit amount for a bank transfer")
    if payload.status == "approved" and deposit["payment_method"] == "crypto" and payload.credited_amount is not None and payload.credited_amount != Decimal(str(deposit["amount"])):
        raise HTTPException(422, "Crypto deposits are credited at the requested USDT amount")
    if payload.status == "rejected" and payload.credited_amount is not None:
        raise HTTPException(422, "Rejected deposits cannot have a credited amount")
    try:
        result = admin_db.rpc("review_deposit", {
            "p_deposit_id": deposit_id,
            "p_status": payload.status,
            "p_admin_id": admin["id"],
            "p_note": payload.note,
            "p_credited_amount": str(payload.credited_amount) if payload.credited_amount is not None else None,
        }).execute()
        return {"message": "Deposit review saved", "item": result.data}
    except Exception:
        raise HTTPException(400, "Deposit could not be reviewed; it may already have been processed")

@app.get("/api/admin/withdrawals")
def admin_withdrawals(_: dict = Depends(admin_user), status: str | None = None, limit: int = Query(100, ge=1, le=500)):
    q = admin_db.table("withdrawals").select("*,profiles(email,full_name)").order("created_at", desc=True).limit(limit)
    if status: q = q.eq("status", status)
    return {"items": q.execute().data or []}

@app.patch("/api/admin/withdrawals/{withdrawal_id}")
def review_withdrawal(withdrawal_id: str, payload: ReviewRequest, admin: dict = Depends(admin_user)):
    if payload.status not in {"approved", "rejected", "completed"}: raise HTTPException(422, "Status must be approved, rejected or completed")
    if payload.status == "completed" and not (payload.note and payload.note.strip()):
        raise HTTPException(422, "A transfer reference is required to mark a withdrawal complete")
    try:
        result = admin_db.rpc("review_withdrawal", {"p_withdrawal_id": withdrawal_id, "p_status": payload.status, "p_admin_id": admin["id"], "p_note": payload.note}).execute()
        message = "Withdrawal marked complete. Confirm the transfer was sent before using this action." if payload.status == "completed" else "Withdrawal review saved. Approval records a review decision only; it does not send funds."
        return {"message": message, "item": result.data}
    except Exception:
        raise HTTPException(400, "Withdrawal could not be reviewed; it may already have been processed")

@app.get("/api/admin/payment-instructions")
def admin_payment_instructions(_: dict = Depends(admin_user)):
    result = admin_db.table("payment_instructions").select("*").order("method").execute()
    items = {item["method"]: item for item in result.data or []}
    return {"items": [
        items.get("crypto", {"method": "crypto", "enabled": False, "network": "", "wallet_address": "", "instructions": ""}),
        items.get("bank", {"method": "bank", "enabled": False, "bank_name": "", "account_name": "", "account_number": "", "iban": "", "swift_bic": "", "currency": "", "instructions": ""}),
    ]}

@app.put("/api/admin/payment-instructions/crypto")
def update_crypto_instructions(payload: CryptoInstructionsUpdate, admin: dict = Depends(admin_user)):
    data = {"method": "crypto", **payload.model_dump(), "updated_by": admin["id"]}
    result = admin_db.table("payment_instructions").upsert(data, on_conflict="method").execute()
    admin_db.table("audit_logs").insert({"actor_id": admin["id"], "action": "payment_instructions_updated", "entity_type": "payment_instructions", "entity_id": "crypto", "details": {"method": "crypto", "enabled": payload.enabled}}).execute()
    return {"item": result.data[0]}

@app.put("/api/admin/payment-instructions/bank")
def update_bank_instructions(payload: BankInstructionsUpdate, admin: dict = Depends(admin_user)):
    data = {"method": "bank", **payload.model_dump(), "updated_by": admin["id"]}
    result = admin_db.table("payment_instructions").upsert(data, on_conflict="method").execute()
    admin_db.table("audit_logs").insert({"actor_id": admin["id"], "action": "payment_instructions_updated", "entity_type": "payment_instructions", "entity_id": "bank", "details": {"method": "bank", "enabled": payload.enabled}}).execute()
    return {"item": result.data[0]}

@app.get("/api/admin/transactions")
def admin_transactions(_: dict = Depends(admin_user), limit: int = Query(200, ge=1, le=500)):
    result = admin_db.table("transactions").select("*,profiles(email,full_name)").order("created_at", desc=True).limit(limit).execute()
    return {"items": result.data or []}

@app.get("/api/admin/audit-log")
def admin_audit(_: dict = Depends(admin_user), limit: int = Query(200, ge=1, le=500)):
    result = admin_db.table("audit_logs").select("*").order("created_at", desc=True).limit(limit).execute()
    return {"items": result.data or []}

@app.get("/api/admin/plans")
def admin_plans(_: dict = Depends(admin_user)):
    result = admin_db.table("plans").select("*").order("minimum_amount").execute()
    return {"items": result.data or []}

@app.post("/api/admin/plans")
def create_plan(payload: PlanCreate, _: dict = Depends(admin_user)):
    result = admin_db.table("plans").insert(payload.model_dump(mode="json")).execute()
    return {"item": result.data[0]}

@app.patch("/api/admin/plans/{plan_id}")
def update_plan(plan_id: str, payload: PlanUpdate, _: dict = Depends(admin_user)):
    allowed = payload.model_dump(exclude_unset=True, mode="json")
    if not allowed:
        raise HTTPException(422, "At least one plan field must be provided")
    existing = admin_db.table("plans").select("minimum_amount,maximum_amount").eq("id", plan_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(404, "Plan not found")
    minimum_amount = allowed.get("minimum_amount", existing.data["minimum_amount"])
    maximum_amount = allowed.get("maximum_amount", existing.data["maximum_amount"])
    try:
        validate_plan_amount_range(Decimal(str(minimum_amount)), Decimal(str(maximum_amount)) if maximum_amount is not None else None)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    result = admin_db.table("plans").update(allowed).eq("id", plan_id).execute()
    return {"items": result.data or []}
