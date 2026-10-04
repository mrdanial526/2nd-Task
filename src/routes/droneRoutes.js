/**
 * AeroGrid Drone Fleet Routes
 */

const express = require('express');
const router = express.Router();

const {
  listDrones,
  getDroneById,
  createDrone,
  updateDroneStatus,
  deleteDrone,
} = require('../controllers/droneController');

const { validateSyntax } = require('../middleware/gatekeeper');
const { droneRegistrationSchema, droneStatusUpdateSchema } = require('../schemas/droneSchema');

router.route('/')
  .get(listDrones)
  .post(validateSyntax(droneRegistrationSchema), createDrone);

router.route('/:id')
  .get(getDroneById)
  .delete(deleteDrone);

router.put('/:id/status', validateSyntax(droneStatusUpdateSchema), updateDroneStatus);

module.exports = router;
