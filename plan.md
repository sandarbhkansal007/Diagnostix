## Plan: Diagnostix backend

### Phase 1 findings

This assignment is a backend-only service for managing diagnostic centres, tests, patient bookings, simulated payments, and idempotent webhook processing. The design must prioritize data correctness, clear business-state transitions, ownership enforcement, and database-level idempotency.

The PDF explicitly requires a backend with JWT auth, diagnostic centre/test management, booking creation and ownership checks, simulated payments, and a webhook that is safe to retry. It does not provide a full admin model or a strict appointment-time policy beyond booking an appointment, so those choices will be treated as explicit project assumptions.

### 1. Revised architecture
- Use FastAPI + SQLAlchemy 2 + PostgreSQL + Alembic + Pydantic.
- Use a minimal layered architecture: routes, services, models, schemas, database session logic, and auth/security helpers.
- Keep the domain model simple and explainable in an interview.
- Use JWT bearer auth for authenticated endpoints.
- Do not add RBAC unless the project assumptions later require it; the simplest reasonable model is: all registered users can create/read their own data, and centre/test creation can be done by any authenticated user unless a later requirement says otherwise.
- Treat payment processing and webhook handling as transactional and database-driven, not memory-based.

### 2. Final database schema

#### users
- id
- email UNIQUE
- password_hash
- created_at
- updated_at

#### diagnostic_centres
- id
- name
- location
- created_at
- updated_at

#### diagnostic_tests
- id
- name
- description (optional)
- created_at
- updated_at

#### centre_tests
- id
- centre_id FK
- test_id FK
- price
- created_at
- updated_at
- UNIQUE(centre_id, test_id)

This is a normalized many-to-many relationship. A diagnostic test can be offered by multiple centres, and each centre can charge a different price.

#### bookings
- id
- user_id FK
- centre_test_id FK
- appointment_datetime
- amount (snapshot of centre_tests.price at booking time)
- status
- created_at
- updated_at

Status enum:
- PENDING
- CONFIRMED
- FAILED
- CANCELLED

Final schema decision: centre_test_id is the canonical relationship. A booking is defined by the specific centre/test/price tuple in centre_tests; we do not keep redundant centre_id and test_id columns on bookings because there is no strong requirement for them and they create integrity risk if they drift from centre_test_id.

If a query needs centre or test data, it should join through centre_test_id rather than storing duplicate foreign keys. This keeps the schema normalized and ensures a booking can only ever represent one valid centre/test combination.

#### payments
- id
- booking_id FK UNIQUE
- amount
- status
- provider_payment_id UNIQUE (nullable if not provided by provider)
- created_at
- updated_at

Final payment decision: one booking is allowed to have only one payment record in this simplified design. We enforce UNIQUE(booking_id) on payments to prevent multiple payment rows for a single booking. Re-tries are not modeled as new payment records; the same payment record is either updated to a final status or rejected as an invalid retry. This keeps the payment lifecycle simple, consistent, and explainable in an interview.

If a payment needs to be retried later, the project should decide whether to allow a follow-up attempt as a separate operational workflow, but that is outside the minimum assignment scope and would require a more explicit payment-attempt model. For the current plan, we do not create new payment rows for duplicate processing.

#### webhook_events
- id
- provider_event_id UNIQUE
- event_type
- payload_hash (optional, useful for auditing and debugging)
- status
- processed_at
- created_at

This is the idempotency ledger. provider_event_id is not the payment primary key; it is the unique external event identifier that protects against duplicate webhook delivery.

#### Recommended indexes
- users.email
- centre_tests.(centre_id, test_id)
- bookings.user_id
- bookings.centre_test_id
- bookings.status
- bookings.appointment_datetime
- payments.booking_id
- payments.provider_payment_id
- webhook_events.provider_event_id

### 3. Final endpoint list

#### Auth
- POST /api/v1/auth/signup
  - Auth: none
  - Request: email, password
  - Response: user summary + token
  - Status: 201 on success; 400/409 for validation/conflict
  - Validation: email format, password length, duplicate email

- POST /api/v1/auth/login
  - Auth: none
  - Request: email, password
  - Response: token and user summary
  - Status: 200 on success; 401 for invalid credentials; 400 for bad payload

#### Centres
- POST /api/v1/centres
  - Auth: required
  - Request: name, location
  - Response: centre object
  - Status: 201 on create; 400 for validation; 401 for missing JWT
  - Authorization: any authenticated user can create a centre under the simple model; no admin role enforced by the PDF

