from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

Amount = Annotated[float, Field(gt=0, le=1_000_000)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=180)]
PlanName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
PlanDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
PlanAmount = Annotated[Decimal, Field(gt=0, max_digits=20, decimal_places=8)]
PaymentAmount = Annotated[Decimal, Field(gt=0, le=1_000_000, max_digits=20, decimal_places=8)]
CurrencyCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")]

def validate_plan_amount_range(minimum_amount: Decimal, maximum_amount: Decimal | None) -> None:
    if maximum_amount is not None and maximum_amount < minimum_amount:
        raise ValueError("Maximum amount must be greater than or equal to minimum amount")

class DepositRequest(BaseModel):
    amount: Amount
    asset: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=20)] = "USDT"
    payment_method: Literal["crypto", "bank"] = "crypto"
    payment_amount: PaymentAmount | None = None
    payment_currency: CurrencyCode | None = None
    reference: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=180)] = None

    @model_validator(mode="after")
    def validate_bank_payment(self):
        if self.payment_method == "bank" and (self.payment_amount is None or self.payment_currency is None):
            raise ValueError("Bank transfers require a payment amount and currency")
        return self

class WithdrawalRequest(BaseModel):
    amount: Amount
    asset: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=20)] = "USDT"
    network: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=40)] = "TRC20"
    wallet_address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=220)]

class ReviewRequest(BaseModel):
    status: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=20)]
    note: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=500)] = None

class DepositReviewRequest(BaseModel):
    status: Literal["approved", "rejected"]
    note: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=500)] = None
    credited_amount: PaymentAmount | None = None

class BalanceSetRequest(BaseModel):
    balance: Annotated[Decimal, Field(ge=0, le=Decimal("999999999999.99999999"), max_digits=20, decimal_places=8)]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]

class CryptoInstructionsUpdate(BaseModel):
    enabled: bool
    network: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] = ""
    wallet_address: Annotated[str, StringConstraints(strip_whitespace=True, max_length=220)] = ""
    instructions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""

    @model_validator(mode="after")
    def require_destination_when_enabled(self):
        if self.enabled and (len(self.network) < 2 or len(self.wallet_address) < 8):
            raise ValueError("Enabled crypto instructions require a network and valid wallet address")
        return self

class BankInstructionsUpdate(BaseModel):
    enabled: bool
    bank_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    account_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    account_number: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    currency: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3, pattern=r"^(?:[A-Za-z]{3})?$")] = ""
    iban: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    swift_bic: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] = ""
    instructions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def require_destination_when_enabled(self):
        if self.enabled and (len(self.bank_name) < 2 or len(self.account_name) < 2 or len(self.account_number) < 3 or len(self.currency) != 3):
            raise ValueError("Enabled bank instructions require bank, account holder, account number and currency")
        return self

class PlanCreate(BaseModel):
    name: PlanName
    description: PlanDescription = ""
    minimum_amount: PlanAmount
    maximum_amount: PlanAmount | None = None
    active: bool = True

    @model_validator(mode="after")
    def validate_amount_range(self):
        validate_plan_amount_range(self.minimum_amount, self.maximum_amount)
        return self

class PlanUpdate(BaseModel):
    name: PlanName | None = None
    description: PlanDescription | None = None
    minimum_amount: PlanAmount | None = None
    maximum_amount: PlanAmount | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def validate_amount_range(self):
        if self.minimum_amount is not None:
            validate_plan_amount_range(self.minimum_amount, self.maximum_amount)
        for field in ("name", "description", "minimum_amount", "active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self
