from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from core.config import settings
from core.logger import logger
from core.exceptions import (
    PMSException, 
    pms_exception_handler, 
    general_exception_handler
)

from api.v1 import license, auth, category, company, supplier, customer, medicine, purchase, purchase_return

from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI with loaded settings
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url=f"{settings.API_V1_STR}/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(license.router, prefix=f"{settings.API_V1_STR}/license", tags=["License"])
app.include_router(category.router, prefix=f"{settings.API_V1_STR}/categories", tags=["Categories"])
app.include_router(company.router, prefix=f"{settings.API_V1_STR}/companies", tags=["Companies"])
app.include_router(supplier.router, prefix=f"{settings.API_V1_STR}/suppliers", tags=["Suppliers"])
app.include_router(customer.router, prefix=f"{settings.API_V1_STR}/customers", tags=["Customers"])
app.include_router(medicine.router, prefix=f"{settings.API_V1_STR}/medicines", tags=["Medicines"])
app.include_router(purchase.router, prefix=f"{settings.API_V1_STR}/purchases", tags=["Purchases"])
app.include_router(purchase_return.router, prefix=f"{settings.API_V1_STR}/purchase-returns", tags=["Purchase Returns"])

# Register Custom Exception Handlers
app.add_exception_handler(PMSException, pms_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.PROJECT_NAME} backend...")

@app.get("/")
def read_root():
    logger.info("Root endpoint accessed")
    return {"status": "ok", "message": f"{settings.PROJECT_NAME} Backend is running"}

