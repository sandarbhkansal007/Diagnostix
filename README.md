# EVE Healthcare Backend

A small FastAPI backend for diagnostic-centre discovery, test pricing, appointment bookings, simulated payments, and payment-provider webhook handling. It is designed for the EVE Healthcare SDE Intern Backend Engineering Assignment.

## Tech Stack

- Python 3.12
- FastAPI and Uvicorn
- Pydantic 2
- SQLAlchemy 2
- PostgreSQL 16
- Alembic
- JWT with PyJWT
- Argon2 password hashing with pwdlib
- Pytest and HTTPX

## Architecture

- `app/api/routes`: HTTP endpoints and dependency wiring.
- `app/schemas`: Pydantic request and response contracts.
- `app/services`: domain logic and transaction boundaries.
- `app/models`: SQLAlchemy tables and enums.
- `app/db`: SQLAlchemy engine, sessions, and declarative metadata.
- `app/core`: settings and security utilities.

Authenticated application endpoints use `get_current_user()`. The payment webhook is intentionally unauthenticated because it represents an external provider callback; provider signatures are outside this assignment's scope.

## Setup

Requirements: Python 3.12 and PostgreSQL 16 or a compatible PostgreSQL installation.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set a real, long random value for `JWT_SECRET_KEY` in `.env`. Do not commit `.env`.

Run the migration and start the API:

```powershell
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`. Swagger UI is at `/docs` and ReDoc is at `/redoc`.

## Docker

Docker Compose starts PostgreSQL and the API:

```powershell
$env:JWT_SECRET_KEY = "replace-this-with-a-long-random-secret"
docker compose up --build
```

The app container expects the database to be healthy. Apply migrations from the project directory after the database is available, or from the app container:

```powershell
docker compose exec app alembic upgrade head
```

The app service sets `PYTHONPATH=/app` so the Alembic console command can import the application package. The compose configuration requires `JWT_SECRET_KEY`; no application secret is stored in the repository.

## Environment Variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL | `postgresql+psycopg2://postgres:postgres@localhost:5432/eve_health` |
| `POSTGRES_DB` | PostgreSQL database name | `eve_health` |
| `POSTGRES_USER` | PostgreSQL user | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `change-me-locally` |
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `JWT_SECRET_KEY` | JWT signing secret | a long random local secret |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime | `30` |

## API Endpoints

All protected application endpoints require a Bearer token. Signup, login, webhook, health, and root endpoints do not require a user Bearer token.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | No | Return application name and environment |
| POST | `/api/v1/auth/signup` | No | Create a user and issue a token |
| POST | `/api/v1/auth/login` | No | Verify credentials and issue a token |
| GET | `/api/v1/auth/me` | Yes | Return the current user |
| POST | `/api/v1/centres` | Yes | Create a diagnostic centre |
| GET | `/api/v1/centres` | Yes | List diagnostic centres |
| GET | `/api/v1/centres/{centre_id}` | Yes | Get one centre |
| POST | `/api/v1/tests` | Yes | Create a diagnostic test |
| GET | `/api/v1/tests` | Yes | List diagnostic tests |
| POST | `/api/v1/centre-tests` | Yes | Set centre-specific test pricing |
| GET | `/api/v1/centres/{centre_id}/tests` | Yes | List tests and prices at a centre |
| POST | `/api/v1/bookings` | Yes | Create a pending booking |
| GET | `/api/v1/bookings` | Yes | List the current user's bookings |
| GET | `/api/v1/bookings/{booking_id}` | Yes | Get an owned booking |
| POST | `/api/v1/bookings/{booking_id}/cancel` | Yes | Cancel a pending booking |
| POST | `/api/v1/payments` | Yes | Run a deterministic simulated payment |
| POST | `/api/v1/payments/webhook` | No | Process a simulated provider event |
| GET | `/health` | No | Health check |

## Example API Flow

Use `Authorization: Bearer <access_token>` for authenticated requests.

### Signup or login

```http
POST /api/v1/auth/signup
Content-Type: application/json

{"email":"demo@example.com","password":"correct-horse-battery-staple"}
```

The response includes `user`, `access_token`, and `token_type`. Password hashes are never returned.

### Create catalogue data

```http
POST /api/v1/centres
Authorization: Bearer <token>
Content-Type: application/json

{"name":"Central Lab","location":"Downtown"}
```

```http
POST /api/v1/tests
Authorization: Bearer <token>
Content-Type: application/json

{"name":"Blood Test","description":"Routine analysis"}
```

```http
POST /api/v1/centre-tests
Authorization: Bearer <token>
Content-Type: application/json

{"centre_id":1,"test_id":1,"price":"500.00"}
```

### Create a booking

