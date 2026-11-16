"""TODO HTTP routes."""

from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status

from app.deps import get_current_user, get_todo_service
from app.models import User
from app.schemas import SortField, SortOrder, TodoCreate, TodoRead, TodoUpdate
from app.services.todos import TodoService, present_todo

router = APIRouter(prefix="/todos", tags=["todos"])

_OpenApiResponses = dict[int | str, dict[str, Any]]

_NOT_FOUND: _OpenApiResponses = {
    404: {
        "description": "TODO does not exist",
        "content": {"application/json": {"example": {"detail": "TODO not found"}}},
    }
}
_VALIDATION: _OpenApiResponses = {
    422: {
        "description": "The request body or query parameters are invalid",
        "content": {
            "application/json": {"example": {"detail": "title must not be empty or whitespace"}}
        },
    }
}


@router.get(
    "",
    response_model=list[TodoRead],
    summary="List TODOs",
    description=(
        "Returns matching TODO items. Filter with done. "
        "Page with limit (1-100) and offset. Omit limit to return every match. "
        "Sort with sort (created_at, updated_at, title) and order (asc, desc). "
        "Headers: X-Total-Count, X-Offset, and X-Limit when limit is set."
    ),
)
def list_todos(
    response: Response,
    done: bool | None = Query(
        None, description="When set, return only todos with this done status."
    ),
    limit: int | None = Query(
        None, ge=1, le=100, description="Page size. Omit to return all matches."
    ),
    offset: int = Query(0, ge=0, description="Number of matching todos to skip."),
    sort: SortField = Query("created_at", description="Field to sort by."),
    order: SortOrder = Query("desc", description="Sort direction."),
    service: TodoService = Depends(get_todo_service),
    user: User = Depends(get_current_user),
) -> list[TodoRead]:
    items, total = service.list_todos(
        user,
        done=done,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
    )
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Offset"] = str(offset)
    if limit is not None:
        response.headers["X-Limit"] = str(limit)
    return [present_todo(item) for item in items]


@router.get(
    "/{todo_id}",
    response_model=TodoRead,
    summary="Get a TODO",
    responses=_NOT_FOUND,
)
def get_todo(
    todo_id: int,
    service: TodoService = Depends(get_todo_service),
    user: User = Depends(get_current_user),
) -> TodoRead:
    return present_todo(service.get_todo(user, todo_id))


@router.post(
    "",
    response_model=TodoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a TODO",
    responses=_VALIDATION,
)
def create_todo(
    payload: TodoCreate,
    service: TodoService = Depends(get_todo_service),
    user: User = Depends(get_current_user),
) -> TodoRead:
    return present_todo(service.create_todo(user, payload))


@router.put(
    "/{todo_id}",
    response_model=TodoRead,
    summary="Update a TODO title and/or description",
    responses=_NOT_FOUND | _VALIDATION,
)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    service: TodoService = Depends(get_todo_service),
    user: User = Depends(get_current_user),
) -> TodoRead:
    return present_todo(service.update_todo(user, todo_id, payload))


@router.patch(
    "/{todo_id}/done",
    response_model=TodoRead,
    summary="Toggle a TODO done status",
    responses=_NOT_FOUND,
)
def toggle_done(
    todo_id: int,
    service: TodoService = Depends(get_todo_service),
    user: User = Depends(get_current_user),
) -> TodoRead:
    return present_todo(service.toggle_done(user, todo_id))


@router.delete(
    "/{todo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a TODO",
    responses=_NOT_FOUND,
)
def delete_todo(
    todo_id: int,
    service: TodoService = Depends(get_todo_service),
    user: User = Depends(get_current_user),
) -> Response:
    service.delete_todo(user, todo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
