
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import PurePosixPath
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, StringConstraints

from .security import admin_db, member_user, admin_user


router = APIRouter()

BUCKET = "member-private-files"
MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

KYC_REQUIRED_TYPES = {"identity", "address"}


# ============================================================
# REQUEST MODELS
# ============================================================

class WithdrawalAddressInput(BaseModel):
    network: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=2,
            max_length=40,
        ),
    ]

    wallet_address: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=8,
            max_length=220,
        ),
    ]

    label: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=2,
            max_length=80,
        ),
    ] = "My withdrawal wallet"

    is_default: bool = True


class InvestmentRequestInput(BaseModel):
    plan_id: str
    requested_amount: Decimal = Field(
        gt=0,
        max_digits=20,
        decimal_places=8,
    )
    member_note: str = Field(
        default="",
        max_length=1000,
    )


class InvestmentReviewInput(BaseModel):
    status: str
    admin_note: str = Field(
        default="",
        max_length=1000,
    )


class PerformanceInput(BaseModel):
    period_start: date
    period_end: date
    return_amount: Decimal = Field(
        max_digits=20,
        decimal_places=8,
    )
    note: str = Field(
        default="",
        max_length=1000,
    )


class KYCReviewInput(BaseModel):
    status: Literal["approved", "rejected"]
    note: str = Field(
        default="",
        max_length=1000,
    )


# ============================================================
# FILE STORAGE HELPERS
# ============================================================

def private_signed_url(path: str) -> str | None:
    if not path:
        return None

    try:
        result = (
            admin_db.storage
            .from_(BUCKET)
            .create_signed_url(path, 3600)
        )

        return (
            result.get("signedURL")
            or result.get("signedUrl")
        )

    except Exception:
        return None


async def read_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            415,
            "Upload a JPG, PNG, WEBP or PDF file.",
        )

    data = await file.read(MAX_FILE_SIZE + 1)

    if not data:
        raise HTTPException(
            400,
            "The selected file is empty.",
        )

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            413,
            "Files must be 10 MB or smaller.",
        )

    return data


def upload_private_file(
    user_id: str,
    folder: str,
    file_name: str,
    content_type: str,
    data: bytes,
) -> str:

    suffix = PurePosixPath(
        file_name.replace("\\", "/")
    ).suffix.lower()

    safe_suffix = (
        suffix
        if suffix in {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".pdf",
        }
        else ""
    )

    path = f"{user_id}/{folder}/{uuid4().hex}{safe_suffix}"

    try:
        admin_db.storage.from_(BUCKET).upload(
            path,
            data,
            file_options={
                "content-type": content_type,
                "upsert": "false",
            },
        )

    except Exception as exc:
        raise HTTPException(
            502,
            "File storage failed. Please try again.",
        ) from exc

    return path


def remove_private_file(path: str) -> None:
    try:
        admin_db.storage.from_(BUCKET).remove([path])
    except Exception:
        pass


def remove_kyc_metadata(document_id: str) -> None:
    try:
        admin_db.table("kyc_documents").delete().eq(
            "id",
            document_id,
        ).execute()
    except Exception:
        pass


# ============================================================
# KYC HELPERS
# ============================================================

def get_member_kyc_profile(user_id: str):
    result = (
        admin_db.table("profiles")
        .select(
            "id,kyc_status,kyc_submitted_at,"
            "kyc_reviewed_at,kyc_review_note"
        )
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            404,
            "Member profile not found.",
        )

    return result.data


