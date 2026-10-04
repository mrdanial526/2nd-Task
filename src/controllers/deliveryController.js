/**
 * AeroGrid Delivery Mission Controller
 * Handles flight dispatching, state transitions, telemetry streaming, and mission cancellation.
 */

const db = require('../database/store');
const { StateEngine } = require('../engines/stateEngine');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /deliveries
const listDeliveries = catchAsync(async (req, res) => {
  const filters = {
    state: req.query.state,
    droneId: req.query.droneId,
    priority: req.query.priority,
    category: req.query.category,
  };

  const deliveries = db.listDeliveries(filters);

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    results: deliveries.length,
    data: deliveries,
    timestamp: new Date().toISOString(),
  });
});

// GET /deliveries/:id
const getDeliveryById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const delivery = db.findDeliveryById(id);

  if (!delivery) {
    const error = new Error(`Delivery mission with ID '${id}' was not found.`);
    error.statusCode = 404;
    error.code = 'MISSION_NOT_FOUND';
    throw error;
  }

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    data: delivery,
    timestamp: new Date().toISOString(),
  });
});

// POST /deliveries (Dispatch new flight delivery mission)
const createDelivery = catchAsync(async (req, res) => {
  const { droneId, packageDetails } = req.body;

  // 1. Verify Drone Existence
  const drone = db.findDroneById(droneId);
  if (!drone) {
    const error = new Error(`Assigned drone '${droneId}' does not exist in fleet registry.`);
    error.statusCode = 404;
    error.code = 'DRONE_NOT_FOUND';
    throw error;
  }

  // 2. Verify Tracking Code Uniqueness
  const existingMission = db.findDeliveryByTrackingCode(packageDetails.trackingCode);
  if (existingMission) {
    const error = new Error(`A mission with trackingCode '${packageDetails.trackingCode}' already exists (ID: ${existingMission.id}).`);
    error.statusCode = 409;
    error.code = 'DUPLICATE_TRACKING_CODE';
    throw error;
  }

  // 3. Semantic Verification: Drone Availability
  if (drone.status !== 'IDLE') {
    const error = new Error(`Drone '${droneId}' is currently '${drone.status}'. Only 'IDLE' drones can be dispatched on new missions.`);
    error.statusCode = 422;
    error.code = 'DRONE_UNAVAILABLE';
    throw error;
  }

  // 4. Semantic Verification: Payload Physics Limit
  if (packageDetails.weightKg > drone.maxPayloadKg) {
    const error = new Error(
      `Package weight (${packageDetails.weightKg}kg) exceeds maximum rated payload capacity for drone '${drone.model}' (${drone.maxPayloadKg}kg).`
    );
    error.statusCode = 422;
    error.code = 'PAYLOAD_CAPACITY_EXCEEDED';
    throw error;
  }

  // 5. Semantic Verification: Battery Reserve Threshold (Minimum 30% for dispatch)
  if (drone.currentBatteryPercentage < 30) {
    const error = new Error(
      `Drone '${droneId}' battery level (${drone.currentBatteryPercentage}%) is below the minimum mandatory flight dispatch reserve (30%).`
    );
    error.statusCode = 422;
    error.code = 'INSUFFICIENT_BATTERY';
    throw error;
  }

  // Create delivery mission and lock drone
  const delivery = db.createDelivery(req.body);

  res.status(201).location(`/api/v1/deliveries/${delivery.id}`).json({
    status: 'success',
    statusCode: 201,
    message: 'Flight delivery mission successfully calculated, validated, and dispatched.',
    data: delivery,
    timestamp: new Date().toISOString(),
  });
});

