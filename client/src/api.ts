import type { Todo, TodoFilter, TodoSort } from "./types"

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError("Could not reach the API. Start the backend on port 8000.")
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const detail =
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`
    throw new ApiError(detail)
  }

  return body as T
}

export async function listTodos(
  filter: TodoFilter,
  sort: TodoSort,
): Promise<{ items: Todo[]; total: number }> {
  const params = new URLSearchParams()
  if (filter === "open") params.set("done", "false")
  if (filter === "done") params.set("done", "true")
  if (sort === "title") {
    params.set("sort", "title")
    params.set("order", "asc")
  } else {
    params.set("sort", "created_at")
    params.set("order", sort === "oldest" ? "asc" : "desc")
  }

  let response: Response
  try {
    response = await fetch(`/api/todos?${params.toString()}`)
  } catch {
    throw new ApiError("Could not reach the API. Start the backend on port 8000.")
  }

  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : null
  if (!response.ok) {
    const detail =
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`
    throw new ApiError(detail)
  }

  const items = body as Todo[]
  const totalHeader = response.headers.get("X-Total-Count")
  const total = totalHeader === null ? items.length : Number(totalHeader)
  return { items, total: Number.isNaN(total) ? items.length : total }
}

export function createTodo(title: string, description: string | null): Promise<Todo> {
  return request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify(description ? { title, description } : { title }),
  })
}

export function updateTodo(
  id: number,
  title: string,
  description: string | null,
): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title, description }),
  })
}

export function toggleTodo(id: number): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}/done`, { method: "PATCH" })
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, { method: "DELETE" })
}
