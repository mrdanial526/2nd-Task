# AeroGrid — Autonomous Drone Dispatch & Telemetry API

> **Backend RESTful API Service**  
> Engineered with **Dual-Layer Gatekeeper Validation** (Syntactic & Semantic), a **Deterministic State Machine Engine**, and **Sliding-Window Rate Limiting**.

---

## 🚀 Key Highlights

- **Dual-Layer Gatekeeper Architecture**:
  - **Layer 1 (Syntactic)**: Validates types, ranges, regex, and bounds using **Zod** schemas $\to$ returns `400 Bad Request`.
  - **Layer 2 (Semantic)**: Enforces business logic and physics constraints (e.g. payload weight limit, turbulence altitude caps, battery reserves) $\to$ returns `422 Unprocessable Entity`.
- **Deterministic State Engine**: Enforces strict lifecycle transitions (`IDLE` $\to$ `DISPATCHED` $\to$ `IN_FLIGHT` $\to$ `DELIVERED` / `ABORTED`) $\to$ returns `409 Conflict` on illegal hops.
- **RESTful Design & Semantic HTTP Codes**: Standardized JSON envelopes using `200`, `201`, `204`, `400`, `404`, `409`, `422`, `429`, and `500`.
- **Sliding-Window Rate Limiting & Correlation IDs**: Built-in protection (120 req/min/IP) and request tracking with `X-Request-Id`.
- **Interactive Web Cockpit**: Live browser interface for inspecting the fleet, dispatching missions, testing status codes, and monitoring telemetry.
- **Comprehensive Automated Test Suite**: 48 automated test assertions covering endpoints, edge cases, and validation layers.

---

## 📁 Project Structure

```
├── .env.example              # Environment variables template (no secrets committed)
├── .gitignore                # Protects environment files, keys, certs, and logs
├── package.json              # Dependencies and test/start scripts
├── README.md                 # Project documentation & submission guide
└── src/
    ├── config/
    │   └── env.js            # Centralized environment configuration
    ├── controllers/
    │   ├── deliveryController.js   # Flight mission lifecycle controller
    │   ├── droneController.js      # Drone fleet CRUD controller
    │   └── telemetryController.js  # Health, metrics & catalog controller
    ├── database/
    │   ├── seedData.js       # Initial seed data for drones and missions
    │   └── store.js          # In-memory ACID-compliant datastore
    ├── engines/
    │   └── stateEngine.js    # Finite state machine validator
    ├── middleware/
    │   ├── errorHandler.js   # Centralized error handler & 404 handler
    │   ├── gatekeeper.js     # Dual-layer syntactic & semantic validation
    │   ├── logger.js         # Request logger with X-Request-Id tracing
    │   └── rateLimiter.js    # Sliding-window rate limiter
    ├── public/
    │   ├── app.js            # Interactive cockpit controller
    │   ├── index.html        # Interactive cockpit interface
    │   └── style.css         # Modern dark-theme UI styles
    ├── routes/
    │   ├── deliveryRoutes.js # /deliveries routes
    │   ├── droneRoutes.js    # /drones routes
    │   ├── index.js          # Main route aggregator (/api/v1)
    │   └── telemetryRoutes.js# /health, /metrics, /catalog routes
    ├── schemas/
    │   ├── deliverySchema.js # Zod schemas for delivery missions
    │   └── droneSchema.js    # Zod schemas for drone registrations
    ├── tests/
    │   └── run-tests.js      # Automated test runner (48 test cases)
    └── utils/
        ├── apiResponse.js    # Standardized response envelopes
        ├── jwt.js            # HMAC-SHA256 JWT signing/verification utility
        └── password.js       # PBKDF2 cryptographic hashing utility
```

---

## ⚙️ Quick Start

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd decodelabs-2nd-task

# Install dependencies
npm install
```

### 3. Environment Setup
```bash
# Create local environment configuration from template
cp .env.example .env
```
> **Security Note**: Never commit `.env` or production credentials. All sensitive environment files and private keys are ignored via `.gitignore`.

### 4. Running the Server
```bash
# Start production server (default: http://localhost:4000)
npm start

