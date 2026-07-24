# Odofy Backend API

Delivery routing platform connecting Shopify merchants with independent drivers.

Base URL: `http://localhost:3001`

## Authentication

| Method | Header | Used By |
|--------|--------|---------|
| API Key | `x-api-key: <api_secret_key>` | Merchants |
| Bearer Token | `Authorization: Bearer <auth_token>` | Drivers |
| HMAC-SHA256 | `x-shopify-hmac-sha256` + raw body | Shopify webhooks |

---

## Endpoints

### 1. Register Driver

```
POST /api/v1/odofy/drivers/register
```

**Auth:** None

**Request:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+15551234567"
}
```

**Response 201:**
```json
{
  "uuid": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+15551234567",
  "auth_token": "a1b2c3...",
  "status": "ACTIVE",
  "current_latitude": null,
  "current_longitude": null,
  "location_updated_at": null,
  "created_at": "2026-07-24T12:00:00.000Z"
}
```

**Errors:** `400` missing fields, `409` phone already registered, `500` server error.

---

### 2. Update Driver Location

```
POST /api/v1/odofy/drivers/location
```

**Auth:** Driver (`Authorization: Bearer <auth_token>`)

**Request:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response 200:**
```json
{
  "status": "location_updated"
}
```

**Errors:** `400` invalid/missing lat/lng, `401` invalid token, `500` server error.

---

### 3. Register Merchant

```
POST /api/v1/odofy/merchants/register
```

**Auth:** None

**Request:**
```json
{
  "business_name": "Downtown Bikes",
  "storefront_address": "123 Main St, New York, NY 10001",
  "shop_domain": "downtown-bikes.myshopify.com"
}
```

`shop_domain` is optional. The storefront address is geocoded on registration.

**Response 201:**
```json
{
  "uuid": "b290f1ee-6c54-4b01-90e6-d701748f0852",
  "business_name": "Downtown Bikes",
  "storefront_address": "123 Main St, New York, NY 10001",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "api_secret_key": "d3e4f5...",
  "shop_domain": "downtown-bikes.myshopify.com",
  "created_at": "2026-07-24T12:00:00.000Z"
}
```

**Errors:** `400` missing fields / geocoding failure, `500` server error.

---

### 4. Shopify Webhook (Create Trip)

```
POST /api/v1/odofy/integrations/shopify
```

**Auth:** Shopify HMAC-SHA256 (`x-shopify-hmac-sha256` header) + `x-shopify-shop-domain` header.

The raw JSON body from Shopify's order creation webhook is verified against the configured `SHOPIFY_WEBHOOK_SECRET`. The shop domain is matched to a registered merchant. The delivery address is geocoded and checked against the merchant's 4.33-mile delivery radius.

**Response 201** (within radius):
```json
{
  "uuid": "c290f1ee-6c54-4b01-90e6-d701748f0853",
  "merchant_id": "b290f1ee-...",
  "customer_name": "John Doe",
  "customer_phone": "+15559876543",
  "delivery_address": "456 Park Ave, New York, NY 10022",
  "dest_latitude": 40.7600,
  "dest_longitude": -73.9720,
  "status": "PENDING_PICKUP",
  "driver_id": null,
  "created_at": "2026-07-24T12:00:00.000Z"
}
```

**Response 200** (outside radius):
```json
{
  "status": "rejected",
  "reason": "outside_delivery_radius",
  "trip": { ... }
}
```

**Errors:** `400` missing shop domain / no matching merchant / missing phone or address / geocoding failure, `401` missing/invalid HMAC, `500` server error.

---

### 5. Create Trip Manually

```
POST /api/v1/odofy/trips/manual
```

**Auth:** Merchant (`x-api-key: <api_secret_key>`)

**Request:**
```json
{
  "customer_name": "Alice Johnson",
  "customer_phone": "+15551112222",
  "delivery_address": "789 Broadway, New York, NY 10003"
}
```

The delivery address is geocoded and checked against the authenticated merchant's 4.33-mile radius.

**Response 201** (within radius):
```json
{
  "uuid": "d290f1ee-6c54-4b01-90e6-d701748f0854",
  "merchant_id": "b290f1ee-...",
  "customer_name": "Alice Johnson",
  "customer_phone": "+15551112222",
  "delivery_address": "789 Broadway, New York, NY 10003",
  "dest_latitude": 40.7300,
  "dest_longitude": -73.9900,
  "status": "PENDING_PICKUP",
  "driver_id": null,
  "created_at": "2026-07-24T12:00:00.000Z"
}
```

**Response 200** (outside radius):
```json
{
  "status": "rejected",
  "reason": "outside_delivery_radius",
  "trip": { ... }
}
```

**Errors:** `400` missing fields / geocoding failure, `401` invalid API key, `500` server error.

---

### 6. List Available Trips

```
GET /api/v1/odofy/trips/available
```

**Auth:** Driver (`Authorization: Bearer <auth_token>`)

**Request:** No body.

**Response 200:**
```json
[
  {
    "uuid": "e290f1ee-...",
    "merchant_id": "b290f1ee-...",
    "customer_name": "Alice Johnson",
    "customer_phone": "+15551112222",
    "delivery_address": "789 Broadway, New York, NY 10003",
    "dest_latitude": 40.7300,
    "dest_longitude": -73.9900,
    "status": "PENDING_PICKUP",
    "driver_id": null,
    "created_at": "2026-07-24T12:00:00.000Z"
  }
]
```

Returns all trips with status `PENDING_PICKUP`, ordered by creation time (oldest first).

**Errors:** `401` invalid token, `500` server error.

---

### 7. Update Trip Status

```
PATCH /api/v1/odofy/trips/:id/status
```

**Auth:** Driver (`Authorization: Bearer <auth_token>`)

**Request:**
```json
{
  "status": "EN_ROUTE"
}
```

Valid status transitions:

| Status | Allowed from | Notes |
|--------|-------------|-------|
| `EN_ROUTE` | `PENDING_PICKUP` | Claims the trip for this driver |
| `DELIVERED` | `EN_ROUTE` | Driver must own the trip |
| `CANCELLED` | `PENDING_PICKUP`, `EN_ROUTE` | Driver must own if claimed |

SMS notifications are sent to the customer on `EN_ROUTE` and `DELIVERED` transitions (fire-and-forget).

**Response 200:**
```json
{
  "uuid": "e290f1ee-...",
  "merchant_id": "b290f1ee-...",
  "customer_name": "Alice Johnson",
  "customer_phone": "+15551112222",
  "delivery_address": "789 Broadway, New York, NY 10003",
  "dest_latitude": 40.7300,
  "dest_longitude": -73.9900,
  "status": "EN_ROUTE",
  "driver_id": "a290f1ee-...",
  "created_at": "2026-07-24T12:00:00.000Z"
}
```

**Errors:** `400` invalid/missing status / invalid transition / trip already claimed / trip does not belong to driver, `401` invalid token, `500` server error.

---

## Rate Limiting

All endpoints are rate-limited to **100 requests per minute per IP address**. Exceeding the limit returns:

```json
{
  "error": "Too many requests"
}
```

With a `Retry-After` header indicating seconds until the window resets.

---

## Delivery Radius

All trips are geofenced to a **4.33-mile radius** from the merchant's storefront. Trips outside this radius are created with `status: "REJECTED"` and a `reason: "outside_delivery_radius"` field.
