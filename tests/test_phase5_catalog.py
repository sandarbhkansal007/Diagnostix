from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.config import settings
from app.db.base import Base
from app.main import app


@pytest.fixture
def test_db(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-only-secret")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield testing_session
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client(test_db) -> TestClient:
    return TestClient(app)


def auth_headers(client: TestClient, email: str = "catalog@example.com") -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct-horse-battery-staple"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_centre(client: TestClient, headers: dict[str, str], name: str = "Central Lab") -> dict:
    response = client.post(
        "/api/v1/centres",
        json={"name": name, "location": "Downtown"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_test(client: TestClient, headers: dict[str, str], name: str = "Blood Test") -> dict:
    response = client.post(
        "/api/v1/tests",
        json={"name": name, "description": "Routine analysis"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


# Covers authenticated diagnostic-centre creation.
def test_authenticated_centre_creation(client: TestClient) -> None:
    headers = auth_headers(client)

    response = client.post(
        "/api/v1/centres",
        json={"name": "Central Lab", "location": "Downtown"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Central Lab"
    assert response.json()["location"] == "Downtown"


# Covers requiring authentication to create a centre.
def test_unauthenticated_centre_creation_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/v1/centres",
        json={"name": "Central Lab", "location": "Downtown"},
    )

    assert response.status_code == 401


# Covers retrieving one centre and listing centres.
def test_get_and_list_centres(client: TestClient) -> None:
    headers = auth_headers(client)
    centre = create_centre(client, headers)

    detail_response = client.get(f"/api/v1/centres/{centre['id']}", headers=headers)
    list_response = client.get("/api/v1/centres", headers=headers)

    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == centre["id"]
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


# Covers returning 404 for an unknown centre ID.
def test_nonexistent_centre_returns_404(client: TestClient) -> None:
    headers = auth_headers(client)

    response = client.get("/api/v1/centres/999", headers=headers)

    assert response.status_code == 404


# Covers authenticated diagnostic-test creation and listing.
def test_authenticated_test_creation_and_listing(client: TestClient) -> None:
    headers = auth_headers(client)

    create_response = client.post(
        "/api/v1/tests",
        json={"name": "Blood Test", "description": "Routine analysis"},
        headers=headers,
    )
    list_response = client.get("/api/v1/tests", headers=headers)

    assert create_response.status_code == 201
    assert create_response.json()["description"] == "Routine analysis"
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


# Covers creating centre-specific pricing and retrieving available tests.
def test_create_and_retrieve_centre_tests(client: TestClient) -> None:
    headers = auth_headers(client)
    centre = create_centre(client, headers)
    diagnostic_test = create_test(client, headers)

    create_response = client.post(
        "/api/v1/centre-tests",
        json={"centre_id": centre["id"], "test_id": diagnostic_test["id"], "price": "25.50"},
        headers=headers,
    )
    list_response = client.get(f"/api/v1/centres/{centre['id']}/tests", headers=headers)

    assert create_response.status_code == 201
    assert create_response.json()["test_id"] == diagnostic_test["id"]
    assert Decimal(str(create_response.json()["price"])) == Decimal("25.50")
    assert list_response.status_code == 200
    assert list_response.json()[0]["test_name"] == "Blood Test"
    assert list_response.json()[0]["description"] == "Routine analysis"
    assert Decimal(str(list_response.json()[0]["price"])) == Decimal("25.50")


# Covers rejecting a pricing association for an unknown centre.
def test_nonexistent_centre_for_centre_test_returns_404(client: TestClient) -> None:
    headers = auth_headers(client)
    diagnostic_test = create_test(client, headers)

    response = client.post(
        "/api/v1/centre-tests",
        json={"centre_id": 999, "test_id": diagnostic_test["id"], "price": "25.50"},
        headers=headers,
    )

    assert response.status_code == 404


# Covers rejecting a pricing association for an unknown diagnostic test.
def test_nonexistent_test_for_centre_test_returns_404(client: TestClient) -> None:
    headers = auth_headers(client)
    centre = create_centre(client, headers)

    response = client.post(
        "/api/v1/centre-tests",
        json={"centre_id": centre["id"], "test_id": 999, "price": "25.50"},
        headers=headers,
    )

    assert response.status_code == 404


# Covers returning 404 when listing tests for an unknown centre.
def test_nonexistent_centre_when_retrieving_tests_returns_404(client: TestClient) -> None:
    headers = auth_headers(client)

    response = client.get("/api/v1/centres/999/tests", headers=headers)

    assert response.status_code == 404


# Covers enforcing uniqueness for each centre-test pricing association.
def test_duplicate_centre_test_returns_409(client: TestClient) -> None:
    headers = auth_headers(client)
    centre = create_centre(client, headers)
    diagnostic_test = create_test(client, headers)
    payload = {"centre_id": centre["id"], "test_id": diagnostic_test["id"], "price": "25.50"}

    first_response = client.post("/api/v1/centre-tests", json=payload, headers=headers)
    duplicate_response = client.post("/api/v1/centre-tests", json=payload, headers=headers)

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409


# Covers rejecting zero or negative centre-test pricing.
def test_non_positive_price_returns_422(client: TestClient) -> None:
    headers = auth_headers(client)
    centre = create_centre(client, headers)
    diagnostic_test = create_test(client, headers)

    response = client.post(
        "/api/v1/centre-tests",
        json={"centre_id": centre["id"], "test_id": diagnostic_test["id"], "price": "0.00"},
        headers=headers,
    )

    assert response.status_code == 422


# Covers requiring authentication to create a centre-test association.
def test_unauthenticated_centre_test_creation_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/v1/centre-tests",
        json={"centre_id": 1, "test_id": 1, "price": "25.50"},
    )

    assert response.status_code == 401
