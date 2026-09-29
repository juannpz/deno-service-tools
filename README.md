# Deno Service Tools Library 🚀

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Deno](https://img.shields.io/badge/Deno-000000?style=for-the-badge&logo=deno&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![JSR](https://img.shields.io/badge/JSR-Package-F7DF1E?style=for-the-badge)](https://jsr.io/@juannpz/deno-service-tools)

A lightweight, type-safe library for building robust backend services in **Deno** with **Hono**, featuring dynamic routing, validation, JWT authentication, and more.

## ✨ Features

### 🌐 Server Building
- **Type-Safe Routing**: Full TypeScript support for request/response types
- **Dynamic Parameters**: Path, query, and header parameter handling with type inference
- **Request Validation**: Built-in validators for parameters and request bodies  
- **Context Variables**: Type-safe context variable management
- **Custom Middleware**: Easy middleware integration
- **Rate Limiting**: Built-in rate limiting capabilities

### 🔐 Authentication
- **JWT Management**: Complete JWT creation and validation
- **Type-Safe Payloads**: Full typing support for JWT payloads
- **Secure Configuration**: Easy-to-use JWT configuration options

### 🛠️ Utilities  
- **Environment Variables**: Validated environment variable management
- **Error Handling**: Consistent error responses with proper HTTP status codes
- **Response Builders**: Helper functions for standardized API responses

## 📦 Installation

```bash
deno add jsr:@juannpz/deno-service-tools
```

## 🚀 Quick Start

### Create a Complete API Server

```typescript
import { createServer, Router, ServerBuilder, ContextVariables } from "@juannpz/deno-service-tools";

// Define your context variables interface
interface IContextVariables extends ContextVariables {
  userId?: number;
}

// Create GET route with full type safety
const getUserRoute = Router.get<IContextVariables>("/users/:user_id")
  .describe("User retrieval")
  .pathParam("user_id", { required: true })
  .queryParam<"format", "object" | "array">("format", { required: true })
  .headerParam("Authorization")
  .withVariables<IContextVariables>()
  .handler(async (context) => {
    const { user_id } = context.params;
    const { format } = context.query;
    
    // Your database logic here
    const result = await db.query({
      table: "users",
      conditions: { user_id },
      format
    });
    
    return context.c.json({
      message: `Found ${result.rowCount} rows`,
      data: result.rows
    }, 200);
  });

// Create POST route with body validation
const createUserRoute = Router.post<IContextVariables>("/users")
  .describe("User creation")
  .body<{ metadata: Record<string, unknown>; user_status_id: number }>()
  .queryParam<"format", "object" | "array">("format", { required: true })
  .headerParam("Authorization")
  .handler(async (context) => {
    const { metadata, user_status_id } = context.body;
    const { format } = context.query;
    
    // Create user logic
    const result = await db.create({
      table: "users",
      data: { metadata, user_status_id },
      format
    });
    
    return context.c.json({
      message: "User created successfully",
      data: result.rows
    }, 201);
  });

// Initialize server with grouped routes and middleware
const server = createServer<IContextVariables>();

server.group("/v1/crud", (app) => {
  [getUserRoute, createUserRoute].forEach(route => {
    route.useMiddleware(authMiddleware);
    route.register(app);
  });
});

// Start the server
server.start();
```

### JWT Authentication & Request Handling

```typescript
import { JWTManager, createResponseFromFetch, buildAuthHeaders } from "@juannpz/deno-service-tools";

// Initialize JWT
JWTManager.init("your-secret-key");

// Generate JWT with typed payload
interface UserPayload {
  userId: number;
  email: string;
}

const tokenResult = await JWTManager.generate<UserPayload>(
  { alg: "HS256" },
  { userId: 123, email: "user@example.com" },
  keyGenerationConfig
);

// Build auth headers
const headers = buildAuthHeaders(tokenResult.data);

// Make authenticated request with error handling
const response = await createResponseFromFetch<{ message: string; data: any[] }>(
  fetch("http://localhost:3000/api/users", {
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    method: "POST",
    body: JSON.stringify({ metadata: { name: "test" } })
  })
);

if (response.success) {
  console.log("Success:", response.data);
} else {
  console.error(`Error: ${response.message}`);
}
```

### Middleware & Route Grouping

```typescript
// Custom middleware
async function authMiddleware(c: Context, next: () => Promise<void>) {
  const token = c.req.header("Authorization");
  if (!token) {
    return c.json({ error: "Missing auth token" }, 401);
  }
  
  const result = await JWTManager.verify<UserPayload>(token, config);
  if (!result.success) {
    return c.json({ error: result.message }, 401);
  }
  
  c.set("userId", result.data.userId);
  await next();
}

// Group routes with shared middleware
function addRoutes(server: ServerBuilder<IContextVariables>) {
  return server.group("/api/v1", (app) => {
    const routes = [userRoute, postRoute, deleteRoute];
    
    routes.forEach(route => {
      route
        .useMiddleware(authMiddleware)
        .useMiddleware(rateLimitMiddleware)
        .register(app);
    });
  });
}
```

### Environment Variables & Config

```typescript
import { getEnvOrThrow } from "@juannpz/deno-service-tools";

interface Config {
  DB_HOST: string;
  DB_PORT: number;
  JWT_SECRET: string;
}

// Validate and get all required env vars
const config: Config = {
  DB_HOST: getEnvOrThrow("DB_HOST"),
  DB_PORT: Number(getEnvOrThrow("DB_PORT")),
  JWT_SECRET: getEnvOrThrow("JWT_SECRET"),
};

// Initialize services with config
JWTManager.init(config.JWT_SECRET);
DatabaseManager.init(config);
```

## 📖 API Reference

### Router Methods

- `Router.get(path)` - Create GET route
- `Router.post(path)` - Create POST route  
- `Router.put(path)` - Create PUT route
- `Router.delete(path)` - Create DELETE route
- `Router.patch(path)` - Create PATCH route

### Route Methods

- `.pathParam(name, options)` - Add path parameter
- `.queryParam(name, options)` - Add query parameter
- `.headerParam(name, options)` - Add header parameter
- `.body<T>()` - Define request body type
- `.handler(fn)` - Set route handler
- `.useMiddleware(fn)` - Add middleware
- `.rateLimit(options)` - Add rate limiting
- `.authenticate(strategy)` - Add authentication

### Result & Typed Errors

`Result<T>` is `OkResult<T> | ErrResult`. Both an HTTP status and a stable,
machine-readable error code can travel with a failure, so handlers do not need
to parse messages to decide the response status:

```typescript
import { ResUtil, buildRequestResponse } from "@juannpz/deno-service-tools";

// Legacy usage is unchanged.
ResUtil.Fail("Something failed", error);

// Attach an explicit HTTP status and a stable error code.
ResUtil.Fail("User lacks permission", undefined, {
  code: 403,
  errorCode: "FORBIDDEN",
});

// Same, without an underlying error object.
ResUtil.FailWith("The upstream rejected the request", {
  code: 422,
  errorCode: "UPSTREAM_REJECTED",
});

const response = buildRequestResponse(result);
// → { success: false, message, detail?, code, errorCode?, extra? }
```

`buildRequestResponse` precedence for the status:
`ErrResult.code` (explicit) → `HttpFetchError`/`Response` status → `500`.
Everything else (including the absence of `code`/`errorCode`) keeps the exact
previous behavior, so the change is backward compatible.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with ❤️ using:
- [Deno](https://deno.land/)
- [Hono](https://hono.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [djwt](https://deno.land/x/djwt)

---

<p align="center">Made by <a href="https://github.com/juannpz">juannpz</a></p>
