
from datetime import date
from decimal import Decimal
from pathlib import PurePosixPath
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated

from .security import admin_db, current_user, admin_user

router = APIRouter()
BUCKET = "member-private-files"
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "application/pdf"
}


class WithdrawalAddressInput(BaseModel):
    network: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=40)]
    wallet_address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=220)]
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)] = "My withdrawal wallet"
    is_default: bool = True


class InvestmentRequestInput(BaseModel):
    plan_id: str
    requested_amount: Decimal = Field(gt=0, max_digits=20, decimal_places=8)
    member_note: str = Field(default="", max_length=1000)


class InvestmentReviewInput(BaseModel):
    status: str
    admin_note: str = Field(default="", max_length=1000)


class PerformanceInput(BaseModel):
    period_start: date
    period_end: date
    return_amount: Decimal = Field(max_digits=20, decimal_places=8)
    note: str = Field(default="", max_length=1000)


def private_signed_url(path: str) -> str | None:
    try:
        result = admin_db.storage.from_(BUCKET).create_signed_url(path, 3600)
        return result.get("signedURL") or result.get("signedUrl")
    except Exception:
        return None


async def read_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Upload a JPG, PNG, WEBP or PDF file.")
    data = await file.read(MAX_FILE_SIZE + 1)
    if not data:
        raise HTTPException(400, "The selected file is empty.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, "Files must be 10 MB or smaller.")
    return data


def upload_private_file(user_id: str, folder: str, file_name: str, content_type: str, data: bytes) -> str:
    suffix = PurePosixPath(file_name.replace("\\", "/")).suffix.lower()
    safe_suffix = suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".pdf"} else ""
    path = f"{user_id}/{folder}/{uuid4().hex}{safe_suffix}"
    try:
        admin_db.storage.from_(BUCKET).upload(
            path,
            data,
            file_options={"content-type": content_type, "upsert": "false"},
        )
    except Exception as exc:
        raise HTTPException(502, "File storage failed. Please try again.") from exc
    return path


@router.post("/api/kyc/documents", status_code=201)
async def upload_kyc_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    if document_type not in {"identity", "address", "other"}:
        raise HTTPException(422, "Document type must be identity, address or other.")

    data = await read_upload(file)
    path = upload_private_file(
        user["id"], "kyc", file.filename or "document",
        file.content_type or "", data
    )

    try:
        saved = admin_db.table("kyc_documents").insert({
            "user_id": user["id"],
            "document_type": document_type,
            "storage_path": path,
            "original_filename": (file.filename or "document")[:255],
            "content_type": file.content_type,
            "size_bytes": len(data),
        }).execute()
    except Exception as exc:
        # Avoid leaving an unreferenced uploaded object behind.
        try:
            admin_db.storage.from_(BUCKET).remove([path])
        except Exception:
            pass
        raise HTTPException(500, "Document metadata could not be saved.") from exc

    docs = admin_db.table("kyc_documents").select(
        "document_type"
    ).eq("user_id", user["id"]).execute()
    types = {row["document_type"] for row in (docs.data or [])}

    # The requested workflow: mark verified immediately after both required
    # document categories have uploaded and their metadata has been stored.
    # This is upload-completion status, not document authenticity checking.
    verified = {"identity", "address"}.issubset(types)
    profile_update = {
        "kyc_status": "verified" if verified else "not_submitted",
    }
    if verified:
        profile_update["kyc_uploaded_at"] = "now()"

    # Set timestamp using the database's server-side timestamp.
    if verified:
        admin_db.table("profiles").update({
            "kyc_status": "verified"
        }).eq("id", user["id"]).execute()
        admin_db.rpc("set_kyc_uploaded_at", {
            "p_user_id": user["id"]
        }).execute()
    else:
        admin_db.table("profiles").update({
            "kyc_status": "not_submitted"
        }).eq("id", user["id"]).execute()

    return {
        "message": (
            "KYC files uploaded and stored. Your account is now marked verified."
            if verified else
            "File uploaded and stored. Upload both identity and address documents to complete KYC."
        ),
        "kyc_status": "verified" if verified else "not_submitted",
        "document": saved.data[0] if saved.data else None,
    }


@router.get("/api/kyc/documents")
def list_kyc_documents(user: dict = Depends(current_user)):
    result = admin_db.table("kyc_documents").select(
        "id,document_type,original_filename,content_type,size_bytes,created_at,storage_path"
    ).eq("user_id", user["id"]).order("created_at", desc=True).execute()
    items = []
    for row in result.data or []:
        row = dict(row)
        row["signed_url"] = private_signed_url(row.pop("storage_path"))
        items.append(row)
    return {"items": items}