- GET /api/v1/centres
  - Auth: optional or public
  - Response: list of centres
  - Status: 200

- GET /api/v1/centres/{centre_id}
  - Auth: optional or public
  - Response: centre + list of offered tests and prices
  - Status: 200; 404 if not found

#### Tests
- POST /api/v1/tests
  - Auth: required
  - Request: name, description optional
  - Response: test object
  - Status: 201; 400/401
  - Authorization: any authenticated user can create a test under the simple model

- GET /api/v1/tests
  - Auth: optional or public
  - Response: list of tests
  - Status: 200

#### Centre-to-test price mapping
- POST /api/v1/centre-tests
  - Auth: required
  - Request: centre_id, test_id, price
  - Response: centre_test object
  - Status: 201; 400/404/409/401
  - Validation: unique centre/test pair, positive price

- GET /api/v1/centres/{centre_id}/tests
  - Auth: optional or public
  - Response: list of tests offered by that centre with price
  - Status: 200; 404 if centre not found

#### Bookings
- POST /api/v1/bookings
  - Auth: required
  - Request: centre_id, test_id, appointment_datetime
  - Response: booking object
  - Status: 201; 400/401/404/409
  - Authorization: user can create only for themselves
  - Validation: centre/test pair exists; test offered by centre; amount computed from centre_tests.price; appointment datetime valid; status starts as PENDING

- GET /api/v1/bookings
  - Auth: required
  - Response: list of the current user’s bookings
  - Status: 200
  - Authorization: only current user’s bookings

- GET /api/v1/bookings/{booking_id}
  - Auth: required
  - Response: booking detail
  - Status: 200; 404; 403 if not owned by user

- POST /api/v1/bookings/{booking_id}/cancel
  - Auth: required
  - Response: updated booking
  - Status: 200; 400 for invalid transition; 403 for unauthorized; 404 if missing
  - Authorization: only the booking owner can cancel
  - Valid transitions: PENDING -> CANCELLED, maybe CONFIRMED -> CANCELLED only if project assumption allows it

#### Payments
- POST /api/v1/payments
  - Auth: required
  - Request: booking_id
  - Response: payment object or status summary
  - Status: 201 on created; 400 invalid booking; 401 unauthenticated; 403 unauthorized; 404 missing booking
  - Authorization: only the booking owner can pay for the booking
  - Validation: booking must exist and belong to current user; booking not already terminal (FAILED/CANCELLED)

- POST /api/v1/payments/webhook
  - Auth: none, or signed provider endpoint if desired by project assumption
  - Request: provider_event_id, booking_id, payment_status, provider_payment_id, payload metadata
  - Response: ack/no-op result
  - Status: 200 for accepted, 400 for malformed payload, 409 if duplicate event semantics are handled as idempotent success if event already processed
  - Validation: provider_event_id required; valid booking_id; valid event_type/status; duplicate via unique constraint

### 4. Final booking/payment/webhook state flow

#### Booking lifecycle
- Booking is created as PENDING.
- If payment succeeds: PENDING -> CONFIRMED
- If payment fails: PENDING -> FAILED
- If cancelled manually: PENDING -> CANCELLED
- Optional assumption: CONFIRMED -> CANCELLED may be allowed if the project later decides cancellations after confirmation are valid; otherwise block it

#### Payment flow
1. User creates a booking.
2. User submits payment for the booking.
3. System creates a payment row with amount and status set to PROCESSING or INITIATED.
4. Simulated gateway outcome returns SUCCESS or FAILED.
5. System updates payment status and transitions the booking according to the valid state map.

#### Webhook flow
1. Provider sends a webhook event with provider_event_id and booking_id.
2. System inserts/locks follow-up event record in a transaction.
3. If same provider_event_id already exists, the transaction detects the duplicate and returns the existing processed result without modifying booking status.
4. If unique constraint is hit concurrently, one request wins and the other sees the duplicate result safely.
5. The winning transaction checks allowed booking transitions before updating booking and payment state.

### 5. Exact idempotency strategy

Use a database-transaction-safe pattern:

