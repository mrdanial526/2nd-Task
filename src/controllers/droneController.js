/**
 * AeroGrid Drone Fleet Controller
 * Handles RESTful lifecycle operations for fleet drones.
 */

const db = require('../database/store');
const { StateEngine } = require('../engines/stateEngine');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /drones (Query collection with filters)
const listDrones = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    minBattery: req.query.minBattery,
    model: req.query.model,
    homeBaseId: req.query.homeBaseId,
  };

  const drones = db.listDrones(filters);

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    results: drones.length,
    data: drones,
    timestamp: new Date().toISOString(),
  });
});

// GET /drones/:id (Retrieve single drone)
const getDroneById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const drone = db.findDroneById(id);

  if (!drone) {
    const error = new Error(`Drone unit with ID '${id}' was not found in the fleet registry.`);
    error.statusCode = 404;
    error.code = 'DRONE_NOT_FOUND';
    throw error;
  }

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    data: drone,
    timestamp: new Date().toISOString(),
  });
});

// POST /drones (Commission new drone)
const createDrone = catchAsync(async (req, res) => {
  const { serialNumber } = req.body;

  // Uniqueness check: 409 Conflict
  const existing = db.findDroneBySerialNumber(serialNumber);
  if (existing) {
    const error = new Error(`A drone with serialNumber '${serialNumber.toUpperCase()}' is already registered (ID: ${existing.id}).`);
    error.statusCode = 409;
    error.code = 'DUPLICATE_SERIAL_NUMBER';
    throw error;
  }

  const drone = db.createDrone(req.body);

  res.status(201).location(`/api/v1/drones/${drone.id}`).json({
    status: 'success',
    statusCode: 201,
    message: 'Drone unit successfully commissioned into active fleet.',
    data: drone,
    timestamp: new Date().toISOString(),
  });
});

// PUT /drones/:id/status (Update drone status via StateEngine)
const updateDroneStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status: targetStatus } = req.body;

  const drone = db.findDroneById(id);
  if (!drone) {
    const error = new Error(`Drone unit with ID '${id}' was not found.`);
    error.statusCode = 404;
    error.code = 'DRONE_NOT_FOUND';
    throw error;
  }

  // Enforce valid state transition
  const validatedStatus = StateEngine.validateDroneTransition(drone.status, targetStatus);

  const updatedDrone = db.updateDrone(id, {
    status: validatedStatus,
  });

  res.status(200).json({
    status: 'success',
    statusCode: 200,
    message: `Drone status successfully updated from '${drone.status}' to '${validatedStatus}'.`,
    data: updatedDrone,
    timestamp: new Date().toISOString(),
  });
});

// DELETE /drones/:id (Decommission drone)
const deleteDrone = catchAsync(async (req, res) => {
  const { id } = req.params;
  const drone = db.findDroneById(id);

  if (!drone) {
    const error = new Error(`Drone unit with ID '${id}' was not found.`);
    error.statusCode = 404;
    error.code = 'DRONE_NOT_FOUND';
    throw error;
  }

  // Business invariant: Cannot decommission a drone actively in flight
  if (drone.status === 'IN_FLIGHT' || drone.status === 'DISPATCHED') {
    const error = new Error(`Cannot decommission drone '${id}' while active in '${drone.status}' mission.`);
    error.statusCode = 409;
    error.code = 'DRONE_ACTIVE_IN_MISSION';
    throw error;
  }

  db.deleteDrone(id);

  res.status(204).send();
});

module.exports = {
  listDrones,
  getDroneById,
  createDrone,
  updateDroneStatus,
  deleteDrone,
};
