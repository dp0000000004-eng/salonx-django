// The legacy resource API accepts arbitrary model fields, so its compatibility boundary is dynamic.
/* eslint-disable @typescript-eslint/no-explicit-any */
const API_URL = (import.meta.env["VITE_API_URL"] || "http://127.0.0.1:8000/api").replace(/\/$/, "");

type ApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
  retryAfter?: number;
};
// Compatibility endpoints return resource-specific row shapes, so keep the dynamic boundary explicit.
type ApiRow = any;
type ApiResult<T = ApiRow[]> = { data: T | null; error: ApiError | null; count?: number | null };

const tokenKey = "salonx_access_token";
const refreshKey = "salonx_refresh_token";

function authHeaders(extra: Record<string, string> = {}) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(tokenKey) : null;
  return {
    Accept: "application/json",
    ...(!extra["Content-Type"] && { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function normalizeError(body: any, status?: number, retryAfter?: number): ApiError {
  const metadata = {
    ...(status !== undefined && { status }),
    ...(retryAfter !== undefined && { retryAfter }),
  };
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const message =
      body.error ||
      body.detail ||
      body.message ||
      Object.entries(body)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join("; ");
    return {
      message: message || `HTTP ${status ?? 0}`,
      ...metadata,
      ...(typeof body.code === "string" && { code: body.code }),
      details: body,
    };
  }
  return {
    message: String(body || `HTTP ${status ?? 0}`),
    ...metadata,
  };
}

/** Keeps the old frontend contract compatible with Django field names. */
function toBackendPayload(payload: any): any {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const out = { ...payload };
  const aliases: Record<string, string> = {
    pin_code: "pincode",
    duration_min: "duration_minutes",
    booking_date: "date",
    slot_time: "start_time",
    package_id: "wedding_package",
    salon_id: "salon",
    customer_id: "customer",
    service_id: "service",
    hairstyle_id: "hairstyle",
    category_id: "category",
    owner_id: "owner",
    user_id: "user",
    parent_id: "parent",
    plan_id: "plan",
    booking_id: "booking",
    created_salon_id: "created_salon",
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (out[from] !== undefined && out[to] === undefined) out[to] = out[from];
    if (from !== to) delete out[from];
  }
  return out;
}

function normalizeRow(row: any): any {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const out = { ...row };
  if (out.pincode !== undefined && out.pin_code === undefined) out.pin_code = out.pincode;
  if (out.cover_image_url && !out.image_url) out.image_url = out.cover_image_url;
  if (out.description !== undefined && out.about === undefined) out.about = out.description;
  if (out.date !== undefined && out.booking_date === undefined) out.booking_date = out.date;
  if (out.start_time !== undefined && out.slot_time === undefined) out.slot_time = out.start_time;
  if (out.duration_minutes !== undefined && out.duration_min === undefined)
    out.duration_min = out.duration_minutes;
  if (out.wedding_package_id !== undefined && out.package_id === undefined)
    out.package_id = out.wedding_package_id;
  if (out.customer_id !== undefined && out.user_id === undefined) out.user_id = out.customer_id;
  const foreignKeys = [
    "owner",
    "salon",
    "customer",
    "service",
    "hairstyle",
    "wedding_package",
    "booking",
    "user",
    "plan",
    "category",
    "parent",
    "created_salon",
  ];
  for (const key of foreignKeys) {
    const idKey = `${key}_id`;
    if (
      out[key] !== undefined &&
      out[idKey] === undefined &&
      (typeof out[key] === "string" || typeof out[key] === "number")
    ) {
      out[idKey] = out[key];
    }
  }
  return out;
}

function normalizeData(data: any): any {
  if (Array.isArray(data)) return data.map(normalizeRow);
  return normalizeRow(data);
}

async function request<T = any>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
    });

    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    // Access-token refresh once, then retry the original request.
    if (response.status === 401 && retry && typeof localStorage !== "undefined") {
      const refresh = localStorage.getItem(refreshKey);
      if (refresh && !path.startsWith("/auth/refresh/")) {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (refreshResponse.ok) {
          const refreshed = await refreshResponse.json();
          localStorage.setItem(tokenKey, refreshed.access);
          return request<T>(path, init, false);
        }
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(refreshKey);
        localStorage.removeItem("salonx_user");
      }
    }

    if (!response.ok) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      return {
        data: null,
        error: normalizeError(
          body,
          response.status,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        ),
      };
    }

    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.prototype.hasOwnProperty.call(body, "data") &&
      Object.prototype.hasOwnProperty.call(body, "count")
    ) {
      return { data: normalizeData(body.data) as T, error: null, count: Number(body.count) };
    }
    return { data: normalizeData(body) as T, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: {
        message: error?.message || "Cannot connect to Django backend. Is localhost:8000 running?",
      },
    };
  }
}

