# Template: FastAPI Router with Full CRUD
# Usage: Copy to app/routers/ → rename file and router prefix → replace TODO sections
# Stack: FastAPI, Python 3.12, Pydantic v2, async SQLAlchemy / Firebase Admin

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# TODO: Replace 'items' with your resource name
router = APIRouter(
    prefix="/items",
    tags=["items"],
)

# ------------------------------------
# Pydantic Models
# ------------------------------------

# TODO: Define your resource fields
class ItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    is_active: bool = Field(default=True)


class ItemCreate(ItemBase):
    pass  # Add create-only fields here


class ItemUpdate(BaseModel):
    # All fields optional for PATCH
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = None


class ItemResponse(ItemBase):
    id: str
    author_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedItems(BaseModel):
    items: List[ItemResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


# ------------------------------------
# Dependencies — replace with your own
# ------------------------------------

# TODO: Replace with your auth dependency
async def get_current_user(
    # token: str = Depends(oauth2_scheme)
) -> dict:
    # Verify token, return user dict
    # raise HTTPException(status_code=401, ...) if invalid
    return {"uid": "placeholder-uid", "email": "user@example.com"}


# TODO: Replace with your DB dependency
async def get_db():
    # Yield your DB session/client
    # yield db_session
    pass


# ------------------------------------
# Route Handlers
# ------------------------------------

@router.get("/", response_model=PaginatedItems)
async def list_items(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by title"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db=Depends(get_db),
):
    """List all items with optional filtering and pagination."""
    # TODO: Replace with actual DB query
    # offset = (page - 1) * page_size
    # query = select(Item).offset(offset).limit(page_size)
    # if search: query = query.where(Item.title.ilike(f"%{search}%"))
    # items = await db.execute(query)
    # total = await db.scalar(select(func.count(Item.id)))

    return PaginatedItems(
        items=[],
        total=0,
        page=page,
        page_size=page_size,
        has_next=False,
    )


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    db=Depends(get_db),
):
    """Get a single item by ID."""
    # TODO: Replace with actual DB fetch
    # item = await db.get(Item, item_id)
    # if not item:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Item {item_id} not found",
    )


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new item. Requires authentication."""
    # TODO: Replace with actual DB insert
    # new_item = Item(
    #     **payload.model_dump(),
    #     author_id=current_user["uid"],
    #     created_at=datetime.utcnow(),
    #     updated_at=datetime.utcnow(),
    # )
    # db.add(new_item)
    # await db.commit()
    # await db.refresh(new_item)
    # return new_item
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    payload: ItemUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update an item. Only the author can update."""
    # TODO: Replace with actual DB update
    # item = await db.get(Item, item_id)
    # if not item:
    #     raise HTTPException(status_code=404, detail="Not found")
    # if item.author_id != current_user["uid"]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    #
    # update_data = payload.model_dump(exclude_unset=True)
    # for key, value in update_data.items():
    #     setattr(item, key, value)
    # item.updated_at = datetime.utcnow()
    # await db.commit()
    # await db.refresh(item)
    # return item
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete an item. Only the author can delete."""
    # TODO: Replace with actual DB delete
    # item = await db.get(Item, item_id)
    # if not item:
    #     raise HTTPException(status_code=404, detail="Not found")
    # if item.author_id != current_user["uid"]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    # await db.delete(item)
    # await db.commit()
    pass


# ------------------------------------
# Register in main.py:
# from app.routers import items
# app.include_router(items.router)
# ------------------------------------
