/**
 * AeroGrid Delivery Mission Routes
 */

const express = require('express');
const router = express.Router();

const {
  listDeliveries,
  getDeliveryById,
  createDelivery,
  updateDeliveryState,
  updateTelemetry,
  deleteDelivery,
} = require('../controllers/deliveryController');

const { validateSyntax, validateDeliverySemantics } = require('../middleware/gatekeeper');
const {
  createDeliverySchema,
  deliveryStateTransitionSchema,
  telemetryUpdateSchema,
} = require('../schemas/deliverySchema');

router.route('/')
  .get(listDeliveries)
  .post(
    validateSyntax(createDeliverySchema),
    validateDeliverySemantics,
    createDelivery
  );

router.route('/:id')
  .get(getDeliveryById)
  .delete(deleteDelivery);

router.patch(
  '/:id/state',
  validateSyntax(deliveryStateTransitionSchema),
  updateDeliveryState
);

router.put(
  '/:id/telemetry',
  validateSyntax(telemetryUpdateSchema),
  updateTelemetry
);

module.exports = router;
