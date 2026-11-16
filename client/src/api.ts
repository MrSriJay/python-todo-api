import type { AuthUser, NoteColor, Todo, TodoFilter, TodoSort } from "./types"

const TOKEN_KEY = "token"

let sessionEpoch = 0

export function endSession(): void {
  sessionEpoch += 1
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function authToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveToken(value: string): void {
  localStorage.setItem(TOKEN_KEY, value)
}

export function clearToken(): void {
  endSession()
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = authToken()
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: authHeaders({
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      }),
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
    if (response.status === 401) clearToken()
    throw new ApiError(detail, response.status)
  }

  return body as T
}

type AuthResponse = {
  access_token: string
  user: AuthUser
}

export async function signup(name: string, email: string, passcode: string): Promise<AuthUser | null> {
  const epoch = sessionEpoch
  const body = await request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, passcode }),
  })
  if (epoch !== sessionEpoch) return null
  saveToken(body.access_token)
  return body.user
}

export async function login(email: string, passcode: string): Promise<AuthUser | null> {
  const epoch = sessionEpoch
  const body = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, passcode }),
  })
  if (epoch !== sessionEpoch) return null
  saveToken(body.access_token)
  return body.user
}

export function currentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me")
}

export function resetPasscode(currentPasscode: string, newPasscode: string): Promise<void> {
  return request<void>("/api/auth/passcode", {
    method: "POST",
    body: JSON.stringify({
      current_passcode: currentPasscode,
      new_passcode: newPasscode,
    }),
  })
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
    response = await fetch(`/api/todos?${params.toString()}`, { headers: authHeaders() })
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
    if (response.status === 401) clearToken()
    throw new ApiError(detail, response.status)
  }

  const items = body as Todo[]
  const totalHeader = response.headers.get("X-Total-Count")
  const total = totalHeader === null ? items.length : Number(totalHeader)
  return { items, total: Number.isNaN(total) ? items.length : total }
}

export function createTodo(
  title: string,
  description: string | null,
  color: NoteColor,
): Promise<Todo> {
  return request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify({
      title,
      ...(description ? { description } : {}),
      color,
    }),
  })
}

export function updateTodo(
  id: number,
  patch: { title?: string; description?: string | null; color?: NoteColor },
): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  })
}

export function toggleTodo(id: number): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}/done`, { method: "PATCH" })
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, { method: "DELETE" })
}
