/**
 * AeroGrid Delivery Mission Validation Schemas (Zod)
 */

const { z } = require('zod');

const createDeliverySchema = z.object({
  droneId: z
    .string({ required_error: 'droneId is required' })
    .min(3, 'droneId must be at least 3 characters'),
  destination: z.object({
    address: z
      .string({ required_error: 'destination.address is required' })
      .min(5, 'destination.address must be at least 5 characters')
      .max(120, 'destination.address cannot exceed 120 characters'),
    latitude: z
      .number({ required_error: 'destination.latitude is required', invalid_type_error: 'latitude must be a number' })
      .min(-90, 'latitude must be >= -90.0')
      .max(90, 'latitude must be <= 90.0'),
    longitude: z
      .number({ required_error: 'destination.longitude is required', invalid_type_error: 'longitude must be a number' })
      .min(-180, 'longitude must be >= -180.0')
      .max(180, 'longitude must be <= 180.0'),
    altitudeMeters: z
      .number({ required_error: 'destination.altitudeMeters is required', invalid_type_error: 'altitudeMeters must be a number' })
      .min(10, 'altitudeMeters must be at least 10 meters')
      .max(500, 'altitudeMeters cannot exceed regulated airspace cap of 500 meters'),
  }),
  packageDetails: z.object({
    trackingCode: z
      .string({ required_error: 'packageDetails.trackingCode is required' })
      .regex(/^PKG-[0-9]{4}-[0-9]{4}$/, {
        message: "trackingCode must follow format 'PKG-YYYY-XXXX' (e.g., 'PKG-2026-9918')",
      }),
    weightKg: z
      .number({ required_error: 'packageDetails.weightKg is required', invalid_type_error: 'weightKg must be a number' })
      .positive('weightKg must be greater than 0')
      .max(25, 'Single package weight cannot exceed 25kg'),
    isFragile: z.boolean({ invalid_type_error: 'isFragile must be a boolean' }).default(false),
    category: z.enum(['MEDICAL_SUPPLIES', 'ELECTRONICS', 'PERISHABLE_FOOD', 'DOCUMENTS', 'GENERAL_CARGO'], {
      errorMap: () => ({
        message: "category must be one of: 'MEDICAL_SUPPLIES', 'ELECTRONICS', 'PERISHABLE_FOOD', 'DOCUMENTS', 'GENERAL_CARGO'",
      }),
    }),
  }),
  priority: z.enum(['STANDARD', 'EXPEDITED', 'EMERGENCY'], {
    errorMap: () => ({
      message: "priority must be 'STANDARD', 'EXPEDITED', or 'EMERGENCY'",
    }),
  }).default('STANDARD'),
});

const deliveryStateTransitionSchema = z.object({
  targetState: z.enum(['DISPATCHED', 'IN_FLIGHT', 'DELIVERED', 'ABORTED'], {
    errorMap: () => ({
      message: "targetState must be one of: 'DISPATCHED', 'IN_FLIGHT', 'DELIVERED', 'ABORTED'",
    }),
  }),
  reason: z.string().min(3, 'Transition reason must be at least 3 characters').optional(),
});

const telemetryUpdateSchema = z.object({
  currentLocation: z.object({
    latitude: z
      .number({ required_error: 'latitude is required', invalid_type_error: 'latitude must be a number' })
      .min(-90, 'latitude must be >= -90.0')
      .max(90, 'latitude must be <= 90.0'),
    longitude: z
      .number({ required_error: 'longitude is required', invalid_type_error: 'longitude must be a number' })
      .min(-180, 'longitude must be >= -180.0')
      .max(180, 'longitude must be <= 180.0'),
    altitudeMeters: z
      .number({ required_error: 'altitudeMeters is required', invalid_type_error: 'altitudeMeters must be a number' })
      .min(0, 'altitudeMeters must be >= 0')
      .max(500, 'altitudeMeters cannot exceed 500 meters'),
  }),
  currentSpeedKmh: z
    .number({ required_error: 'currentSpeedKmh is required', invalid_type_error: 'currentSpeedKmh must be a number' })
    .min(0, 'currentSpeedKmh must be non-negative')
    .max(160, 'currentSpeedKmh cannot exceed max aerodynamic safety speed of 160km/h'),
  batteryPercentageRemaining: z
    .number({ required_error: 'batteryPercentageRemaining is required', invalid_type_error: 'batteryPercentage must be a number' })
    .int('batteryPercentageRemaining must be an integer')
    .min(0, 'batteryPercentageRemaining must be >= 0')
    .max(100, 'batteryPercentageRemaining must be <= 100'),
  flightStatus: z.enum(['IN_FLIGHT', 'HOVERING', 'DESCENDING', 'DELIVERING', 'RETURNING'], {
    errorMap: () => ({
      message: "flightStatus must be one of: 'IN_FLIGHT', 'HOVERING', 'DESCENDING', 'DELIVERING', 'RETURNING'",
    }),
  }),
});

module.exports = {
  createDeliverySchema,
  deliveryStateTransitionSchema,
  telemetryUpdateSchema,
};
