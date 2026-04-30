// lib/supabase/database.types.ts
// Типи для бази даних MoonPlants IoT v2
// Ці типи дозволяють Supabase клієнту коректно працювати з нашими таблицями.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    public: {
        Tables: {
            devices: {
                Row: {
                    id: string;
                    owner_user_id: string | null;
                    status: "unclaimed" | "claimed" | "revoked";
                    display_name: string | null;
                    channels_count: number;
                    supports_pumps: boolean;
                    supports_light: boolean;
                    firmware_version: string | null;
                    claim_code_hash: string;
                    claim_code_used_at: string | null;
                    failed_claim_attempts: number;
                    last_failed_claim_at: string | null;
                    last_seq: number;
                    last_seen_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_user_id?: string | null;
                    status?: "unclaimed" | "claimed" | "revoked";
                    display_name?: string | null;
                    channels_count?: number;
                    supports_pumps?: boolean;
                    supports_light?: boolean;
                    firmware_version?: string | null;
                    claim_code_hash: string;
                    claim_code_used_at?: string | null;
                    failed_claim_attempts?: number;
                    last_failed_claim_at?: string | null;
                    last_seq?: number;
                    last_seen_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    owner_user_id?: string | null;
                    status?: "unclaimed" | "claimed" | "revoked";
                    display_name?: string | null;
                    channels_count?: number;
                    supports_pumps?: boolean;
                    supports_light?: boolean;
                    firmware_version?: string | null;
                    claim_code_hash?: string;
                    claim_code_used_at?: string | null;
                    failed_claim_attempts?: number;
                    last_failed_claim_at?: string | null;
                    last_seq?: number;
                    last_seen_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            device_credentials: {
                Row: {
                    device_id: string;
                    hmac_secret: string; // bytea comes as hex string via service role
                    secret_version: number;
                    rotated_at: string;
                };
                Insert: {
                    device_id: string;
                    hmac_secret: string;
                    secret_version?: number;
                    rotated_at?: string;
                };
                Update: {
                    device_id?: string;
                    hmac_secret?: string;
                    secret_version?: number;
                    rotated_at?: string;
                };
                Relationships: [];
            };
            species_cache: {
                Row: {
                    id: string;
                    perenual_id: number;
                    common_name: string | null;
                    scientific_name: Json | null;
                    family: string | null;
                    type: string | null;
                    watering: string | null;
                    sunlight: Json | null;
                    indoor: boolean | null;
                    cycle: string | null;
                    default_image_url: string | null;
                    raw_json: Json | null;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    perenual_id: number;
                    common_name?: string | null;
                    scientific_name?: Json | null;
                    family?: string | null;
                    type?: string | null;
                    watering?: string | null;
                    sunlight?: Json | null;
                    indoor?: boolean | null;
                    cycle?: string | null;
                    default_image_url?: string | null;
                    raw_json?: Json | null;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    perenual_id?: number;
                    common_name?: string | null;
                    scientific_name?: Json | null;
                    family?: string | null;
                    type?: string | null;
                    watering?: string | null;
                    sunlight?: Json | null;
                    indoor?: boolean | null;
                    cycle?: string | null;
                    default_image_url?: string | null;
                    raw_json?: Json | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            plants: {
                Row: {
                    id: string;
                    owner_user_id: string;
                    device_id: string | null;
                    soil_channel: number | null;
                    name: string | null;
                    species_name: string;
                    species_cache_id: string | null;
                    image_url: string | null;
                    image_source: "user" | "perenual" | "none";
                    age_months: number | null;
                    pot_volume_ml: number | null;
                    pot_height_cm: number | null;
                    pot_diameter_cm: number | null;
                    auto_watering_enabled: boolean;
                    auto_light_enabled: boolean;
                    last_watered_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_user_id: string;
                    device_id?: string | null;
                    soil_channel?: number | null;
                    name?: string | null;
                    species_name: string;
                    species_cache_id?: string | null;
                    image_url?: string | null;
                    image_source?: "user" | "perenual" | "none";
                    age_months?: number | null;
                    pot_volume_ml?: number | null;
                    pot_height_cm?: number | null;
                    pot_diameter_cm?: number | null;
                    auto_watering_enabled?: boolean;
                    auto_light_enabled?: boolean;
                    last_watered_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    owner_user_id?: string;
                    device_id?: string | null;
                    soil_channel?: number | null;
                    name?: string | null;
                    species_name?: string;
                    species_cache_id?: string | null;
                    image_url?: string | null;
                    image_source?: "user" | "perenual" | "none";
                    age_months?: number | null;
                    pot_volume_ml?: number | null;
                    pot_height_cm?: number | null;
                    pot_diameter_cm?: number | null;
                    auto_watering_enabled?: boolean;
                    auto_light_enabled?: boolean;
                    last_watered_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            measurements: {
                Row: {
                    id: string;
                    plant_id: string;
                    device_id: string;
                    soil_moisture_raw: number | null;
                    soil_moisture_pct: number | null;
                    air_temp_c: number | null;
                    air_humidity_pct: number | null;
                    light_lux: number | null;
                    battery_v: number | null;
                    rssi_dbm: number | null;
                    seq: number;
                    measured_at: string;
                    ingested_at: string;
                };
                Insert: {
                    id?: string;
                    plant_id: string;
                    device_id: string;
                    soil_moisture_raw?: number | null;
                    soil_moisture_pct?: number | null;
                    air_temp_c?: number | null;
                    air_humidity_pct?: number | null;
                    light_lux?: number | null;
                    battery_v?: number | null;
                    rssi_dbm?: number | null;
                    seq: number;
                    measured_at: string;
                    ingested_at?: string;
                };
                Update: {
                    id?: string;
                    plant_id?: string;
                    device_id?: string;
                    soil_moisture_raw?: number | null;
                    soil_moisture_pct?: number | null;
                    air_temp_c?: number | null;
                    air_humidity_pct?: number | null;
                    light_lux?: number | null;
                    battery_v?: number | null;
                    rssi_dbm?: number | null;
                    seq?: number;
                    measured_at?: string;
                    ingested_at?: string;
                };
                Relationships: [];
            };
            watering_events: {
                Row: {
                    id: string;
                    plant_id: string;
                    source: "manual" | "auto" | "command";
                    water_ml: number | null;
                    happened_at: string;
                    note: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    plant_id: string;
                    source?: "manual" | "auto" | "command";
                    water_ml?: number | null;
                    happened_at?: string;
                    note?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    plant_id?: string;
                    source?: "manual" | "auto" | "command";
                    water_ml?: number | null;
                    happened_at?: string;
                    note?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            predictions: {
                Row: {
                    id: string;
                    plant_id: string;
                    predicted_at: string;
                    next_watering_at: string | null;
                    recommended_water_ml: number | null;
                    confidence: number | null;
                    model: string;
                    details: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    plant_id: string;
                    predicted_at?: string;
                    next_watering_at?: string | null;
                    recommended_water_ml?: number | null;
                    confidence?: number | null;
                    model?: string;
                    details?: Json | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    plant_id?: string;
                    predicted_at?: string;
                    next_watering_at?: string | null;
                    recommended_water_ml?: number | null;
                    confidence?: number | null;
                    model?: string;
                    details?: Json | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            device_commands: {
                Row: {
                    id: string;
                    device_id: string;
                    type: "PUMP_WATER" | "PUMP_WATER_SEC" | "LIGHT_ON" | "LIGHT_OFF" | "SET_CONFIG";
                    payload: Json;
                    status: "queued" | "sent" | "acked" | "failed" | "expired" | "canceled";
                    created_at: string;
                    send_after: string;
                    expires_at: string;
                    sent_at: string | null;
                    acked_at: string | null;
                    idempotency_key: string;
                    result: Json | null;
                };
                Insert: {
                    id?: string;
                    device_id: string;
                    type: "PUMP_WATER" | "PUMP_WATER_SEC" | "LIGHT_ON" | "LIGHT_OFF" | "SET_CONFIG";
                    payload?: Json;
                    status?: "queued" | "sent" | "acked" | "failed" | "expired" | "canceled";
                    created_at?: string;
                    send_after?: string;
                    expires_at?: string;
                    sent_at?: string | null;
                    acked_at?: string | null;
                    idempotency_key: string;
                    result?: Json | null;
                };
                Update: {
                    id?: string;
                    device_id?: string;
                    type?: "PUMP_WATER" | "LIGHT_ON" | "LIGHT_OFF" | "SET_CONFIG";
                    payload?: Json;
                    status?: "queued" | "sent" | "acked" | "failed" | "expired" | "canceled";
                    created_at?: string;
                    send_after?: string;
                    expires_at?: string;
                    sent_at?: string | null;
                    acked_at?: string | null;
                    idempotency_key?: string;
                    result?: Json | null;
                };
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: {
            device_status: "unclaimed" | "claimed" | "revoked";
            command_type: "PUMP_WATER" | "PUMP_WATER_SEC" | "LIGHT_ON" | "LIGHT_OFF" | "SET_CONFIG";
            command_status: "queued" | "sent" | "acked" | "failed" | "expired" | "canceled";
            image_source: "user" | "perenual" | "none";
            watering_source: "manual" | "auto" | "command";
        };
        CompositeTypes: Record<string, never>;
    };
};