# Or start in watch/development mode
npm run dev
```

### 5. Running Automated Tests
```bash
npm test
```
*Executes all 48 test assertions verifying routing, syntactic gatekeeping, semantic business rules, and state engine locks.*

---

## 🔌 API Endpoints Reference

All endpoints support JSON request and response payloads:

| Method | Endpoint | Status Codes | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/drones` | `200` | List fleet drones with optional query filters (`status`, `minBattery`, `model`, `homeBaseId`). |
| `GET` | `/drones/:id` | `200`, `404` | Get hardware specifications and current status for a single drone. |
| `POST` | `/drones` | `201`, `400`, `409` | Register a new drone (enforces Zod bounds & unique serial number). |
| `PUT` | `/drones/:id/status` | `200`, `400`, `404`, `409` | Update drone status enforced by state machine. |
| `DELETE` | `/drones/:id` | `204`, `404`, `409` | Decommission drone (fails with `409` if active in mission). |
| `GET` | `/deliveries` | `200` | List flight missions with optional filters (`state`, `droneId`, `priority`). |
| `GET` | `/deliveries/:id` | `200`, `404` | Retrieve mission details, destination, and telemetry coordinates. |
| `POST` | `/deliveries` | `201`, `400`, `404`, `422` | Dispatch a flight delivery mission with dual-layer gatekeeping. |
| `PATCH`| `/deliveries/:id/state` | `200`, `400`, `404`, `409` | Advance delivery lifecycle state via State Engine. |
| `PUT`  | `/deliveries/:id/telemetry` | `200`, `400`, `404`, `409` | Update real-time GPS coordinates, altitude, and battery drain. |
| `DELETE`| `/deliveries/:id` | `204`, `404`, `409` | Abort/delete mission and release drone back to `IDLE`. |
| `GET` | `/api/v1/health` | `200` | Check service health, uptime, and gateway status. |
| `GET` | `/api/v1/metrics` | `200` | Get fleet distribution metrics and audit log feed. |
| `GET` | `/api/v1/catalog` | `200` | Get machine-readable API catalog of all endpoints. |
| `POST`| `/api/v1/system/reset` | `200` | Re-seed datastore back to clean baseline state. |

---

## 🛡️ Dual-Layer Validation Architecture

```
HTTP Request
     │
     ▼
[ Layer 1: Syntactic Gatekeeper (Zod) ] ──(Invalid types/bounds)──► 400 Bad Request
     │
     ▼ (Valid Syntax)
[ Layer 2: Semantic Business Rules ]    ──(Domain violation)──────► 422 Unprocessable Entity
     │
     ▼ (Valid Semantics)
[ State Machine Transition Engine ]     ──(Illegal state hop)────► 409 Conflict
     │
     ▼ (Valid State)
[ ACID In-Memory Store & Response ]     ─────────────────────────► 200 / 201 / 204
```

### Layer 1: Syntactic Rules (`400 Bad Request`)
- `droneId`: String $\ge 3$ characters.
- `destination.latitude`: $[-90.0, +90.0]$.
- `destination.longitude`: $[-180.0, +180.0]$.
- `destination.altitudeMeters`: $[10, 500]$.
- `packageDetails.trackingCode`: Format `PKG-YYYY-XXXX` (e.g., `PKG-2026-9918`).
- `packageDetails.weightKg`: Number in $(0, 25.0]$.
- `priority`: Enum `['STANDARD', 'EXPEDITED', 'EMERGENCY']`.

### Layer 2: Semantic Rules (`422 Unprocessable Entity`)
- **Weight Cap for Expedited Cargo**: `EXPEDITED` or `EMERGENCY` packages cannot exceed `10.0kg`.
- **Altitude Safety for Fragile Cargo**: Fragile items cannot be flown above `300m` altitude.
- **Drone Availability**: Drones must be in `IDLE` state to be dispatched.
- **Payload Capacity**: Package weight cannot exceed the assigned drone's `maxPayloadKg`.
- **Battery Reserve**: Drone battery must be at least `30%` for mission dispatch.

