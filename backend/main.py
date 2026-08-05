from fastapi import FastAPI, APIRouter
from fastapi.exceptions import RequestValidationError
from core.config import settings
from core.logger import logger
from core.exceptions import (
    PMSException, 
    pms_exception_handler, 
    general_exception_handler
)

from api.v1 import license, auth, category, company, supplier, customer, medicine, purchase, purchase_return, inventory, sales, dashboard, reports

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

# Define API Router
api_router = APIRouter(prefix=settings.API_V1_STR)

# Register Routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(license.router, prefix="/license", tags=["License"])
api_router.include_router(category.router, prefix="/categories", tags=["Categories"])
api_router.include_router(company.router, prefix="/companies", tags=["Companies"])
api_router.include_router(supplier.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(customer.router, prefix="/customers", tags=["Customers"])
api_router.include_router(medicine.router, prefix="/medicines", tags=["Medicines"])
api_router.include_router(purchase.router, prefix="/purchases", tags=["Purchases"])
api_router.include_router(purchase_return.router, prefix="/purchase-returns", tags=["Purchase Returns"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])

app.include_router(api_router)

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

