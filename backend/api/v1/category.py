from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List
import csv
import io

from models import Category, Medicine
from schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db
from core.logger import logger

router = APIRouter()

@router.get("", response_model=BaseResponse[List[CategoryResponse]], summary="Get all categories")
def get_categories(
    search: str = Query(None, description="Search by category name"),
    db: Session = Depends(get_db),
    # Require authentication, but we don't need to use the user object here
    current_user = Depends(get_current_user)
):
    query = db.query(Category)
    
    if search:
        query = query.filter(Category.CategoryName.ilike(f"%{search}%"))
        
    categories = query.order_by(Category.CategoryName).all()
    return {"data": categories}

@router.post("", response_model=BaseResponse[CategoryResponse], summary="Create a new category")
def create_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check if category with same name exists
    existing = db.query(Category).filter(Category.CategoryName.ilike(category_in.CategoryName)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
        
    new_category = Category(
        CategoryName=category_in.CategoryName,
        IsActive=category_in.IsActive
    )
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return {"data": new_category, "message": "Category created successfully"}

@router.put("/{category_id}", response_model=BaseResponse[CategoryResponse], summary="Update a category")
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    category = db.query(Category).filter(Category.CategoryId == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    if category_in.CategoryName is not None:
        # Check uniqueness
        existing = db.query(Category).filter(
            Category.CategoryName.ilike(category_in.CategoryName),
            Category.CategoryId != category_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another category with this name already exists")
        category.CategoryName = category_in.CategoryName
        
    if category_in.IsActive is not None:
        category.IsActive = category_in.IsActive
        
    db.commit()
    db.refresh(category)
    return {"data": category, "message": "Category updated successfully"}

@router.put("/{category_id}/status", response_model=BaseResponse[CategoryResponse], summary="Toggle category status")
def toggle_category_status(
    category_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    category = db.query(Category).filter(Category.CategoryId == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    category.IsActive = not category.IsActive
    db.commit()
    db.refresh(category)
    return {"data": category, "message": f"Category status changed to {'Active' if category.IsActive else 'Inactive'}"}

@router.get("/export", summary="Export all categories to CSV")
def export_categories(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        categories = db.query(Category).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["CategoryName", "IsActive"])
        
        # Write rows
        for category in categories:
            writer.writerow([category.CategoryName, category.IsActive])
            
        logger.info(f"AUDIT: User {current_user.Username} exported {len(categories)} categories to CSV.")
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=categories_export.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting categories: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export categories")

@router.post("/import", summary="Import categories from CSV")
def import_categories(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    try:
        contents = file.file.read().decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(contents))
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for row_idx, row in enumerate(csv_reader, start=2): # Row 1 is header
            try:
                category_name = row.get("CategoryName", "").strip()
                if not category_name:
                    skipped_count += 1
                    errors.append(f"Row {row_idx}: CategoryName is required")
                    continue
                    
                is_active_str = row.get("IsActive", "True").strip().lower()
                is_active = is_active_str in ('true', '1', 'yes')
                
                # Check uniqueness
                existing = db.query(Category).filter(Category.CategoryName.ilike(category_name)).first()
                if existing:
                    skipped_count += 1
                    continue # silently skip or optionally report as error depending on requirements (will skip here as per bulk insert logic)
                    
                new_category = Category(
                    CategoryName=category_name,
                    IsActive=is_active
                )
                db.add(new_category)
                imported_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {row_idx}: {str(e)}")
        
        if imported_count > 0:
            db.commit()
            
        logger.info(f"AUDIT: User {current_user.Username} imported {imported_count} categories. Skipped: {skipped_count}. Errors: {len(errors)}")
        
        return {
            "data": {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors
            },
            "message": f"Successfully imported {imported_count} categories. Skipped: {skipped_count}."
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to import categories. Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import categories: {str(e)}")

@router.delete("/{category_id}", summary="Delete a category")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    category = db.query(Category).filter(Category.CategoryId == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Foreign Key Verification Check
    linked_medicines_count = db.query(Medicine).filter(Medicine.CategoryId == category_id).count()
    if linked_medicines_count > 0:
        logger.warning(f"AUDIT: User {current_user.Username} attempted to delete category {category_id} ({category.CategoryName}) but was blocked. Reason: {linked_medicines_count} medicines assigned.")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete category because {linked_medicines_count} medicines are assigned to it."
        )
        
    try:
        category_name = category.CategoryName
        db.delete(category)
        db.commit()
        logger.info(f"AUDIT: User {current_user.Username} successfully deleted category {category_id} ({category_name}).")
        return {"success": True, "message": "Category deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} encountered IntegrityError deleting category {category_id}. Error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this category due to database constraints (it may be linked to other records)."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"AUDIT: User {current_user.Username} failed to delete category {category_id}. Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the category")
