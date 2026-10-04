# AeroGrid Autonomous Drone Dispatch & Telemetry API

> **High-Integrity Backend RESTful API Service**  
> *Engineered for autonomous fleet management, dual-layer syntactic & semantic request gatekeeping, deterministic state machine transitions, and real-time flight telemetry streaming.*

---

## 🏛️ Architecture Overview

The AeroGrid API enforces strict separation of concerns, defensive boundaries, and stateless REST principles:

```
Incoming HTTP Request
        │
        ▼
[1. Request Logger & Correlation ID (X-Request-Id)]
        │
        ▼
[2. Sliding-Window Rate Limiter (120 req/min/IP)]
        │
        ▼
[3. Layer 1: Syntactic Gatekeeper (Zod Schemas, Types, Bounds, Regex)] ──► Throws 400 Bad Request
        │
        ▼
[4. Layer 2: Semantic Business Gatekeeper (Cross-field physics, limits)] ──► Throws 422 Unprocessable
        │
        ▼
[5. State Machine Transition Engine (VALID_TRANSITIONS Map)] ──► Throws 409 Conflict
        │
        ▼
[6. Domain Controllers & In-Memory ACID Datastore]
        │
        ▼
[7. Standardized Semantic JSON Envelope (200, 201, 204, 400, 404, 409, 422, 500)]
```

---

## 📌 1. RESTful Endpoints Directory

All endpoints strictly adhere to **plural noun-based resource paths** (`/drones`, `/deliveries`) and standard HTTP verbs:

| Resource Scope | HTTP Method | REST Endpoint | Status Codes | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Drones** | `GET` | `/drones` | `200 OK` | Query fleet registry with filters (`status`, `minBattery`, `model`, `homeBaseId`). |
| | `GET` | `/drones/:id` | `200 OK`, `404 Not Found` | Fetch detailed hardware specs, battery, and status for a single drone. |
| | `POST` | `/drones` | `201 Created`, `400 Bad Request`, `409 Conflict` | Commission a new drone unit with strict Zod syntactic bounds and unique serial checks. |
| | `PUT` | `/drones/:id/status` | `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` | Update drone status enforced by the state machine engine. |
| | `DELETE` | `/drones/:id` | `204 No Content`, `404 Not Found`, `409 Conflict` | Decommission drone (fails with 409 if actively assigned to a mission). |
| **Deliveries** | `GET` | `/deliveries` | `200 OK` | Query delivery missions with optional filters (`state`, `droneId`, `priority`). |
| | `GET` | `/deliveries/:id` | `200 OK`, `404 Not Found` | Fetch flight mission details, cargo specifics, and live telemetry coordinates. |
| | `POST` | `/deliveries` | `201 Created`, `400 Bad Request`, `404 Not Found`, `422 Unprocessable` | Calculate, validate, and dispatch a new flight mission with dual-layer gatekeeping. |
| | `PATCH` | `/deliveries/:id/state` | `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` | Execute legal lifecycle state transitions (`DISPATCHED` $\to$ `IN_FLIGHT` $\to$ `DELIVERED` / `ABORTED`). |
| | `PUT` | `/deliveries/:id/telemetry` | `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` | Replace/update live in-flight GPS coordinates, altitude, and battery drain. |
| | `DELETE` | `/deliveries/:id` | `204 No Content`, `404 Not Found`, `409 Conflict` | Abort/delete mission and atomically release drone back to `IDLE`. |
| **Telemetry** | `GET` | `/api/v1/health` | `200 OK` | Service health, uptime, and gateway status. |
| | `GET` | `/api/v1/metrics` | `200 OK` | Real-time fleet metrics, state distributions, and audit log feed. |
| | `GET` | `/api/v1/catalog` | `200 OK` | Full machine-readable REST endpoint directory. |
| | `POST` | `/api/v1/system/reset` | `200 OK` | Re-seed datastore back to clean baseline. |

---

## 🛡️ 2. The "Gatekeeper Rule" (Dual-Layer Validation Architecture)

```
Incoming Request ──► [Layer 1: Syntactic Gatekeeper] ──► [Layer 2: Semantic Gatekeeper] ──► [Datastore]
```

### Layer 1: Syntactic Validation (Zod Schemas)
- **Drone Creation (`POST /drones`)**:
  - `serialNumber`: Regex `/^AG-[A-Z0-9]{2,4}-[0-9]{3,4}$/` (e.g., `AG-X8-9042`).
  - `maxPayloadKg`: Positive number between `0.1` and `50.0`.
  - `batteryCapacityMah`: Positive integer between `5000` and `50000`.
- **Mission Creation (`POST /deliveries`)**:
  - `destination`: `latitude` $\in [-90, +90]$, `longitude` $\in [-180, +180]$, `altitudeMeters` $\in [10, 500]$.
  - `packageDetails.trackingCode`: Regex `/^PKG-[0-9]{4}-[0-9]{4}$/`.
  - `packageDetails.weightKg`: Positive number between `0.1` and `25.0`.
  - `priority`: Strict enum `['STANDARD', 'EXPEDITED', 'EMERGENCY']`.
- **Outcome**: Returns `400 Bad Request` with `code: "SYNTACTIC_VALIDATION_ERROR"` and detailed field error array.

