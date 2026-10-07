# E-Commerce Backend API

A college-level E-Commerce REST API built with **Node.js, Express, MongoDB (Mongoose), JWT, bcryptjs, Helmet, CORS, Morgan and Express Rate Limit**. CommonJS syntax is used throughout.

## Setup

```bash
npm install
# edit .env (see .env.example)
npm run seed     # optional: sample users and products (deletes existing data!)
npm run dev      # development with nodemon
npm start        # production
```

`.env`:

```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/ecommerce
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRE=30d
```

Seeded accounts (`npm run seed`):

| Role | Email | Password |
|---|---|---|
| admin | admin@example.com | Admin123 |
| moderator | mod@example.com | Moderator123 |
| user | user@example.com | User1234 |

## Project structure

```
config/db.mongo.js      MongoDB connection
controllers/            request handling (auth, health, product, user, cart, order, review)
middlewares/            authMiddleware (protect, authorize), errorHandler, rateLimiter, validateRequest
models/                 Mongoose schemas
routes/                 endpoints
utils/                  jwt.js, appVersion.js
seeder.js               manual sample data
server.js               app setup and startup
```

## Response format

```json
{ "success": true, "message": "Product fetched successfully", "data": {} }
{ "success": false, "error": "Product not found" }
{ "success": true, "data": [], "pagination": { "page": 1, "limit": 10, "total": 50, "pages": 5 } }
```

Status codes: 200, 201, 400 (bad input), 401 (not logged in / bad token), 403 (no permission), 404, 409 (conflict), 429 (rate limit), 500, and 503 (health check when the database is down).

## Postman basics

- Body requests: Body, raw, JSON (header `Content-Type: application/json`).
- Protected routes: header `Authorization: Bearer <JWT_TOKEN>` (or the Authorization tab, type Bearer Token). Get the token from `/api/auth/login`.

## Roles

| Role | Permissions |
|---|---|
| user | view products; own cart; create and view own orders; create, update and delete own reviews |
| moderator | everything a user can do, plus create and update products |
| admin | everything, plus delete products, manage users, view and update all orders |

## Endpoints

### Health
| Method | URL | Access |
|---|---|---|
| GET | /api/health | public (503 if the database is disconnected) |
| GET | /api/version | public |

### Auth
| Method | URL | Access | Body |
|---|---|---|---|
| POST | /api/auth/register | public | `{ "name", "email", "password" }` (password: 6+ chars, letter and number). Role is always `user`. |
| POST | /api/auth/login | public | `{ "email", "password" }` returns `token` and `user` |
| GET | /api/auth/me | logged in | none |

Errors: 400 invalid input, 409 duplicate email, 401 wrong credentials / missing or bad token.

### Users (admin only)
| Method | URL | Notes |
|---|---|---|
| GET | /api/users?role=&page=&limit= | list users |
| GET | /api/users/:id | single user |
| PUT | /api/users/:id | body: any of `name`, `email`, `role`, `password`. You cannot change your own role. |
| DELETE | /api/users/:id | removes the user, cart and reviews. You cannot delete yourself. Orders are kept. |

### Products
| Method | URL | Access |
|---|---|---|
| GET | /api/products | public |
| GET | /api/products/:id | public |
| POST | /api/products | moderator, admin |
| PUT | /api/products/:id | moderator, admin (use `{ "stock": 50 }` for stock management) |
| DELETE | /api/products/:id | admin (also deletes the product's reviews) |

List query parameters: `search`, `category` (electronics, clothing, food, books, other), `minPrice`, `maxPrice`, `sort` (newest, oldest, price_asc, price_desc, name), `page`, `limit` (max 100).

Create body:

```json
{
  "name": "Wireless Headphones",
  "description": "Bluetooth over-ear headphones with noise cancellation",
  "price": 2999,
  "category": "electronics",
  "brand": "SoundMax",
  "images": ["https://example.com/headphones.jpg"],
  "stock": 25
}
```

### Cart (login required, each user only sees their own cart)
| Method | URL | Body |
|---|---|---|
| GET | /api/cart | none |
| POST | /api/cart/items | `{ "productId": "<id>", "quantity": 2 }` |
| PUT | /api/cart/items/:productId | `{ "quantity": 3 }` |
| DELETE | /api/cart/items/:productId | none |
| DELETE | /api/cart | none |

Checks: product exists, is in stock, quantity is a whole number above zero, and quantity does not exceed stock.

### Orders (login required)
| Method | URL | Access |
|---|---|---|
| POST | /api/orders | any logged-in user |
| GET | /api/orders | own orders |
| GET | /api/orders/all | admin (filters: `orderStatus`, `paymentStatus`, `page`, `limit`) |
| GET | /api/orders/:id | owner or admin |
| PUT | /api/orders/:id/status | admin |

Create order body (if `items` is left out, the order is created from your cart and the cart is emptied):

```json
{
  "items": [{ "productId": "<id>", "quantity": 2 }],
  "shippingAddress": {
    "fullName": "Test User",
    "phone": "9876543210",
    "street": "12 Park Street",
    "city": "Kolkata",
    "state": "West Bengal",
    "postalCode": "700016",
    "country": "India"
  },
  "paymentMethod": "mock_card"
}
```

- Prices and `totalAmount` are always calculated by the server. Any `totalAmount` sent by the client is ignored.
- Stock is reduced when the order is created. If anything fails, the stock changes are rolled back.
- Mock payment: `mock_card` gives `paymentStatus: "paid"`, `cash_on_delivery` stays `pending`. No real gateway is used.

Status update body: `{ "orderStatus": "confirmed" }` and/or `{ "paymentStatus": "paid" }`.

Allowed order status flow: pending to confirmed to processing to shipped to delivered. An order can be cancelled until it is shipped. Cancelling restores stock and marks a paid order `refunded`. Delivered and cancelled orders cannot change status.

### Reviews
| Method | URL | Access |
|---|---|---|
| GET | /api/products/:productId/reviews | public |
| POST | /api/products/:productId/reviews | logged in (one review per product per user, otherwise 409) |
| PUT | /api/products/:productId/reviews/:reviewId | review owner |
| DELETE | /api/products/:productId/reviews/:reviewId | review owner |

Body: `{ "rating": 5, "comment": "Great product" }` (rating is a whole number from 1 to 5). The product's `ratings.average` and `ratings.count` update automatically.

## Suggested Postman test flow

1. `npm run seed`, then log in as admin, moderator and user and save the three tokens.
2. Products: create (moderator), list with filters, update stock, try delete as moderator (403) and as admin (200).
3. Cart: add item, add the same item again, exceed stock (400), update, remove, clear.
4. Orders: create from cart, create with `items`, view own orders, user calls `/api/orders/all` (403), admin updates status through the flow, cancel and check stock is restored.
5. Reviews: create, repeat (409), update, delete, check the product's `ratings`.
6. Errors: no token (401), bad ObjectId (400), unknown route (404).
