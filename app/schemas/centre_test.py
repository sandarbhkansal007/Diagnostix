from decimal import Decimal

from pydantic import BaseModel, Field


class CentreTestCreate(BaseModel):
    centre_id: int = Field(gt=0)
    test_id: int = Field(gt=0)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


class CentreTestResponse(BaseModel):
    id: int
    test_id: int
    test_name: str
    description: str | None
    price: Decimal