// PATCH /deliveries/:id/state (Transition delivery lifecycle state)
const updateDeliveryState = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { targetState, reason } = req.body;

  const delivery = db.findDeliveryById(id);
  if (!delivery) {
    const error = new Error(`Delivery mission with ID '${id}' was not found.`);
    error.statusCode = 404;
    error.code = 'MISSION_NOT_FOUND';
    throw error;
  }

  // Validate state machine transition (throws 409 if illegal)
  const nextState = StateEngine.validateDeliveryTransition(delivery.state, targetState);

  const updates = {
    state: nextState,
    lastTransitionReason: reason || `Transitioned to ${nextState}`,
  };

  if (nextState === 'DELIVERED') {
    updates.deliveredAt = new Date().toISOString();
  }

  const updatedDelivery = db.updateDelivery(id, updates);

  // Synchronize Drone state atomically
  if (delivery.droneId) {
    if (nextState === 'IN_FLIGHT') {
      db.updateDrone(delivery.droneId, { status: 'IN_FLIGHT' });
    } else if (nextState === 'DELIVERED') {
      const drone = db.findDroneById(delivery.droneId);
      db.updateDrone(delivery.droneId, {
        status: 'IDLE',
        assignedMissionId: null,
        totalMissionsCompleted: (drone?.totalMissionsCompleted || 0) + 1,
        currentBatteryPercentage: Math.max(10, (drone?.currentBatteryPercentage || 80) - 20),
      });
    } else if (nextState === 'ABORTED') {
      db.updateDrone(delivery.droneId, {
        status: 'IDLE',
        assignedMissionId: null,
      });
    }
  }

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    message: `Delivery mission successfully transitioned from '${delivery.state}' to '${nextState}'.`,
    data: updatedDelivery,
    timestamp: new Date().toISOString(),
  });
});

// PUT /deliveries/:id/telemetry (Update live mission telemetry)
const updateTelemetry = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { currentLocation, currentSpeedKmh, batteryPercentageRemaining, flightStatus } = req.body;

  const delivery = db.findDeliveryById(id);
  if (!delivery) {
    const error = new Error(`Delivery mission with ID '${id}' was not found.`);
    error.statusCode = 404;
    error.code = 'MISSION_NOT_FOUND';
    throw error;
  }

  if (delivery.state !== 'DISPATCHED' && delivery.state !== 'IN_FLIGHT') {
    const error = new Error(`Cannot update telemetry for mission in terminal or inactive state '${delivery.state}'.`);
    error.statusCode = 409;
    error.code = 'MISSION_INACTIVE';
    throw error;
  }

  const updatedTelemetry = {
    currentLocation,
    currentSpeedKmh,
    batteryPercentageRemaining,
    flightStatus,
    recordedAt: new Date().toISOString(),
  };

  const updatedDelivery = db.updateDelivery(id, {
    telemetry: updatedTelemetry,
  });

  // Sync drone battery
  if (delivery.droneId) {
    db.updateDrone(delivery.droneId, {
      currentBatteryPercentage: batteryPercentageRemaining,
    });
  }

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    message: 'Live flight telemetry successfully updated.',
    data: updatedDelivery,
    timestamp: new Date().toISOString(),
  });
});

// DELETE /deliveries/:id (Abort and cancel mission)
const deleteDelivery = catchAsync(async (req, res) => {
  const { id } = req.params;
  const delivery = db.findDeliveryById(id);

  if (!delivery) {
    const error = new Error(`Delivery mission with ID '${id}' was not found.`);
    error.statusCode = 404;
    error.code = 'MISSION_NOT_FOUND';
    throw error;
  }

  // Business invariant: Cannot silently delete a mission actively in flight without aborting
  if (delivery.state === 'IN_FLIGHT') {
    const error = new Error(`Cannot delete mission '${id}' while active IN_FLIGHT. Transition state to 'ABORTED' first.`);
    error.statusCode = 409;
    error.code = 'MISSION_IN_FLIGHT';
    throw error;
  }

  db.deleteDelivery(id);

  res.status(204).send();
});

module.exports = {
  listDeliveries,
  getDeliveryById,
  createDelivery,
  updateDeliveryState,
  updateTelemetry,
  deleteDelivery,
};
