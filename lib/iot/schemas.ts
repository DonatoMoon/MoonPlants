// lib/iot/schemas.ts
// Zod schemas для IoT API валідації

import { z } from "zod";

// === Measurements from device ===

export const soilChannelSchema = z.object({
    channel: z.number().int().min(1).max(16),
    moistureRaw: z.number().int().min(0).max(65535),
});

export const iotMeasurementPayloadSchema = z.object({
    measuredAt: z.number().int().positive(), // unix seconds
    air: z.object({
        tempC: z.number().min(-50).max(100),
        humidityPct: z.number().min(0).max(100),
    }).optional(),
    lightLux: z.number().min(0).optional(),
    soil: z.array(soilChannelSchema).min(1).max(16),
    batteryV: z.number().min(0).max(10).optional(),
    rssiDbm: z.number().int().min(-120).max(0).optional(),
});

export type IotMeasurementPayload = z.infer<typeof iotMeasurementPayloadSchema>;

// === Command ACK from device ===

export const commandAckPayloadSchema = z.object({
    status: z.enum(["ok", "failed", "partial"]),
    executedAt: z.number().int().positive().optional(), // unix seconds
    result: z.record(z.string(), z.unknown()).optional(),
});

export type CommandAckPayload = z.infer<typeof commandAckPayloadSchema>;

// === Device claim (user action) ===

export const claimDeviceSchema = z.object({
    deviceId: z.string().uuid(),
    claimCode: z.string().min(16).max(64),
});

export type ClaimDeviceInput = z.infer<typeof claimDeviceSchema>;

// === Create plant ===

export const createPlantSchema = z.object({
    deviceId: z.string().uuid().optional(),
    soilChannel: z.number().int().min(1).max(16).optional(),
    name: z.string().min(1).max(200),
    speciesName: z.string().min(1).max(300),
    perenualId: z.number().int().positive().optional(),
    potVolumeMl: z.number().int().positive().optional(),
    potDiameterCm: z.number().positive().optional(),
    potHeightCm: z.number().positive().optional(),
    lastWateredAt: z.string().datetime().optional().nullable(),
});

export type CreatePlantInput = z.infer<typeof createPlantSchema>;

// === Manual watering event ===

export const createWateringEventSchema = z.object({
    waterMl: z.number().int().positive().optional(),
    happenedAt: z.string().datetime().optional(),
    note: z.string().max(500).optional(),
});

export type CreateWateringEventInput = z.infer<typeof createWateringEventSchema>;

// === Water now command ===

export const waterNowSchema = z.object({
    waterMl: z.number().int().positive().max(5000),
});

export type WaterNowInput = z.infer<typeof waterNowSchema>;

// === Light command ===

export const lightCommandSchema = z.object({
    mode: z.enum(["on", "off", "on_for"]),
    durationSec: z.number().int().positive().max(86400).optional(),
});

export type LightCommandInput = z.infer<typeof lightCommandSchema>;

// === Measurements query ===

export const measurementsQuerySchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export type MeasurementsQuery = z.infer<typeof measurementsQuerySchema>;