---

## 🔄 Delivery Lifecycle State Machine

```
[IDLE] ──► [DISPATCHED] ──► [IN_FLIGHT] ──► [DELIVERED] (Terminal)
  │              │                │
  ▼              ▼                ▼
[ABORTED] ◄──────┴────────────────┘ (Terminal)
```

- **Allowed Paths**: `DISPATCHED` $\to$ `IN_FLIGHT` $\to$ `DELIVERED` or `ABORTED`.
- **Illegal Transitions**: Attempting to skip states (e.g. `DISPATCHED` $\to$ `DELIVERED`) throws `409 Conflict` (`ILLEGAL_STATE_TRANSITION`).
- **Terminal States**: `DELIVERED` and `ABORTED` are immutable; further transitions throw `409 Conflict` (`TERMINAL_STATE_LOCKED`).

---

## 🚦 Semantic HTTP Status Codes

| Code | Meaning | Used When |
| :--- | :--- | :--- |
| **`200 OK`** | Request Succeeded | Successful fetch, update, state transition, or health query. |
| **`201 Created`** | Resource Created | Successfully commissioned a drone or dispatched a delivery mission. |
| **`204 No Content`** | Action Completed | Successfully deleted a mission or decommissioned a drone. |
| **`400 Bad Request`** | Syntactic Error | Malformed JSON, missing fields, or failed Zod schema bounds. |
| **`404 Not Found`** | Resource Missing | Drone ID or delivery mission ID does not exist in registry. |
| **`409 Conflict`** | Conflict / Lock | Duplicate serial/tracking number, active drone deletion, or illegal state hop. |
| **`422 Unprocessable`** | Semantic Violation | Business/physics rules violated (e.g., drone busy, weight exceeds limits). |
| **`429 Too Many Requests`** | Rate Limit Exceeded | Client exceeded sliding-window limit (120 requests/minute). |
| **`500 Internal Error`** | Server Error | Unhandled server exception with safe error sanitization in production. |

---

## 💻 Sample cURL Commands

```bash
# 1. Commission a new drone (201 Created)
curl -X POST http://localhost:4000/drones \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "AG-X8-9042",
    "model": "SkyLifter-Pro",
    "maxPayloadKg": 15.0,
    "batteryCapacityMah": 22000,
    "homeBaseId": "HUB-NORTH-01"
  }'

# 2. Dispatch a delivery mission (201 Created)
curl -X POST http://localhost:4000/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "drn_101",
    "priority": "STANDARD",
    "destination": {
      "address": "742 Evergreen Terrace, Sector 4",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitudeMeters": 120
    },
    "packageDetails": {
      "trackingCode": "PKG-2026-9042",
      "weightKg": 4.5,
      "isFragile": false,
      "category": "ELECTRONICS"
    }
  }'

# 3. Advance state to IN_FLIGHT (200 OK)
curl -X PATCH http://localhost:4000/deliveries/del_201/state \
  -H "Content-Type: application/json" \
  -d '{"targetState": "IN_FLIGHT"}'

# 4. Trigger 409 Conflict on illegal state hop
curl -X PATCH http://localhost:4000/deliveries/del_201/state \
  -H "Content-Type: application/json" \
  -d '{"targetState": "DELIVERED"}'
```

---

## 🔒 Security & Safe Secrets Management

- **Zero Hardcoded Secrets**: Sensitive credentials (e.g. `JWT_SECRET`, database URLs, API tokens) are strictly read from `process.env`.
- **Exclusion of Secrets**: `.gitignore` is configured to exclude all `.env`, `*.pem`, `*.key`, `*.cert`, `*.crt`, `credentials.json`, `token.json`, and private artifacts.
- **Safe Template**: `.env.example` provides developers with a clear template without exposing real credentials.
