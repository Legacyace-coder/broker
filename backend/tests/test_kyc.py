
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException, UploadFile
from io import BytesIO

from app import member_features as kyc


# ============================================================
# DOCUMENT FRESHNESS
# ============================================================

def test_document_uploaded_after_review_is_fresh():
    document = {
        "created_at": "2026-10-30T12:00:00+00:00"
    }
    reviewed_at = "2026-10-29T12:00:00+00:00"

    assert kyc.is_after_review(document, reviewed_at) is True


def test_document_uploaded_before_review_is_not_fresh():
    document = {
        "created_at": "2026-10-28T12:00:00+00:00"
    }
    reviewed_at = "2026-10-29T12:00:00+00:00"

    assert kyc.is_after_review(document, reviewed_at) is False


def test_document_uploaded_at_review_time_is_not_fresh():
    timestamp = "2026-10-29T12:00:00+00:00"

    document = {"created_at": timestamp}

    assert kyc.is_after_review(document, timestamp) is False


def test_document_without_review_timestamp_is_not_fresh():
    document = {
        "created_at": "2026-10-30T12:00:00+00:00"
    }

    assert kyc.is_after_review(document, None) is False


def test_document_without_creation_timestamp_is_not_fresh():
    assert kyc.is_after_review({}, "2026-10-29T12:00:00+00:00") is False


def test_document_with_invalid_timestamp_is_not_fresh():
    document = {"created_at": "not-a-date"}

    assert kyc.is_after_review(
        document,
        "2026-10-29T12:00:00+00:00",
    ) is False


def test_naive_timestamps_are_handled_as_utc():
    document = {
        "created_at": "2026-10-30T12:00:00"
    }
    reviewed_at = "2026-10-29T12:00:00"

    assert kyc.is_after_review(document, reviewed_at) is True


# ============================================================
# FILE RESPONSE SECURITY
# ============================================================

def test_document_response_hides_storage_path(monkeypatch):
    monkeypatch.setattr(
        kyc,
        "private_signed_url",
        lambda path: "https://example.test/signed-document",
    )

    document = {
        "id": "document-123",
        "document_type": "identity",
        "storage_path": "member-123/kyc/private.pdf",
        "original_filename": "identity.pdf",
    }

    result = kyc.build_kyc_document_response(document)

    assert "storage_path" not in result
    assert result["signed_url"] == "https://example.test/signed-document"
    assert result["id"] == "document-123"


def test_document_response_without_storage_path_has_no_signed_url():
    document = {
        "id": "document-123",
        "document_type": "identity",
    }

    result = kyc.build_kyc_document_response(document)

    assert "storage_path" not in result
    assert result["signed_url"] is None


# ============================================================
# UPLOAD VALIDATION
# ============================================================

@pytest.mark.asyncio
async def test_read_upload_rejects_unsupported_content_type():
    file = UploadFile(
        filename="document.exe",
        file=BytesIO(b"malicious"),
        headers={"content-type": "application/octet-stream"},
    )

    with pytest.raises(HTTPException) as exc:
        await kyc.read_upload(file)

    assert exc.value.status_code == 415


@pytest.mark.asyncio
async def test_read_upload_rejects_empty_file():
    file = UploadFile(
        filename="empty.pdf",
        file=BytesIO(b""),
        headers={"content-type": "application/pdf"},
    )

    with pytest.raises(HTTPException) as exc:
        await kyc.read_upload(file)

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_read_upload_accepts_valid_pdf():
    content = b"%PDF-1.4 test document"

    file = UploadFile(
        filename="identity.pdf",
        file=BytesIO(content),
        headers={"content-type": "application/pdf"},
    )

    result = await kyc.read_upload(file)

    assert result == content


@pytest.mark.asyncio
async def test_read_upload_rejects_file_over_10mb():
    content = b"x" * (kyc.MAX_FILE_SIZE + 1)

    file = UploadFile(
        filename="large.pdf",
        file=BytesIO(content),
        headers={"content-type": "application/pdf"},
    )

    with pytest.raises(HTTPException) as exc:
        await kyc.read_upload(file)

    assert exc.value.status_code == 413