### Layer 2: Semantic Domain & Physics Gatekeeper
- **Expedited Weight Bounds**: Rejects `EXPEDITED` or `EMERGENCY` packages with `weightKg > 10.0` with `422 Unprocessable Entity`.
- **Fragile Altitude Cap**: Rejects fragile items routed with `altitudeMeters > 300` due to turbulence protocols.
- **Drone Availability**: Rejects dispatch if drone is not in `IDLE` state (`422 DRONE_UNAVAILABLE`).
- **Payload Capacity**: Rejects dispatch if package weight exceeds assigned drone's `maxPayloadKg` (`422 PAYLOAD_CAPACITY_EXCEEDED`).
- **Battery Reserve**: Rejects dispatch if drone battery is below `30%` (`422 INSUFFICIENT_BATTERY`).

---

## 🔄 3. Deterministic State Machine Engine

The State Engine strictly enforces permissible mathematical paths:

```
[IDLE] ──────► [DISPATCHED] ──────► [IN_FLIGHT] ──────► [DELIVERED] (Terminal)
  │                 │                    │
  ▼                 ▼                    ▼
[ABORTED] ◄─────────┴────────────────────┘ (Terminal)
```

* **Legal Path**: `IDLE` $\to$ `DISPATCHED` $\to$ `IN_FLIGHT` $\to$ `DELIVERED`.
* **Illegal Hop**: Attempting to skip states (e.g. `DISPATCHED` directly to `DELIVERED` or `IDLE` directly to `DELIVERED`) throws `409 Conflict` (`ILLEGAL_STATE_TRANSITION`).
* **Terminal Lock**: Attempting to transition from `DELIVERED` or `ABORTED` throws `409 Conflict` (`TERMINAL_STATE_LOCKED`).

---

## 🚦 4. Standard Semantic HTTP Status Codes & Responses

All responses follow a uniform JSON envelope:

### `201 Created`
```json
{
  "status": "success",
  "statusCode": 201,
  "message": "Flight delivery mission successfully calculated, validated, and dispatched.",
  "data": {
    "id": "del_1001",
    "droneId": "drn_101",
    "state": "DISPATCHED",
    "priority": "STANDARD",
    "destination": {
      "address": "742 Evergreen Terrace",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitudeMeters": 120
    },
    "packageDetails": {
      "trackingCode": "PKG-2026-9918",
      "weightKg": 4.5,
      "isFragile": false,
      "category": "ELECTRONICS"
    }
  },
  "timestamp": "2026-10-04T12:00:00.000Z"
}
```

### `400 Bad Request` (Syntactic Error)
```json
{
  "status": "error",
  "statusCode": 400,
  "code": "SYNTACTIC_VALIDATION_ERROR",
  "message": "The request payload failed syntactic schema validation.",
  "errors": [
    {
      "field": "destination.latitude",
      "rule": "too_big",
      "message": "latitude must be <= 90.0"
    }
  ],
  "timestamp": "2026-10-04T12:00:00.000Z"
}
```

### `409 Conflict` (State Engine Violation)
```json
{
  "status": "error",
  "statusCode": 409,
  "code": "ILLEGAL_STATE_TRANSITION",
  "message": "Illegal state transition: Cannot transition delivery from 'DISPATCHED' to 'DELIVERED'. Permissible next states: [IN_FLIGHT, ABORTED].",
  "timestamp": "2026-10-04T12:00:00.000Z"
}
```

### `422 Unprocessable Entity` (Domain Rule Violation)
```json
{
  "status": "error",
  "statusCode": 422,
  "code": "SEMANTIC_PAYLOAD_LIMIT_EXCEEDED",
  "message": "EXPEDITED priority missions are aerodynamically restricted to packages <= 10.0kg (requested: 14.5kg).",
  "timestamp": "2026-10-04T12:00:00.000Z"
}
```

---

## 🚀 Quickstart & Testing

### 1. Start the API Server
```bash
npm start
```
*Server runs on `http://localhost:4000` with the interactive Cockpit Console.*

### 2. Run Automated Test Suite (48 Assertions)
```bash
npm test
```

---

## 💻 Sample cURL Commands

```bash
# 1. Query fleet
curl -X GET http://localhost:4000/drones

# 2. Commission new drone (201 Created)
curl -X POST http://localhost:4000/drones \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "AG-X8-9042",
    "model": "SkyLifter-Pro",
    "maxPayloadKg": 15.0,
    "batteryCapacityMah": 22000,
    "homeBaseId": "HUB-NORTH-01"
  }'

# 3. Dispatch flight mission (201 Created)
curl -X POST http://localhost:4000/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "droneId": "drn_101",
    "destination": {
      "address": "742 Evergreen Terrace, Sector 4",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitudeMeters": 120
    },
    "packageDetails": {
      "trackingCode": "PKG-2026-8801",
      "weightKg": 4.5,
      "isFragile": false,
      "category": "ELECTRONICS"
    },
    "priority": "STANDARD"
  }'

# 4. Trigger 409 Conflict (Illegal transition)
curl -X PATCH http://localhost:4000/deliveries/del_201/state \
  -H "Content-Type: application/json" \
  -d '{"targetState": "DELIVERED"}'
```
