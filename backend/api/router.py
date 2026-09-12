"""API composition root.

Route modules own HTTP translation.  This module owns only URL structure and
keeps application construction independent from every feature module.
"""

from fastapi import APIRouter

from api.v1 import (
    about,
    auth,
    backup,
    backup_settings,
    category,
    company,
    customer,
    dashboard,
    inventory,
    license,
    medicine,
    notification,
    purchase,
    purchase_return,
    reports,
    sales,
    security,
    settings,
    supplier,
    system,
    users,
)


def create_api_router(prefix: str) -> APIRouter:
    router = APIRouter(prefix=prefix)

    registrations = (
        (auth.router, "/auth", ["Authentication"]),
        (license.router, "/license", ["License"]),
        (category.router, "/categories", ["Categories"]),
        (company.router, "/companies", ["Companies"]),
        (supplier.router, "/suppliers", ["Suppliers"]),
        (customer.router, "/customers", ["Customers"]),
        (medicine.router, "/medicines", ["Medicines"]),
        (purchase.router, "/purchases", ["Purchases"]),
        (purchase_return.router, "/purchase-returns", ["Purchase Returns"]),
        (inventory.router, "/inventory", ["Inventory"]),
        (sales.router, "/sales", ["Sales"]),
        (dashboard.router, "/dashboard", ["Dashboard"]),
        (reports.router, "/reports", ["Reports"]),
        (backup.router, "/backup", ["Backup & Restore"]),
        (backup.exit_backup_router, "/backup", ["Backup & Restore"]),
        (backup_settings.router, "/backup-settings", ["Backup Settings"]),
        (settings.router, "/settings", ["Settings"]),
        (about.router, "/about", ["About"]),
        (system.router, "/system", ["System Diagnostics"]),
        (notification.router, "/notifications", ["Notifications"]),
        (users.router, "/users", ["Users"]),
    )

    for feature_router, route_prefix, tags in registrations:
        router.include_router(feature_router, prefix=route_prefix, tags=tags)

    # Security declares its own prefixes and tags for backward compatibility.
    router.include_router(security.router)
    return router
