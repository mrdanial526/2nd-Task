/**
 * AeroGrid Dual-Layer Validation Gatekeeper
 * 
 * Layer 1: Syntactic Validation (Zod Schemas, Types, Bounds, Regex)
 * Layer 2: Semantic Business Validation (Context, Domain Invariants, Business Rules)
 */

/**
 * Layer 1: Syntactic Schema Gatekeeper
 * Intercepts malformed payloads before they reach application controllers.
 * Returns 400 Bad Request with standardized diagnostic field errors.
 */
const validateSyntax = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        rule: issue.code,
        message: issue.message,
      }));

      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        code: 'SYNTACTIC_VALIDATION_ERROR',
        message: 'The request payload failed syntactic schema validation.',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
    }

    // Replace req.body with sanitized and cast data
    req.body = result.data;
    next();
  };
};

/**
 * Layer 2: Delivery Semantic Business Gatekeeper
 * Validates domain rules and cross-field logic.
 * Returns 422 Unprocessable Entity if business invariants are violated.
 */
const validateDeliverySemantics = (req, res, next) => {
  const { priority, packageDetails, destination } = req.body;

  if (priority && packageDetails) {
    // Business Rule 1: Expedited & Emergency deliveries cannot exceed 10kg
    if ((priority === 'EXPEDITED' || priority === 'EMERGENCY') && packageDetails.weightKg > 10) {
      return res.status(422).json({
        status: 'error',
        statusCode: 422,
        code: 'SEMANTIC_PAYLOAD_LIMIT_EXCEEDED',
        message: `${priority} priority missions are aerodynamically restricted to packages <= 10.0kg (requested: ${packageDetails.weightKg}kg).`,
        errors: [
          {
            field: 'packageDetails.weightKg',
            value: packageDetails.weightKg,
            constraint: 'max_10kg_for_expedited_priority',
          },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    // Business Rule 2: Fragile items must be flown below 300 meters to reduce wind sheer turbulence
    if (packageDetails.isFragile && destination && destination.altitudeMeters > 300) {
      return res.status(422).json({
        status: 'error',
        statusCode: 422,
        code: 'FRAGILE_ALTITUDE_CEILING_VIOLATION',
        message: 'Fragile cargo cannot be routed above 300 meters altitude due to atmospheric turbulence safety protocols.',
        errors: [
          {
            field: 'destination.altitudeMeters',
            value: destination.altitudeMeters,
            constraint: 'max_300m_for_fragile_cargo',
          },
        ],
        timestamp: new Date().toISOString(),
      });
    }
  }

  next();
};

module.exports = {
  validateSyntax,
  validateDeliverySemantics,
};
