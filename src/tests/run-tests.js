/**
 * AeroGrid Backend Automated Test Suite
 * Validates RESTful routing, Dual-Layer Gatekeeper, State Machine, and HTTP Status Codes.
 */

const http = require('http');
const app = require('../server');
const db = require('../database/store');

let server;
const PORT = 4099;
const BASE_URL = `http://localhost:${PORT}`;

let passedTests = 0;
let failedTests = 0;

// Helper: Make HTTP Request
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          if (data) parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Helper: Assertions
function assert(name, condition, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${name}`);
    if (details) console.error(`    \x1b[33m${details}\x1b[0m`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('🧪 Starting AeroGrid Drone Dispatch API Test Suite');
  console.log('========================================================\n');

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  try {
    // ------------------------------------------------------------------------
    console.log('\n[Suite 1: Health, Metrics & System Reset]');
    // ------------------------------------------------------------------------
    {
      const res = await request('GET', '/api/v1/health');
      assert('GET /api/v1/health returns 200 OK', res.statusCode === 200);
      assert('Health body contains OPERATIONAL status', res.body?.data?.status === 'OPERATIONAL');

      const catRes = await request('GET', '/api/v1/catalog');
      assert('GET /api/v1/catalog returns 200 OK', catRes.statusCode === 200);
      assert('Catalog lists endpoints array', Array.isArray(catRes.body?.data?.endpoints));

      const resetRes = await request('POST', '/api/v1/system/reset');
      assert('POST /api/v1/system/reset returns 200 OK', resetRes.statusCode === 200);
    }

    // ------------------------------------------------------------------------
    console.log('\n[Suite 2: Drones REST API & Gatekeeper Validation]');
    // ------------------------------------------------------------------------
    {
      // 1. List Drones
      const listRes = await request('GET', '/drones');
      assert('GET /drones returns 200 OK', listRes.statusCode === 200);
      assert('GET /drones returns array of drones', Array.isArray(listRes.body?.data) && listRes.body.data.length >= 4);

      // 2. Filter Drones
      const filterRes = await request('GET', '/drones?status=IDLE');
      assert('GET /drones?status=IDLE filters correctly', filterRes.statusCode === 200 && filterRes.body.data.every((d) => d.status === 'IDLE'));

      // 3. Get Single Drone
      const getRes = await request('GET', '/drones/drn_101');
      assert('GET /drones/drn_101 returns 200 OK', getRes.statusCode === 200);
      assert('Drone details match ID', getRes.body?.data?.id === 'drn_101');

      // 4. Get Non-existent Drone (404)
      const notFoundRes = await request('GET', '/drones/drn_nonexistent');
      assert('GET /drones/drn_nonexistent returns 404 Not Found', notFoundRes.statusCode === 404);
      assert('Error code is DRONE_NOT_FOUND', notFoundRes.body?.code === 'DRONE_NOT_FOUND');

      // 5. Create Drone (Syntactic Validation - Missing Fields -> 400)
      const badSyntaxRes = await request('POST', '/drones', {
        serialNumber: 'INVALID_SERIAL',
        maxPayloadKg: -5,
      });
      assert('POST /drones with malformed payload returns 400 Bad Request', badSyntaxRes.statusCode === 400);
      assert('Error code is SYNTACTIC_VALIDATION_ERROR', badSyntaxRes.body?.code === 'SYNTACTIC_VALIDATION_ERROR');
      assert('Returns array of field errors', Array.isArray(badSyntaxRes.body?.errors));

      // 6. Create Drone Successfully (201 Created)
      const createRes = await request('POST', '/drones', {
        serialNumber: 'AG-T9-8822',
        model: 'TitanCopter-Heavy',
        maxPayloadKg: 20.0,
        batteryCapacityMah: 28000,
        homeBaseId: 'HUB-CENTRAL-01',
      });
      assert('POST /drones with valid payload returns 201 Created', createRes.statusCode === 201);
      assert('Response contains Location header', !!createRes.headers['location']);
      assert('Created drone has IDLE status and 100% battery', createRes.body?.data?.status === 'IDLE' && createRes.body?.data?.currentBatteryPercentage === 100);

      const createdDroneId = createRes.body?.data?.id;

      // 7. Create Duplicate Drone (409 Conflict)
      const duplicateRes = await request('POST', '/drones', {
        serialNumber: 'AG-T9-8822',
        model: 'TitanCopter-Heavy',
        maxPayloadKg: 20.0,
        batteryCapacityMah: 28000,
        homeBaseId: 'HUB-CENTRAL-01',
      });
      assert('POST /drones with duplicate serialNumber returns 409 Conflict', duplicateRes.statusCode === 409);
      assert('Error code is DUPLICATE_SERIAL_NUMBER', duplicateRes.body?.code === 'DUPLICATE_SERIAL_NUMBER');

      // 8. Update Drone Status via State Engine (200 OK)
      const statusUpdateRes = await request('PUT', `/drones/${createdDroneId}/status`, {
        status: 'MAINTENANCE',
        reason: 'Routine sensor calibration',
      });
      assert('PUT /drones/:id/status transitions IDLE -> MAINTENANCE with 200 OK', statusUpdateRes.statusCode === 200);

      // 9. Decommission Drone (204 No Content)
      const deleteRes = await request('DELETE', `/drones/${createdDroneId}`);
      assert('DELETE /drones/:id returns 204 No Content', deleteRes.statusCode === 204);
    }

    // ------------------------------------------------------------------------
    console.log('\n[Suite 3: Delivery Missions REST API, Dual-Layer Gatekeeper & State Machine]');
    // ------------------------------------------------------------------------
    {
      // 1. List Deliveries
      const listDelRes = await request('GET', '/deliveries');
      assert('GET /deliveries returns 200 OK', listDelRes.statusCode === 200);
      assert('GET /deliveries returns array of missions', Array.isArray(listDelRes.body?.data));

      // 2. Syntactic Gatekeeper Failure (400 Bad Request - Out of range altitude & negative weight)
      const badDelRes = await request('POST', '/deliveries', {
        droneId: 'drn_101',
        destination: {
          address: 'Too short',
          latitude: 195.0, // Invalid lat
          longitude: -122.4194,
          altitudeMeters: 999.0, // Exceeds 500m
        },
        packageDetails: {
          trackingCode: 'INVALID-CODE',
          weightKg: -2.0,
          category: 'UNKNOWN_CATEGORY',
        },
      });
      assert('POST /deliveries with syntactic errors returns 400 Bad Request', badDelRes.statusCode === 400);
      assert('Error code is SYNTACTIC_VALIDATION_ERROR', badDelRes.body?.code === 'SYNTACTIC_VALIDATION_ERROR');

      // 3. Semantic Gatekeeper Layer 2 Failure (422 - Expedited priority weight > 10kg)
      const semanticDelRes = await request('POST', '/deliveries', {
        droneId: 'drn_101',
        destination: {
          address: '404 Industrial Way, Sector 2',
          latitude: 37.7833,
          longitude: -122.4167,
          altitudeMeters: 100,
        },
        packageDetails: {
          trackingCode: 'PKG-2026-7788',
          weightKg: 14.5, // > 10kg
          isFragile: false,
          category: 'GENERAL_CARGO',
        },
        priority: 'EXPEDITED',
      });
      assert('POST /deliveries with Expedited package > 10kg returns 422 Unprocessable Entity', semanticDelRes.statusCode === 422);
      assert('Error code is SEMANTIC_PAYLOAD_LIMIT_EXCEEDED', semanticDelRes.body?.code === 'SEMANTIC_PAYLOAD_LIMIT_EXCEEDED');

      // 4. Semantic Failure: Non-existent Drone (404 Not Found)
      const noDroneRes = await request('POST', '/deliveries', {
        droneId: 'drn_ghost_999',
        destination: {
          address: '404 Industrial Way, Sector 2',
          latitude: 37.7833,
          longitude: -122.4167,
          altitudeMeters: 100,
        },
        packageDetails: {
          trackingCode: 'PKG-2026-7789',
          weightKg: 3.5,
          isFragile: false,
          category: 'GENERAL_CARGO',
        },
        priority: 'STANDARD',
      });
      assert('POST /deliveries with non-existent drone returns 404 Not Found', noDroneRes.statusCode === 404);

      // 5. Semantic Failure: Drone Unavailable (422 - drn_102 is already DISPATCHED)
      const busyDroneRes = await request('POST', '/deliveries', {
        droneId: 'drn_102',
        destination: {
          address: '404 Industrial Way, Sector 2',
          latitude: 37.7833,
          longitude: -122.4167,
          altitudeMeters: 100,
        },
        packageDetails: {
          trackingCode: 'PKG-2026-7790',
          weightKg: 2.0,
          isFragile: false,
          category: 'GENERAL_CARGO',
        },
        priority: 'STANDARD',
      });
      assert('POST /deliveries with busy drone returns 422 Unprocessable Entity', busyDroneRes.statusCode === 422);
      assert('Error code is DRONE_UNAVAILABLE', busyDroneRes.body?.code === 'DRONE_UNAVAILABLE');

      // 6. Successful Mission Dispatch (201 Created)
      const validDispatchRes = await request('POST', '/deliveries', {
        droneId: 'drn_101', // drn_101 is IDLE with 95% battery
        destination: {
          address: '500 Howard Street, Sector 1',
          latitude: 37.7899,
          longitude: -122.3969,
          altitudeMeters: 120,
        },
        packageDetails: {
          trackingCode: 'PKG-2026-8801',
          weightKg: 5.0,
          isFragile: false,
          category: 'ELECTRONICS',
        },
        priority: 'STANDARD',
      });
      assert('POST /deliveries with valid IDLE drone returns 201 Created', validDispatchRes.statusCode === 201);
      assert('Response contains Location header', !!validDispatchRes.headers['location']);
      assert('Delivery state is DISPATCHED', validDispatchRes.body?.data?.state === 'DISPATCHED');

      const missionId = validDispatchRes.body?.data?.id;

      // Check drone status was atomically set to DISPATCHED
      const checkDroneRes = await request('GET', '/drones/drn_101');
      assert('Drone status was atomically set to DISPATCHED', checkDroneRes.body?.data?.status === 'DISPATCHED');

      // 7. State Machine: Illegal State Transition (409 Conflict - DISPATCHED directly to DELIVERED)
      const illegalTransitionRes = await request('PATCH', `/deliveries/${missionId}/state`, {
        targetState: 'DELIVERED', // Illegal from DISPATCHED (must be IN_FLIGHT first)
      });
      assert('PATCH /deliveries/:id/state with illegal hop returns 409 Conflict', illegalTransitionRes.statusCode === 409);
      assert('Error code is ILLEGAL_STATE_TRANSITION', illegalTransitionRes.body?.code === 'ILLEGAL_STATE_TRANSITION');

      // 8. State Machine: Valid Transition (200 OK - DISPATCHED -> IN_FLIGHT)
      const validTransitionRes = await request('PATCH', `/deliveries/${missionId}/state`, {
        targetState: 'IN_FLIGHT',
        reason: 'Takeoff approved from launch pad',
      });
      assert('PATCH /deliveries/:id/state DISPATCHED -> IN_FLIGHT returns 200 OK', validTransitionRes.statusCode === 200);
      assert('Delivery state updated to IN_FLIGHT', validTransitionRes.body?.data?.state === 'IN_FLIGHT');

      // 9. Update Live Telemetry (200 OK)
      const telemetryRes = await request('PUT', `/deliveries/${missionId}/telemetry`, {
        currentLocation: {
          latitude: 37.785,
          longitude: -122.405,
          altitudeMeters: 118.0,
        },
        currentSpeedKmh: 58.2,
        batteryPercentageRemaining: 88,
        flightStatus: 'IN_FLIGHT',
      });
      assert('PUT /deliveries/:id/telemetry returns 200 OK', telemetryRes.statusCode === 200);
      assert('Telemetry coordinates updated', telemetryRes.body?.data?.telemetry?.currentSpeedKmh === 58.2);

      // 10. Complete Mission (200 OK - IN_FLIGHT -> DELIVERED)
      const completeRes = await request('PATCH', `/deliveries/${missionId}/state`, {
        targetState: 'DELIVERED',
        reason: 'Package safely lowered to customer beacon',
      });
      assert('PATCH /deliveries/:id/state IN_FLIGHT -> DELIVERED returns 200 OK', completeRes.statusCode === 200);
      assert('Delivery deliveredAt timestamp is recorded', !!completeRes.body?.data?.deliveredAt);

      // 11. State Machine: Terminal State Locked (409 Conflict - DELIVERED -> DISPATCHED)
      const terminalRes = await request('PATCH', `/deliveries/${missionId}/state`, {
        targetState: 'DISPATCHED',
      });
      assert('Attempting transition from terminal state returns 409 Conflict', terminalRes.statusCode === 409);
      assert('Error code is TERMINAL_STATE_LOCKED', terminalRes.body?.code === 'TERMINAL_STATE_LOCKED');

      // 12. Delete Finished Mission (204 No Content)
      const deleteMissionRes = await request('DELETE', `/deliveries/${missionId}`);
      assert('DELETE /deliveries/:id returns 204 No Content', deleteMissionRes.statusCode === 204);
    }

    // ------------------------------------------------------------------------
    console.log('\n[Suite 4: Global Error Handling & Unknown Routes]');
    // ------------------------------------------------------------------------
    {
      const res = await request('GET', '/unknown-endpoint-xyz');
      assert('GET /unknown-endpoint-xyz returns 404 Not Found', res.statusCode === 404);
      assert('Error code is ROUTE_NOT_FOUND', res.body?.code === 'ROUTE_NOT_FOUND');
    }

  } catch (err) {
    console.error('\n🚨 Unexpected Test Suite Exception:', err);
    failedTests++;
  } finally {
    await new Promise((resolve) => server.close(resolve));

    console.log('\n========================================================');
    console.log(`📊 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('========================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