```http
POST /api/v1/bookings
Authorization: Bearer <token>
Content-Type: application/json

{"centre_test_id":1,"appointment_datetime":"2099-01-01T10:00:00+00:00"}
```

The server copies the current centre-test price into the booking amount. Clients cannot provide or override the amount.

### Simulate payment

```http
POST /api/v1/payments
Authorization: Bearer <token>
Content-Type: application/json

{"booking_id":1,"simulation_outcome":"SUCCESS"}
```

`simulation_outcome` is deliberately deterministic and accepts `SUCCESS` or `FAILED`.

### Process a provider webhook

A payment must already exist with the supplied `provider_payment_id`.

```http
POST /api/v1/payments/webhook
Content-Type: application/json

{
  "provider_event_id":"evt_123",
  "event_type":"payment.succeeded",
  "provider_payment_id":"sim_payment_abc123",
  "booking_id":1,
  "payment_outcome":"SUCCESS",
  "amount":"500.00"
}
```

## Booking and Payment Lifecycle

- `PENDING -> CONFIRMED`: successful simulated payment or successful matching webhook.
- `PENDING -> FAILED`: failed simulated payment or failed matching webhook.
- `PENDING -> CANCELLED`: the booking owner cancels the booking.

Completed, failed, or cancelled states cannot be overwritten by contradictory payment/webhook operations. A booking amount is a price snapshot and does not change if catalogue pricing changes later.

## Webhook Idempotency

`provider_payment_id` identifies the provider payment. `provider_event_id` identifies one provider event delivery; they are separate identities.

`webhook_events.provider_event_id` has a database-level unique constraint. Webhook processing uses a conflict-safe insert, locks the target payment and booking where supported, validates the stored amount with `Decimal`, updates payment and booking state, marks the event processed, and commits the changes atomically. A repeated event returns an idempotent success response without applying the state transition again or creating another record.

Unknown payments, booking/payment mismatches, amount mismatches, and invalid state transitions are rejected without recording a processed event.

## Database Schema

- `users`: credentials and timestamps.
- `diagnostic_centres`: diagnostic locations.
- `diagnostic_tests`: reusable test definitions.
- `centre_tests`: many-to-many centre/test relationship with centre-specific `NUMERIC(10,2)` pricing and a unique `(centre_id, test_id)` constraint.
- `bookings`: user-owned appointments, price snapshots, and booking status.
- `payments`: one payment per booking, payment status, amount snapshot, and provider payment identity.
- `webhook_events`: provider event idempotency ledger.

There is no `centre_id` on `diagnostic_tests` and no redundant `centre_id` or `test_id` on `bookings`.

## Assumptions

- Payments are simulated; no real gateway is integrated.
- Payment simulation is controlled by an explicit `SUCCESS` or `FAILED` request value.
- Webhook authentication and signature verification are outside scope.
- There are no RBAC or admin roles.
- Booking amounts are copied from centre-test prices at booking creation.
- GET catalogue and booking endpoints require authentication for a simple consistent API boundary.

## Testing

Run the complete deterministic suite with:

```powershell
python -m pytest -q
python -m compileall -q app tests
```

The final suite currently contains 62 tests.

The suite uses isolated SQLite databases for fast tests. PostgreSQL-specific migration and concurrency behavior should also be checked in a PostgreSQL environment before production deployment.

## Screenshots of Manual Testing Through Postman and Verification of Data in DB

The following screenshots demonstrate the manual testing of the implemented APIs using Postman and the corresponding verification of data and state changes in the PostgreSQL database using TablePlus.

## API Testing and Database Verification

![Screenshot 1](images/image1.png)

![Screenshot 2](images/image2.png)

![Screenshot 3](images/image3.png)

![Screenshot 4](images/image4.png)

![Screenshot 5](images/image5.png)

![Screenshot 6](images/image6.png)

![Screenshot 7](images/image7.png)

![Screenshot 8](images/image8.png)

![Screenshot 9](images/image9.png)

![Screenshot 10](images/image10.png)

![Screenshot 11](images/image11.png)

![Screenshot 12](images/image12.png)

![Screenshot 13](images/image13.png)

![Screenshot 14](images/image14.png)

![Screenshot 15](images/image15.png)

![Screenshot 16](images/image16.png)

![Screenshot 17](images/image17.png)

![Screenshot 18](images/image18.png)

![Screenshot 19](images/image19.png)

![Screenshot 20](images/image20.png)

![Screenshot 21](images/image21.png)

![Screenshot 22](images/image22.png)

## Future Improvements

A production version could add a real payment gateway, signed webhook verification, PostgreSQL integration/concurrency tests, rate limiting, structured observability, background processing, and stronger operational controls.


