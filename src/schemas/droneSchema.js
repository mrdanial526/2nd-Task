/**
 * AeroGrid Drone Validation Schemas (Zod)
 */

const { z } = require('zod');

const droneRegistrationSchema = z.object({
  serialNumber: z
    .string({ required_error: 'serialNumber is required' })
    .regex(/^AG-[A-Z0-9]{2,4}-[0-9]{3,4}$/, {
      message: "serialNumber must match the standard format (e.g., 'AG-X8-9042')",
    }),
  model: z
    .string({ required_error: 'model is required' })
    .min(3, 'model must be at least 3 characters')
    .max(50, 'model cannot exceed 50 characters'),
  maxPayloadKg: z
    .number({ required_error: 'maxPayloadKg is required', invalid_type_error: 'maxPayloadKg must be a number' })
    .positive('maxPayloadKg must be greater than 0')
    .max(50, 'maxPayloadKg cannot exceed 50kg'),
  batteryCapacityMah: z
    .number({ required_error: 'batteryCapacityMah is required', invalid_type_error: 'batteryCapacityMah must be a number' })
    .int('batteryCapacityMah must be an integer')
    .min(5000, 'batteryCapacityMah must be at least 5000mAh')
    .max(50000, 'batteryCapacityMah cannot exceed 50000mAh'),
  homeBaseId: z
    .string({ required_error: 'homeBaseId is required' })
    .min(3, 'homeBaseId must be at least 3 characters')
    .max(30, 'homeBaseId cannot exceed 30 characters'),
});

const droneStatusUpdateSchema = z.object({
  status: z.enum(['IDLE', 'DISPATCHED', 'IN_FLIGHT', 'RETURNING', 'MAINTENANCE', 'OFFLINE'], {
    errorMap: () => ({
      message: "status must be one of: 'IDLE', 'DISPATCHED', 'IN_FLIGHT', 'RETURNING', 'MAINTENANCE', 'OFFLINE'",
    }),
  }),
  reason: z.string().min(3).optional(),
});

module.exports = {
  droneRegistrationSchema,
  droneStatusUpdateSchema,
};
