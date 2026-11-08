import pytest
from pydantic import ValidationError

from app.schemas import DepositRequest


@pytest.mark.parametrize("asset", ["USDT", "BTC", "ETH", "USDC"])
def test_crypto_deposit_accepts_supported_asset_symbols(asset):
    payload = DepositRequest.model_validate({
        "amount": 100,
        "payment_method": "crypto",
        "payment_currency": asset,
        "payment_amount": None if asset == "USDT" else 0.25,
    })

    assert payload.payment_currency == asset


def test_crypto_deposit_defaults_to_usdt():
    payload = DepositRequest.model_validate({
        "amount": 100,
        "payment_method": "crypto",
    })

    assert payload.payment_currency == "USDT"


def test_non_usdt_crypto_requires_amount_sent():
    with pytest.raises(ValidationError):
        DepositRequest.model_validate({
            "amount": 100,
            "payment_method": "crypto",
            "payment_currency": "BTC",
        })


def test_bank_transfer_still_accepts_three_letter_currency():
    payload = DepositRequest.model_validate({
        "amount": 100,
        "payment_method": "bank",
        "payment_amount": 150,
        "payment_currency": "USD",
    })

    assert payload.payment_currency == "USD"