- webhook_events has UNIQUE(provider_event_id)
- On webhook receive, begin a transaction
- Attempt to insert a row into webhook_events with provider_event_id
- If insert succeeds: this request is the winner and is allowed to process the event
- If insert fails with unique violation: this is a duplicate event; fetch the previous webhook_events row and return a successful idempotent response without further state change
- Then validate the booking state transition in the same transaction before updating the booking and payment rows
- Use row-level locking or transaction serialization around the target booking row if necessary to avoid race conditions during state updates

This guarantees the same provider_event_id can never be processed twice, even if two requests hit simultaneously.

Concurrency model:
- unique constraint is the primary guard
- transaction boundary ensures atomicity
- one request wins the insert; the other sees a duplicate
- valid transition checks prevent invalid booking state changes
- if a payment row already exists for that booking/event, return the existing result rather than creating another row

This is stronger than checking in memory and is safe under concurrent requests.

### 6. Assumptions vs PDF requirements

#### Requirements explicitly supported by the PDF
- Authentication with signup/login and JWT
- Diagnostic centres and tests management/retrieval
- Booking creation tied to users and test/centre combinations
- Simulated payment processing
- Payment webhook with idempotency requirement
- Protected endpoints and authorization checks for booking ownership
- Database-backed correctness and validation

#### Explicit project assumptions
These are not directly stated in the PDF, but we may adopt them for a cleaner implementation if noted in the README and API decisions:

- appointment times may be required to be in the future
- failed and cancelled bookings are considered terminal for future payment attempts
- no admin role is required; all authenticated users can manage centres/tests under the simplest model
- cancellation of confirmed bookings may be disallowed unless explicitly allowed later

These assumptions must be called out clearly, not silently treated as requirements.

### 7. Recommended authorization model
The simplest reasonable model is:
- all users can sign up and log in
- all authenticated users can create centres/tests and manage their own bookings
- only the owner of a booking can view or cancel it
- there is no admin role, no RBAC hierarchy, and no complicated permission model

This matches the assignment’s scope closely and keeps the code understandable.

### 8. Final project structure
- app/
  - main.py
  - api/
    - deps.py
    - routes/
      - auth.py
      - centres.py
      - tests.py
      - centre_tests.py
      - bookings.py
      - payments.py
  - core/
    - config.py
    - security.py
    - enums.py
    - errors.py
  - db/
    - base.py
    - session.py
  - models/
    - user.py
    - diagnostic_centre.py
    - diagnostic_test.py
    - centre_test.py
    - booking.py
    - payment.py
    - webhook_event.py
  - schemas/
    - auth.py
    - centre.py
    - diagnostic_test.py
    - centre_test.py
    - booking.py
    - payment.py
    - webhook.py
  - services/
    - auth_service.py
    - centre_service.py
    - booking_service.py
    - payment_service.py
    - webhook_service.py
- tests/
  - test_auth.py
  - test_centres.py
  - test_tests.py
  - test_bookings.py
  - test_payments.py
  - test_webhooks.py
- alembic/
- Dockerfile
- docker-compose.yml
- requirements.txt or pyproject.toml
- .env.example
- README.md

### 9. Updated implementation phases
1. Confirm final requirements and explicit assumptions from the PDF.
2. Scaffold FastAPI project, config, DB setup, environment variables, and Docker wiring.
3. Define all SQLAlchemy models and Alembic migrations for the final schema, including uniqueness constraints and indexes.
4. Implement authentication: signup, login, password hashing, JWT generation/verification, dependency-based auth.
5. Implement centre and test APIs, plus centre-test price linking.
6. Implement booking API with ownership enforcement and valid state transitions.
7. Implement simulated payment processing and booking status updates.
8. Implement the webhook flow with unique provider_event_id and idempotent processing transaction pattern.
9. Add integration tests for auth, centre/test management, booking validation, payment success/failure, unauthorized access, invalid transitions, and duplicate webhook processing.
10. Finalize Docker, Swagger docs, and README.
11. Perform assignment audit against the PDF and confirm compliance with the revised design.

### 10. Key design decisions to preserve
- Do not put centre_id directly on diagnostic_tests.
- Use a dedicated table for centre-specific test pricing.
- Snapshot the amount at booking creation.
- Treat payment identity and webhook identity as separate concepts.
- Use a unique DB column for provider_event_id to guarantee idempotency.
- Keep permission rules intentionally simple and explainable.
- Validate state transitions explicitly instead of allowing arbitrary mutation.

This revised design stays minimal, correct, and interview-friendly while covering the critical webhook concurrency and idempotency requirement explicitly.