type QueryOptions = { count?: "exact" | "planned" | "estimated"; head?: boolean };

class QueryBuilder<T = ApiRow[]> implements PromiseLike<ApiResult<T>> {
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private body: any;
  private params = new URLSearchParams();
  private options: QueryOptions = {};

  constructor(private readonly resource: string) {}

  select(_columns = "*", options: QueryOptions = {}) {
    this.options = options;
    this.params.set("select", _columns);
    if (options.count) this.params.set("count", options.count);
    if (options.head) this.params.set("head", "1");
    return this;
  }

  eq(field: string, value: any) {
    this.params.set(field, String(value));
    return this;
  }
  neq(field: string, value: any) {
    this.params.set(`${field}__neq`, String(value));
    return this;
  }
  in(field: string, values: any[]) {
    this.params.set(`${field}__in`, values.join(","));
    return this;
  }
  is(field: string, value: any) {
    this.params.set(`${field}__is`, String(value));
    return this;
  }
  gte(field: string, value: any) {
    this.params.set(`${field}__gte`, String(value));
    return this;
  }
  lte(field: string, value: any) {
    this.params.set(`${field}__lte`, String(value));
    return this;
  }
  gt(field: string, value: any) {
    this.params.set(`${field}__gt`, String(value));
    return this;
  }
  lt(field: string, value: any) {
    this.params.set(`${field}__lt`, String(value));
    return this;
  }
  ilike(field: string, value: any) {
    this.params.set(`${field}__ilike`, String(value));
    return this;
  }
  or(expression: string) {
    this.params.set("or", expression);
    return this;
  }
  not(field: string, operator: string, value: any) {
    this.params.set(`${field}__not_${operator}`, String(value));
    return this;
  }
  filter(field: string, operator: string, value: any) {
    this.params.set(`${field}__${operator}`, String(value));
    return this;
  }

  order(field: string, opts: { ascending?: boolean } = {}) {
    const order = `${opts.ascending === false ? "-" : ""}${field}`;
    const existing = this.params.get("order");
    this.params.set("order", existing ? `${existing},${order}` : order);
    return this;
  }

  limit(n: number) {
    this.params.set("limit", String(n));
    return this;
  }

  range(from: number, to: number) {
    this.params.set("offset", String(from));
    this.params.set("limit", String(to - from + 1));
    return this;
  }

  single() {
    this.params.set("single", "1");
    return this as unknown as QueryBuilder<ApiRow>;
  }
  maybeSingle() {
    this.params.set("single", "1");
    this.params.set("maybe_single", "1");
    return this as unknown as QueryBuilder<ApiRow>;
  }

  insert(payload: any) {
    this.method = "POST";
    this.body = toBackendPayload(Array.isArray(payload) ? payload[0] : payload);
    return this;
  }

  update(payload: any) {
    this.method = "PATCH";
    this.body = toBackendPayload(payload);
    return this;
  }
  delete() {
    this.method = "DELETE";
    return this;
  }

  upsert(payload: any, options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.method = "POST";
    this.body = toBackendPayload(Array.isArray(payload) ? payload[0] : payload);
    if (options.onConflict) this.params.set("on_conflict", options.onConflict);
    if (options.ignoreDuplicates) this.params.set("ignore_duplicates", "1");
    return this;
  }

  then<TResult1 = ApiResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const path = `/db/${encodeURIComponent(this.resource)}/${
      this.params.toString() ? `?${this.params.toString()}` : ""
    }`;

    return request<T>(path, {
      method: this.method,
      ...(this.method !== "GET" && this.method !== "DELETE" && { body: JSON.stringify(this.body) }),
    })
      .then((result) => {
        return result;
      })
      .then(onfulfilled as any, onrejected as any);
  }
}

