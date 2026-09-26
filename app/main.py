from fastapi import FastAPI

from app.api.routes.auth import router as auth_router
from app.api.routes.bookings import router as bookings_router
from app.api.routes.centre_tests import router as centre_tests_router
from app.api.routes.centres import router as centres_router
from app.api.routes.diagnostic_tests import router as diagnostic_tests_router
from app.api.routes.health import router as health_router
from app.api.routes.payments import router as payments_router
from app.api.routes.payment_webhooks import router as payment_webhooks_router
from app.core.config import settings

app = FastAPI(
    title="EVE Healthcare Backend",
    version="0.1.0",
    description="EVE Healthcare SDE Intern Backend Engineering Assignment",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(centres_router)
app.include_router(diagnostic_tests_router)
app.include_router(centre_tests_router)
app.include_router(payments_router)
app.include_router(payment_webhooks_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"app": settings.app_name, "environment": settings.app_env}
