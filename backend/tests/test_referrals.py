from app.member_features import build_admin_referral_summary


def test_admin_referral_summary_counts_and_sorts_referrals():
    profiles = [
        {
            "id": "referrer-1",
            "email": "first@example.test",
            "full_name": "First Referrer",
            "referral_code": "NSFIRST",
            "referred_by": None,
            "created_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "referrer-2",
            "email": "second@example.test",
            "full_name": "Second Referrer",
            "referral_code": "NSSECOND",
            "referred_by": None,
            "created_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "member-1",
            "email": "member1@example.test",
            "full_name": "Member One",
            "referral_code": "NSMEMBER1",
            "referred_by": "referrer-1",
            "created_at": "2026-02-01T00:00:00+00:00",
        },
        {
            "id": "member-2",
            "email": "member2@example.test",
            "full_name": "Member Two",
            "referral_code": "NSMEMBER2",
            "referred_by": "referrer-1",
            "created_at": "2026-02-02T00:00:00+00:00",
        },
        {
            "id": "member-3",
            "email": "member3@example.test",
            "full_name": "Member Three",
            "referral_code": "NSMEMBER3",
            "referred_by": "referrer-2",
            "created_at": "2026-02-03T00:00:00+00:00",
        },
    ]

    result = build_admin_referral_summary(profiles)

    assert result["total_referrals"] == 3
    assert result["active_referrers"] == 2
    assert result["referrers"][0]["user_id"] == "referrer-1"
    assert result["referrers"][0]["referral_count"] == 2
    assert result["recent_referrals"][0]["email"] == "member3@example.test"
    assert result["recent_referrals"][0]["referral_code"] == "NSSECOND"


def test_admin_referral_summary_handles_empty_profiles():
    result = build_admin_referral_summary([])

    assert result["total_referrals"] == 0
    assert result["active_referrers"] == 0
    assert result["referrers"] == []
    assert result["recent_referrals"] == []
