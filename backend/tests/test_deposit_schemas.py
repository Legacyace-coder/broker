import pytest
from decimal import Decimal
from pydantic import ValidationError

from app.schemas import DepositRequest


def test_crypto_deposit_defaults_to_usdt():
    request = DepositRequest(amount=25, payment_method="crypto")

    assert request.payment_currency == "USDT"
    assert request.payment_amount is None


@pytest.mark.parametrize("asset", ["BTC", "ETH", "USDC"])
def test_non_usdt_crypto_requires_sent_amount(asset):
    with pytest.raises(ValidationError):
        DepositRequest(
            amount=25,
            payment_method="crypto",
            payment_currency=asset,
        )

    request = DepositRequest(
        amount=25,
        payment_method="crypto",
        payment_amount="0.01",
        payment_currency=asset,
    )

    assert request.payment_currency == asset
    assert request.payment_amount == Decimal("0.01")


def test_crypto_payment_currency_is_normalized():
    request = DepositRequest(
        amount=25,
        payment_method="crypto",
        payment_currency="usdt",
    )

    assert request.payment_currency == "USDT"


def test_bank_payment_currency_remains_three_letter_code():
    request = DepositRequest(
        amount=25,
        payment_method="bank",
        payment_amount=30,
        payment_currency="USD",
    )

    assert request.payment_currency == "USD"

    with pytest.raises(ValidationError):
        DepositRequest(
            amount=25,
            payment_method="bank",
            payment_amount=30,
            payment_currency="USDT",
        )
