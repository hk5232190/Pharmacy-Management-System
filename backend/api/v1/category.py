from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from models import Category
from schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from schemas.base import BaseResponse
from api.deps import get_current_user, get_db

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