@router.post("/api/me/profile-image", status_code=201)
async def upload_profile_image(
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Profile images must be JPG, PNG or WEBP.")
    data = await read_upload(file)
    path = upload_private_file(
        user["id"], "profile", file.filename or "profile-image",
        file.content_type or "", data
    )
    try:
        admin_db.table("profiles").update({
            "profile_image_path": path
        }).eq("id", user["id"]).execute()
    except Exception as exc:
        try:
            admin_db.storage.from_(BUCKET).remove([path])
        except Exception:
            pass
        raise HTTPException(500, "Profile image could not be saved.") from exc
    return {
        "message": "Profile image saved.",
        "profile_image_url": private_signed_url(path),
    }


@router.get("/api/member/withdrawal-addresses")
def get_withdrawal_addresses(user: dict = Depends(current_user)):
    result = admin_db.table("withdrawal_addresses").select(
        "id,asset,network,wallet_address,label,is_default,created_at,updated_at"
    ).eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return {"items": result.data or []}


@router.post("/api/member/withdrawal-addresses", status_code=201)
def save_withdrawal_address(
    payload: WithdrawalAddressInput,
    user: dict = Depends(current_user),
):
    if payload.is_default:
        admin_db.table("withdrawal_addresses").update({
            "is_default": False
        }).eq("user_id", user["id"]).execute()

    result = admin_db.table("withdrawal_addresses").insert({
        "user_id": user["id"],
        "asset": "USDT",
        "network": payload.network,
        "wallet_address": payload.wallet_address,
        "label": payload.label,
        "is_default": payload.is_default,
    }).execute()
    return {"message": "Withdrawal address saved.", "item": result.data[0]}


@router.get("/api/member/investment-requests")
def member_investment_requests(user: dict = Depends(current_user)):
    result = admin_db.table("investment_requests").select(
        "id,plan_id,requested_amount,asset,status,member_note,admin_note,created_at,reviewed_at,plans(name,description)"
    ).eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return {"items": result.data or []}


@router.post("/api/member/investment-requests", status_code=201)
def create_investment_request(
    payload: InvestmentRequestInput,
    user: dict = Depends(current_user),
):
    plan_result = admin_db.table("plans").select(
        "id,name,minimum_amount,maximum_amount,active"
    ).eq("id", payload.plan_id).maybe_single().execute()
    plan = plan_result.data
    if not plan or not plan["active"]:
        raise HTTPException(404, "That investment plan is unavailable.")

    amount = Decimal(str(payload.requested_amount))
    minimum = Decimal(str(plan["minimum_amount"]))
    maximum = Decimal(str(plan["maximum_amount"])) if plan.get("maximum_amount") is not None else None
    if amount < minimum or (maximum is not None and amount > maximum):
        raise HTTPException(
            422,
            f"Amount must be between {minimum} and {maximum if maximum is not None else 'no maximum'}.",
        )

    result = admin_db.table("investment_requests").insert({
        "user_id": user["id"],
        "plan_id": payload.plan_id,
        "requested_amount": str(amount),
        "asset": "USDT",
        "status": "pending",
        "member_note": payload.member_note.strip(),
    }).execute()
    return {
        "message": "Plan request submitted for administrator review. It is not an active contract yet.",
        "item": result.data[0],
    }


@router.get("/api/member/contracts")
def member_contracts(user: dict = Depends(current_user)):
    contracts = admin_db.table("investment_contracts").select(
        "id,request_id,plan_id,principal,asset,status,started_at,ends_at,created_at,plans(name,description)"
    ).eq("user_id", user["id"]).order("created_at", desc=True).execute()

    items = []
    for contract in contracts.data or []:
        rows = admin_db.table("investment_performance").select(
            "id,period_start,period_end,return_amount,note,created_at"
        ).eq("contract_id", contract["id"]).order("period_end").execute()
        performance = rows.data or []
        total_return = sum(
            (Decimal(str(item["return_amount"])) for item in performance),
            Decimal("0"),
        )
        item = dict(contract)
        item["performance"] = performance
        item["total_return"] = str(total_return)
        item["current_value"] = str(Decimal(str(contract["principal"])) + total_return)
        items.append(item)
    return {"items": items}


@router.get("/api/admin/investment-requests")
def admin_investment_requests(
    status: str | None = None,
    admin: dict = Depends(admin_user),
):
    query = admin_db.table("investment_requests").select(
        "*,profiles(email,full_name,display_name),plans(name,minimum_amount,maximum_amount)"
    ).order("created_at", desc=True)
    if status in {"pending", "approved", "rejected"}:
        query = query.eq("status", status)
    return {"items": query.execute().data or []}


@router.patch("/api/admin/investment-requests/{request_id}")
def review_investment_request(
    request_id: str,
    payload: InvestmentReviewInput,
    admin: dict = Depends(admin_user),
):
    if payload.status not in {"approved", "rejected"}:
        raise HTTPException(422, "Status must be approved or rejected.")

    request_result = admin_db.table("investment_requests").select(
        "id,user_id,plan_id,requested_amount,asset,status"
    ).eq("id", request_id).maybe_single().execute()
    req = request_result.data
    if not req:
        raise HTTPException(404, "Investment request not found.")
    if req["status"] != "pending":
        raise HTTPException(409, "This request has already been reviewed.")

    # Re-check the plan and amount at approval time.
    plan_result = admin_db.table("plans").select(
        "id,name,active,contract_duration_days,minimum_amount,maximum_amount"
    ).eq("id", req["plan_id"]).maybe_single().execute()
    plan = plan_result.data
    if payload.status == "approved":
        if not plan or not plan["active"]:
            raise HTTPException(409, "This plan is no longer active.")
        amount = Decimal(str(req["requested_amount"]))
        if amount < Decimal(str(plan["minimum_amount"])):
            raise HTTPException(409, "Requested amount is now below the plan minimum.")
        maximum = plan.get("maximum_amount")
        if maximum is not None and amount > Decimal(str(maximum)):
            raise HTTPException(409, "Requested amount is now above the plan maximum.")

    updated = admin_db.table("investment_requests").update({
        "status": payload.status,
        "admin_note": payload.admin_note.strip(),
        "reviewed_by": admin["id"],
        "reviewed_at": "now()",
    }).eq("id", request_id).eq("status", "pending").execute()

    if not updated.data:
        raise HTTPException(409, "Request was reviewed by another administrator.")

    contract = None
    if payload.status == "approved":
        duration = plan.get("contract_duration_days")
        ends_at = None
        if duration:
            from datetime import datetime, timedelta, timezone
            ends_at = (datetime.now(timezone.utc) + timedelta(days=int(duration))).isoformat()

        contract_result = admin_db.table("investment_contracts").insert({
            "request_id": req["id"],
            "user_id": req["user_id"],
            "plan_id": req["plan_id"],
            "principal": req["requested_amount"],
            "asset": req["asset"],
            "status": "active",
            "ends_at": ends_at,
        }).execute()
        contract = contract_result.data[0] if contract_result.data else None

    admin_db.table("audit_logs").insert({
        "actor_id": admin["id"],
        "action": f"investment_request_{payload.status}",
        "entity_type": "investment_request",
        "entity_id": request_id,
        "details": {
            "user_id": req["user_id"],
            "plan_id": req["plan_id"],
            "requested_amount": str(req["requested_amount"]),
            "admin_note": payload.admin_note.strip(),
        },
    }).execute()

    return {
        "message": (
            "Request approved and contract activated."
            if payload.status == "approved"
            else "Investment request rejected."
        ),
        "request": updated.data[0],
        "contract": contract,
    }


@router.post("/api/admin/contracts/{contract_id}/performance", status_code=201)
def record_contract_performance(
    contract_id: str,
    payload: PerformanceInput,
    admin: dict = Depends(admin_user),
):
    if payload.period_end < payload.period_start:
        raise HTTPException(422, "Period end must be on or after period start.")

    contract_result = admin_db.table("investment_contracts").select(
        "id,user_id,principal,status,asset"
    ).eq("id", contract_id).maybe_single().execute()
    contract = contract_result.data
    if not contract:
        raise HTTPException(404, "Contract not found.")
    if contract["status"] != "active":
        raise HTTPException(409, "Performance can only be recorded for active contracts.")

    result = admin_db.table("investment_performance").insert({
        "contract_id": contract_id,
        "recorded_by": admin["id"],
        "period_start": payload.period_start.isoformat(),
        "period_end": payload.period_end.isoformat(),
        "return_amount": str(payload.return_amount),
        "note": payload.note.strip(),
    }).execute()

    admin_db.table("audit_logs").insert({
        "actor_id": admin["id"],
        "action": "investment_performance_recorded",
        "entity_type": "investment_contract",
        "entity_id": contract_id,
        "details": {
            "period_start": payload.period_start.isoformat(),
            "period_end": payload.period_end.isoformat(),
            "return_amount": str(payload.return_amount),
        },
    }).execute()

    return {"message": "Performance record saved.", "item": result.data[0]}