const authListeners = new Set<(event: string, session: any) => void>();
function emitAuth(event: string, session: any) {
  authListeners.forEach((callback) => callback(event, session));
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await request<any>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (result.data) {
      localStorage.setItem(tokenKey, result.data.access);
      localStorage.setItem(refreshKey, result.data.refresh);
      localStorage.setItem("salonx_user", JSON.stringify(result.data.user));
      emitAuth("SIGNED_IN", {
        access_token: result.data.access,
        refresh_token: result.data.refresh,
        user: result.data.user,
      });
    }
    return result.data
      ? {
          data: {
            user: result.data.user,
            session: { access_token: result.data.access, refresh_token: result.data.refresh },
          },
          error: null,
        }
      : { data: { user: null, session: null }, error: result.error };
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: {
      emailRedirectTo?: string;
      data?: { full_name?: string; phone?: string; role?: string };
    };
  }) {
    const data = options?.data || {};
    const result = await request<any>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: data.full_name || "",
        phone: data.phone || "",
        role: data.role || "customer",
      }),
    });
    if (result.data) {
      localStorage.setItem(tokenKey, result.data.access);
      localStorage.setItem(refreshKey, result.data.refresh);
      localStorage.setItem("salonx_user", JSON.stringify(result.data.user));
      emitAuth("SIGNED_IN", {
        access_token: result.data.access,
        refresh_token: result.data.refresh,
        user: result.data.user,
      });
    }
    return result.data
      ? {
          data: {
            user: result.data.user,
            session: { access_token: result.data.access, refresh_token: result.data.refresh },
          },
          error: null,
        }
      : { data: { user: null, session: null }, error: result.error };
  },

  async setSession({
    access_token,
    refresh_token,
    user,
  }: {
    access_token: string;
    refresh_token: string;
    user: Record<string, unknown>;
  }) {
    localStorage.setItem(tokenKey, access_token);
    localStorage.setItem(refreshKey, refresh_token);
    localStorage.setItem("salonx_user", JSON.stringify(user));
    const session = { access_token, refresh_token, user };
    emitAuth("SIGNED_IN", session);
    return { data: { session, user }, error: null };
  },

  async getUser() {
    const result = await request<any>("/auth/me/");
    return { data: { user: result.data }, error: result.error };
  },

  async getSession() {
    const token = localStorage.getItem(tokenKey);
    const user = localStorage.getItem("salonx_user");
    return {
      data: {
        session: token
          ? {
              access_token: token,
              refresh_token: localStorage.getItem(refreshKey),
              user: user ? JSON.parse(user) : null,
            }
          : null,
      },
      error: null,
    };
  },

  async signOut() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(refreshKey);
    localStorage.removeItem("salonx_user");
    emitAuth("SIGNED_OUT", null);
    return { error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    authListeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          },
        },
      },
    };
  },

  async updateUser({ password }: { password: string }) {
    return request("/auth/password/", { method: "POST", body: JSON.stringify({ password }) });
  },

  async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
    return request("/auth/password-reset/", { method: "POST", body: JSON.stringify({ email }) });
  },

  async resend(_opts: { type: string; email: string; options?: { emailRedirectTo?: string } }) {
    return {
      data: null,
      error: { message: "Email verification is not configured for this backend.", status: 501 },
    };
  },
};

const storage = {
  from(_bucket: string) {
    return {
      async upload(
        path: string,
        file: File | Blob,
        _options?: { cacheControl?: string; upsert?: boolean; contentType?: string },
      ) {
        const form = new FormData();
        form.append("file", file);
        form.append("path", path);
        try {
          const response = await fetch(`${API_URL}/media/upload/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey) || ""}` },
            body: form,
          });
          const body = await response.json();
          return response.ok
            ? { data: { path: body.path }, error: null }
            : { data: null, error: normalizeError(body, response.status) };
        } catch (error: any) {
          return { data: null, error: { message: error?.message || "Upload failed" } };
        }
      },

      getPublicUrl(path: string) {
        return { data: { publicUrl: `${API_URL.replace(/\/api$/, "")}/media/${path}` } };
      },

      async remove(_paths: string[]) {
        return { data: null, error: null };
      },

      async createSignedUrl(path: string, _expires: number) {
        return {
          data: { signedUrl: `${API_URL.replace(/\/api$/, "")}/media/${path}` },
          error: null,
        };
      },
    };
  },
};

const channels = new Set<any>();

function channel(name: string) {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  const ch = {
    on(_event: string, _config: any, callback: () => void) {
      listeners.add(callback);
      return ch;
    },
    subscribe() {
      // Django currently has no websocket endpoint. Polling is used as a safe local-dev fallback.
      timer = setInterval(() => listeners.forEach((callback) => callback()), 5000);
      channels.add(ch);
      return ch;
    },
    unsubscribe() {
      if (timer) clearInterval(timer);
      listeners.clear();
      channels.delete(ch);
    },
  };

  void name;
  return ch;
}

const api = {
  from: (resource: string) => new QueryBuilder(resource),
  adminStatus: async () => request<{ super_admin_count: number }>("/admin/status/"),
  nearbySalons: async (latitude: number, longitude: number, limit = 200) => {
    const params = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
      limit: String(limit),
    });
    return request<{ salon_id: string; distance_km: number }[]>(
      `/salons/nearby/?${params.toString()}`,
    );
  },
  reverseGeocode: async (latitude: number, longitude: number) => {
    const params = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
    });
    return request<{
      address: string;
      area: string;
      district: string;
      state: string;
      pinCode: string;
    }>(`/locations/reverse-geocode/?${params.toString()}`);
  },
  rpc: async (name: string, args: Record<string, any> = {}) =>
    request(`/rpc/${encodeURIComponent(name)}/`, { method: "POST", body: JSON.stringify(args) }),
  auth,
  storage,
  channel,
  removeChannel: async (ch: any) => {
    ch?.unsubscribe?.();
    channels.delete(ch);
    return { error: null };
  },
};

export { api, API_URL };