def get_latest_kyc_documents(user_id: str):
    result = (
        admin_db.table("kyc_documents")
        .select(
            "id,document_type,original_filename,"
            "content_type,size_bytes,created_at,storage_path"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    latest = {}

    for row in result.data or []:
        document_type = row.get("document_type")

        if document_type not in {
            "identity",
            "address",
            "other",
        }:
            continue

        if document_type not in latest:
            latest[document_type] = dict(row)

    return latest


def is_after_review(document: dict, reviewed_at: str | None) -> bool:
    if not reviewed_at:
        return False

    created_at = document.get("created_at")

    if not created_at:
        return False

    try:
        created = datetime.fromisoformat(
            created_at.replace("Z", "+00:00")
        )

        reviewed = datetime.fromisoformat(
            reviewed_at.replace("Z", "+00:00")
        )

        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)

        if reviewed.tzinfo is None:
            reviewed = reviewed.replace(tzinfo=timezone.utc)

        return created > reviewed

    except (ValueError, AttributeError, TypeError):
        return False


def build_kyc_document_response(document: dict) -> dict:
    item = dict(document)

    storage_path = item.pop("storage_path", None)

    item["signed_url"] = (
        private_signed_url(storage_path)
        if storage_path
        else None
    )

    return item


# ============================================================
# MEMBER KYC DOCUMENT UPLOAD
# ============================================================

@router.post("/api/kyc/documents", status_code=201)
async def upload_kyc_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(member_user),
):

    if document_type not in {
        "identity",
        "address",
        "other",
    }:
        raise HTTPException(
            422,
            "Document type must be identity, address or other.",
        )

    profile = get_member_kyc_profile(user["id"])

    current_status = (
        profile.get("kyc_status")
        or "not_submitted"
    )

    if current_status == "pending_review":
        raise HTTPException(
            409,
            "Your KYC documents are already awaiting administrator review.",
        )

    if current_status == "approved":
        raise HTTPException(
            409,
            "Your KYC has already been approved. Additional uploads are not permitted.",
        )

    if current_status not in {
        "not_submitted",
        "rejected",
    }:
        raise HTTPException(
            409,
            "Your KYC status does not allow document uploads.",
        )

    data = await read_upload(file)

    path = upload_private_file(
        user["id"],
        "kyc",
        file.filename or "document",
        file.content_type or "",
        data,
    )

    saved = None

    try:
        saved = (
            admin_db.table("kyc_documents")
            .insert({
                "user_id": user["id"],
                "document_type": document_type,
                "storage_path": path,
                "original_filename": (
                    file.filename or "document"
                )[:255],
                "content_type": file.content_type,
                "size_bytes": len(data),
            })
            .execute()
        )

        if not saved.data:
            raise RuntimeError(
                "Document metadata insert returned no record."
            )

    except Exception as exc:
        remove_private_file(path)

        raise HTTPException(
            500,
            "Document metadata could not be saved.",
        ) from exc

    document_record = saved.data[0]

    try:
        latest = get_latest_kyc_documents(user["id"])

        has_both_documents = (
            KYC_REQUIRED_TYPES.issubset(latest.keys())
        )

        submitted_at = profile.get("kyc_submitted_at")
        reviewed_at = profile.get("kyc_reviewed_at")

        # A rejected member must submit fresh identity and
        # address documents after the previous review.
        if current_status == "rejected":
            fresh_documents = (
                has_both_documents
                and is_after_review(
                    latest["identity"],
                    reviewed_at,
                )
                and is_after_review(
                    latest["address"],
                    reviewed_at,
                )
            )

            if fresh_documents:
                new_status = "pending_review"
                submitted_at = datetime.now(
                    timezone.utc
                ).isoformat()
            else:
                new_status = "rejected"

        elif has_both_documents:
            new_status = "pending_review"
            submitted_at = datetime.now(
                timezone.utc
            ).isoformat()

        else:
            new_status = "not_submitted"

        update_data = {
            "kyc_status": new_status,
            "kyc_uploaded_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        if new_status == "pending_review":
            update_data.update({
                "kyc_submitted_at": submitted_at,
                "kyc_reviewed_at": None,
                "kyc_reviewed_by": None,
                "kyc_review_note": None,
            })

        profile_update = (
            admin_db.table("profiles")
            .update(update_data)
            .eq("id", user["id"])
            .eq("kyc_status", current_status)
            .execute()
        )

        if not profile_update.data:
            raise RuntimeError(
                "KYC profile status changed during upload."
            )

    except Exception as exc:
        # Roll back the newly saved document if the profile
        # status could not be updated.
        remove_kyc_metadata(document_record["id"])
        remove_private_file(path)

        if isinstance(exc, HTTPException):
            raise

        raise HTTPException(
            500,
            "The document was uploaded, but the KYC status could not be updated. Please try again.",
        ) from exc

    if new_status == "pending_review":
        message = (
            "Both required documents have been submitted. "
            "Your KYC application is now awaiting administrator review."
        )

    elif new_status == "rejected":
        message = (
            "Your replacement document has been received. "
            "Please upload a fresh identity document and proof of address "
            "after the previous review before resubmitting."
        )

    else:
        message = (
            "Your document has been uploaded. "
            "Upload both an identity document and proof of address "
            "to submit your KYC application."
        )

    return {
        "message": message,
        "kyc_status": new_status,
        "document": document_record,
    }


# ============================================================
# MEMBER KYC DOCUMENT LIST
# ============================================================

@router.get("/api/kyc/documents")
def list_kyc_documents(
    user: dict = Depends(member_user),
):

    result = (
        admin_db.table("kyc_documents")
        .select(
            "id,document_type,original_filename,"
            "content_type,size_bytes,created_at,storage_path"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    items = []

    for row in result.data or []:
        items.append(
            build_kyc_document_response(row)
        )

    return {
        "items": items,
    }


# ============================================================
# ADMIN KYC REVIEW QUEUE
# ============================================================

@router.get("/api/admin/kyc")
def admin_kyc_queue(
    status: str = Query(
        "pending_review",
        pattern="^(pending_review|approved|rejected|not_submitted|all)$",
    ),
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    admin: dict = Depends(admin_user),
):

    query = (
        admin_db.table("profiles")
        .select(
            "id,email,full_name,display_name,phone,"
            "kyc_status,kyc_submitted_at,kyc_reviewed_at,"
            "kyc_reviewed_by,kyc_review_note,created_at"
        )
        .order("kyc_submitted_at", desc=True)
        .limit(limit)
    )

    if status != "all":
        query = query.eq("kyc_status", status)

    profiles = query.execute().data or []

    items = []

    for profile in profiles:
        latest = get_latest_kyc_documents(
            profile["id"]
        )

        documents = []

        for document_type in (
            "identity",
            "address",
            "other",
        ):
            document = latest.get(document_type)

            if document:
                documents.append(
                    build_kyc_document_response(document)
                )

        items.append({
            "profile": profile,
            "documents": documents,
            "has_required_documents": (
                KYC_REQUIRED_TYPES.issubset(latest.keys())
            ),
        })

    return {
        "items": items,
    }


# ============================================================
# ADMIN KYC DECISION
# ============================================================

@router.patch("/api/admin/kyc/{user_id}")
def review_kyc(
    user_id: str,
    payload: KYCReviewInput,
    admin: dict = Depends(admin_user),
):

    note = payload.note.strip()

    if payload.status == "rejected" and not note:
        raise HTTPException(
            422,
            "A rejection reason is required.",
        )

    if user_id == admin["id"]:
        raise HTTPException(
            403,
            "Administrators cannot review their own KYC application.",
        )

    profile_result = (
        admin_db.table("profiles")
        .select(
            "id,email,full_name,kyc_status"
        )
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            404,
            "Member profile not found.",
        )

    profile = profile_result.data

    if profile["kyc_status"] != "pending_review":
        raise HTTPException(
            409,
            "This KYC application is not awaiting review.",
        )

    latest = get_latest_kyc_documents(user_id)

    if not KYC_REQUIRED_TYPES.issubset(latest.keys()):
        raise HTTPException(
            409,
            "The member must provide both identity and address documents before review.",
        )

    # Confirm email using the actual Supabase Auth record.
    # Do not rely on the profile email field for this check.
    if payload.status == "approved":

        try:
            auth_response = (
                admin_db.auth.admin.get_user_by_id(user_id)
            )

            auth_user = auth_response.user

        except Exception as exc:
            raise HTTPException(
                503,
                "Could not verify the member's email confirmation status.",
            ) from exc

        if not auth_user.email_confirmed_at:
            raise HTTPException(
                400,
                "The member must confirm their email before KYC approval.",
            )

    reviewed_at = datetime.now(
        timezone.utc
    ).isoformat()

    update_data = {
        "kyc_status": payload.status,
        "kyc_reviewed_at": reviewed_at,
        "kyc_reviewed_by": admin["id"],
        "kyc_review_note": note or None,
    }

    try:
        result = (
            admin_db.table("profiles")
            .update(update_data)
            .eq("id", user_id)
            .eq("kyc_status", "pending_review")
            .select(
                "id,email,full_name,kyc_status,"
                "kyc_submitted_at,kyc_reviewed_at,"
                "kyc_reviewed_by,kyc_review_note"
            )
            .execute()
        )

    except Exception as exc:
        raise HTTPException(
            500,
            "The KYC review decision could not be saved.",
        ) from exc

    if not result.data:
        raise HTTPException(
            409,
            "This application was already reviewed by another administrator.",
        )

    try:
        admin_db.table("audit_logs").insert({
            "actor_id": admin["id"],
            "action": (
                "kyc_approved"
                if payload.status == "approved"
                else "kyc_rejected"
            ),
            "entity_type": "profile",
            "entity_id": user_id,
            "details": {
                "status": payload.status,
                "note": note,
            },
        }).execute()

    except Exception as exc:
        # The review decision has already been saved.
        # Do not silently pretend the audit entry succeeded.
        raise HTTPException(
            500,
            "The KYC decision was saved, but its audit record could not be written. Check the audit logs before retrying.",
        ) from exc

    return {
        "message": (
            "KYC application approved."
            if payload.status == "approved"
            else "KYC application rejected. The member can submit replacement documents."
        ),
        "item": result.data[0],
    }


# ============================================================
# MEMBER PROFILE IMAGE
# ============================================================

@router.post("/api/me/profile-image", status_code=201)
async def upload_profile_image(
    file: UploadFile = File(...),
    user: dict = Depends(member_user),
):

    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(
            415,
            "Profile images must be JPG, PNG or WEBP.",
        )

    data = await read_upload(file)

    path = upload_private_file(
        user["id"],
        "profile",
        file.filename or "profile-image",
        file.content_type or "",
        data,
    )

    try:
        result = (
            admin_db.table("profiles")
            .update({
                "profile_image_path": path,
            })
            .eq("id", user["id"])
            .execute()
        )

        if not result.data:
            raise RuntimeError(
                "Profile image update returned no record."
            )

    except Exception as exc:
        remove_private_file(path)

        raise HTTPException(
            500,
            "Profile image could not be saved.",
        ) from exc

    return {
        "message": "Profile image saved.",
        "profile_image_url": private_signed_url(path),
    }


# ============================================================
# MEMBER WITHDRAWAL ADDRESSES
# ============================================================

@router.get("/api/member/withdrawal-addresses")
def get_withdrawal_addresses(
    user: dict = Depends(member_user),
):

    result = (
        admin_db.table("withdrawal_addresses")
        .select(
            "id,asset,network,wallet_address,label,"
            "is_default,created_at,updated_at"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "items": result.data or [],
    }


@router.post(
    "/api/member/withdrawal-addresses",
    status_code=201,
)
def save_withdrawal_address(
    payload: WithdrawalAddressInput,
    user: dict = Depends(member_user),
):

    if payload.is_default:
        admin_db.table("withdrawal_addresses").update({
            "is_default": False,
        }).eq(
            "user_id",
            user["id"],
        ).execute()

    result = (
        admin_db.table("withdrawal_addresses")
        .insert({
            "user_id": user["id"],
            "asset": "USDT",
            "network": payload.network,
            "wallet_address": payload.wallet_address,
            "label": payload.label,
            "is_default": payload.is_default,
        })
        .execute()
    )

    return {
        "message": "Withdrawal address saved.",
        "item": result.data[0],
    }


# ============================================================
# MEMBER INVESTMENT REQUESTS
# ============================================================

@router.get("/api/member/investment-requests")
def member_investment_requests(
    user: dict = Depends(member_user),
):

    result = (
        admin_db.table("investment_requests")
        .select(
            "id,plan_id,requested_amount,asset,status,"
            "member_note,admin_note,created_at,reviewed_at,"
            "plans(name,description)"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "items": result.data or [],
    }


@router.post(
    "/api/member/investment-requests",
    status_code=201,
)
def create_investment_request(
    payload: InvestmentRequestInput,
    user: dict = Depends(member_user),
):

    plan_result = (
        admin_db.table("plans")
        .select(
            "id,name,minimum_amount,maximum_amount,active"
        )
        .eq("id", payload.plan_id)
        .maybe_single()
        .execute()
    )

    plan = plan_result.data

    if not plan or not plan["active"]:
        raise HTTPException(
            404,
            "That investment plan is unavailable.",
        )

    amount = Decimal(
        str(payload.requested_amount)
    )

    minimum = Decimal(
        str(plan["minimum_amount"])
    )

    maximum = (
        Decimal(str(plan["maximum_amount"]))
        if plan.get("maximum_amount") is not None
        else None
    )

    if amount < minimum or (
        maximum is not None and amount > maximum
    ):
        raise HTTPException(
            422,
            (
                f"Amount must be between {minimum} and "
                f"{maximum if maximum is not None else 'no maximum'}."
            ),
        )

    result = (
        admin_db.table("investment_requests")
        .insert({
            "user_id": user["id"],
            "plan_id": payload.plan_id,
            "requested_amount": str(amount),
            "asset": "USDT",
            "status": "pending",
            "member_note": payload.member_note.strip(),
        })
        .execute()
    )

    return {
        "message": (
            "Plan request submitted for administrator review. "
            "It is not an active contract yet."
        ),
        "item": result.data[0],
    }


# ============================================================
# MEMBER INVESTMENT CONTRACTS
# ============================================================

@router.get("/api/member/contracts")
def member_contracts(
    user: dict = Depends(member_user),
):

    contracts = (
        admin_db.table("investment_contracts")
        .select(
            "id,request_id,plan_id,principal,asset,status,"
            "started_at,ends_at,created_at,plans(name,description)"
        )
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    items = []

    for contract in contracts.data or []:

        rows = (
            admin_db.table("investment_performance")
            .select(
                "id,period_start,period_end,"
                "return_amount,note,created_at"
            )
            .eq("contract_id", contract["id"])
            .order("period_end")
            .execute()
        )

        performance = rows.data or []

        total_return = sum(
            (
                Decimal(str(item["return_amount"]))
                for item in performance
            ),
            Decimal("0"),
        )

        item = dict(contract)

        item["performance"] = performance
        item["total_return"] = str(total_return)
        item["current_value"] = str(
            Decimal(str(contract["principal"]))
            + total_return
        )

        items.append(item)

    return {
        "items": items,
    }


# ============================================================
# ADMIN INVESTMENT REQUESTS
# ============================================================

@router.get("/api/admin/investment-requests")
def admin_investment_requests(
    status: str | None = None,
    admin: dict = Depends(admin_user),
):

    query = (
        admin_db.table("investment_requests")
        .select(
            "*,profiles(email,full_name,display_name),"
            "plans(name,minimum_amount,maximum_amount)"
        )
        .order("created_at", desc=True)
    )

    if status in {
        "pending",
        "approved",
        "rejected",
    }:
        query = query.eq("status", status)

    return {
        "items": query.execute().data or [],
    }


@router.patch(
    "/api/admin/investment-requests/{request_id}"
)
def review_investment_request(
    request_id: str,
    payload: InvestmentReviewInput,
    admin: dict = Depends(admin_user),
):

    if payload.status not in {
        "approved",
        "rejected",
    }:
        raise HTTPException(
            422,
            "Status must be approved or rejected.",
        )

    admin_note = payload.admin_note.strip()

    if len(admin_note) > 1000:
        raise HTTPException(
            422,
            "Admin note cannot exceed 1000 characters.",
        )

    try:
        result = admin_db.rpc(
            "review_investment_request_atomic",
            {
                "p_request_id": request_id,
                "p_admin_id": admin["id"],
                "p_status": payload.status,
                "p_admin_note": admin_note,
            },
        ).execute()

        if not isinstance(result.data, dict):
            raise HTTPException(
                500,
                "The investment review returned an unexpected response.",
            )

        return result.data

    except HTTPException:
        raise

    except Exception as exc:
        message = str(exc)

        if "Investment request not found" in message:
            raise HTTPException(
                404,
                "Investment request not found.",
            )

        if any(text in message for text in (
            "already been reviewed",
            "another administrator",
        )):
            raise HTTPException(
                409,
                "This request has already been reviewed.",
            )

        if any(text in message for text in (
            "plan is no longer active",
            "below the plan minimum",
            "exceeds the plan maximum",
        )):
            raise HTTPException(
                409,
                "The plan is no longer eligible for approval. Refresh and review the request.",
            )

        if "Administrator permission required" in message:
            raise HTTPException(
                403,
                "Administrator permission required.",
            )

        raise HTTPException(
            500,
            "Could not review the investment request. Check the server logs.",
        )


# ============================================================
# ADMIN CONTRACT PERFORMANCE
# ============================================================

@router.post(
    "/api/admin/contracts/{contract_id}/performance",
    status_code=201,
)
def record_contract_performance(
    contract_id: str,
    payload: PerformanceInput,
    admin: dict = Depends(admin_user),
):

    if payload.period_end < payload.period_start:
        raise HTTPException(
            422,
            "Period end must be on or after period start.",
        )

    contract_result = (
        admin_db.table("investment_contracts")
        .select(
            "id,user_id,principal,status,asset"
        )
        .eq("id", contract_id)
        .maybe_single()
        .execute()
    )

    contract = contract_result.data

    if not contract:
        raise HTTPException(
            404,
            "Contract not found.",
        )

    if contract["status"] != "active":
        raise HTTPException(
            409,
            "Performance can only be recorded for active contracts.",
        )

    result = (
        admin_db.table("investment_performance")
        .insert({
            "contract_id": contract_id,
            "recorded_by": admin["id"],
            "period_start": payload.period_start.isoformat(),
            "period_end": payload.period_end.isoformat(),
            "return_amount": str(payload.return_amount),
            "note": payload.note.strip(),
        })
        .execute()
    )

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

    return {
        "message": "Performance record saved.",
        "item": result.data[0],
    }
