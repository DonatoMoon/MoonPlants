-- ============================================================
-- MoonPlants — Reset to IoT v2 Schema
-- ============================================================
-- Created: 2026-03-06
-- Drops all old tables and recreates full IoT v2 schema.
-- Safe to run: data loss is acceptable at this stage.
-- ============================================================

-- ============================================================
-- 0. SHARED TRIGGER FUNCTION (create if not exists)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. DROP OLD OBJECTS
-- ============================================================

DROP VIEW IF EXISTS plants_with_latest_measurements CASCADE;
DROP VIEW IF EXISTS plant_statistics CASCADE;
DROP TABLE IF EXISTS device_logs CASCADE;
DROP TABLE IF EXISTS plant_care_logs CASCADE;
DROP TABLE IF EXISTS watering_predictions CASCADE;
DROP TABLE IF EXISTS watering_commands CASCADE;
DROP TABLE IF EXISTS measurements CASCADE;
DROP TABLE IF EXISTS device_commands CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS watering_events CASCADE;
DROP TABLE IF EXISTS plants CASCADE;
DROP TABLE IF EXISTS species_cache CASCADE;
DROP TABLE IF EXISTS device_credentials CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS iot_devices CASCADE;

-- Drop old enums if exist
DROP TYPE IF EXISTS device_status CASCADE;
DROP TYPE IF EXISTS command_type CASCADE;
DROP TYPE IF EXISTS command_status CASCADE;
DROP TYPE IF EXISTS image_source CASCADE;
DROP TYPE IF EXISTS watering_source CASCADE;

-- ============================================================
-- 2. ENUMS
-- ============================================================

CREATE TYPE device_status   AS ENUM ('unclaimed', 'claimed', 'revoked');
CREATE TYPE command_type    AS ENUM ('PUMP_WATER', 'LIGHT_ON', 'LIGHT_OFF', 'SET_CONFIG');
CREATE TYPE command_status  AS ENUM ('queued', 'sent', 'acked', 'failed', 'expired', 'canceled');
CREATE TYPE image_source    AS ENUM ('user', 'perenual', 'none');
CREATE TYPE watering_source AS ENUM ('manual', 'auto', 'command');

-- ============================================================
-- 3. TABLE: devices
-- ============================================================

CREATE TABLE devices (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

    status                  device_status NOT NULL DEFAULT 'unclaimed',
    display_name            TEXT,

    channels_count          INT           NOT NULL DEFAULT 4 CHECK (channels_count >= 1 AND channels_count <= 16),
    supports_pumps          BOOLEAN       NOT NULL DEFAULT TRUE,
    supports_light          BOOLEAN       NOT NULL DEFAULT FALSE,

    firmware_version        TEXT,

    claim_code_hash         TEXT          NOT NULL,
    claim_code_used_at      TIMESTAMPTZ,
    failed_claim_attempts   INT           NOT NULL DEFAULT 0,
    last_failed_claim_at    TIMESTAMPTZ,

    last_seq                BIGINT        NOT NULL DEFAULT 0,

    last_seen_at            TIMESTAMPTZ,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_owner  ON devices(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_devices_status ON devices(status);

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  devices          IS 'Physical IoT controllers (ESP32)';
COMMENT ON COLUMN devices.last_seq IS 'Monotonic request counter for anti-replay';

-- ============================================================
-- 4. TABLE: device_credentials
-- ============================================================

CREATE TABLE device_credentials (
    device_id       UUID  PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    hmac_secret     BYTEA NOT NULL,
    secret_version  INT   NOT NULL DEFAULT 1,
    rotated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  device_credentials             IS 'HMAC secrets for IoT device authentication';
COMMENT ON COLUMN device_credentials.hmac_secret IS 'Readable only by backend via service role';

-- ============================================================
-- 5. TABLE: species_cache
-- ============================================================

CREATE TABLE species_cache (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    perenual_id       INT     UNIQUE NOT NULL,

    common_name       TEXT,
    scientific_name   JSONB,
    family            TEXT,
    type              TEXT,
    watering          TEXT,
    sunlight          JSONB,
    indoor            BOOLEAN,
    cycle             TEXT,

    default_image_url TEXT,
    raw_json          JSONB,

    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_species_cache_perenual_id ON species_cache(perenual_id);

CREATE TRIGGER update_species_cache_updated_at
    BEFORE UPDATE ON species_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE species_cache IS 'Plant species cache from Perenual API';

-- ============================================================
-- 6. TABLE: plants
-- ============================================================

CREATE TABLE plants (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    device_id             UUID         REFERENCES devices(id) ON DELETE SET NULL,
    soil_channel          INT          CHECK (soil_channel >= 1 AND soil_channel <= 16),

    name                  TEXT,
    species_name          TEXT         NOT NULL,
    species_cache_id      UUID         REFERENCES species_cache(id) ON DELETE SET NULL,

    image_url             TEXT,
    image_source          image_source NOT NULL DEFAULT 'none',

    age_months            INT          CHECK (age_months >= 0),
    pot_volume_ml         INT          CHECK (pot_volume_ml > 0),
    pot_height_cm         NUMERIC(5,2) CHECK (pot_height_cm > 0),
    pot_diameter_cm       NUMERIC(5,2) CHECK (pot_diameter_cm > 0),

    auto_watering_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
    auto_light_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,

    last_watered_at       TIMESTAMPTZ,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_plants_device_channel
    ON plants(device_id, soil_channel)
    WHERE device_id IS NOT NULL AND soil_channel IS NOT NULL;

CREATE INDEX idx_plants_owner         ON plants(owner_user_id);
CREATE INDEX idx_plants_device        ON plants(device_id)        WHERE device_id IS NOT NULL;
CREATE INDEX idx_plants_species_cache ON plants(species_cache_id) WHERE species_cache_id IS NOT NULL;

CREATE TRIGGER update_plants_updated_at
    BEFORE UPDATE ON plants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  plants             IS 'User plants linked to IoT sensor channel';
COMMENT ON COLUMN plants.soil_channel IS 'Soil sensor channel number on controller (1..N)';

-- ============================================================
-- 7. TABLE: measurements
-- ============================================================

CREATE TABLE measurements (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id          UUID         NOT NULL REFERENCES plants(id)  ON DELETE CASCADE,
    device_id         UUID         NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

    soil_moisture_raw INT,
    soil_moisture_pct NUMERIC(5,2) CHECK (soil_moisture_pct >= 0 AND soil_moisture_pct <= 100),
    air_temp_c        NUMERIC(5,2) CHECK (air_temp_c >= -50 AND air_temp_c <= 100),
    air_humidity_pct  NUMERIC(5,2) CHECK (air_humidity_pct >= 0 AND air_humidity_pct <= 100),
    light_lux         NUMERIC(8,2) CHECK (light_lux >= 0),

    battery_v         NUMERIC(4,2),
    rssi_dbm          INT,

    seq               BIGINT       NOT NULL,

    measured_at       TIMESTAMPTZ  NOT NULL,
    ingested_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_measurements_plant_time  ON measurements(plant_id,  measured_at DESC);
CREATE INDEX idx_measurements_device_time ON measurements(device_id, measured_at DESC);

CREATE UNIQUE INDEX idx_measurements_idempotency ON measurements(device_id, seq, plant_id);

COMMENT ON TABLE  measurements     IS 'IoT sensor readings linked to a plant';
COMMENT ON COLUMN measurements.seq IS 'Monotonic device counter (anti-replay + idempotency)';

-- ============================================================
-- 8. TABLE: watering_events
-- ============================================================

CREATE TABLE watering_events (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id    UUID            NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    source      watering_source NOT NULL DEFAULT 'manual',
    water_ml    INT             CHECK (water_ml > 0),
    happened_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    note        TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_watering_events_plant ON watering_events(plant_id, happened_at DESC);

COMMENT ON TABLE watering_events IS 'Watering facts for history and analysis';

-- ============================================================
-- 9. TABLE: predictions
-- ============================================================

CREATE TABLE predictions (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id             UUID         NOT NULL REFERENCES plants(id) ON DELETE CASCADE,

    predicted_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    next_watering_at     TIMESTAMPTZ,
    recommended_water_ml INT          CHECK (recommended_water_ml > 0),
    confidence           NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),

    model                TEXT         NOT NULL DEFAULT 'rulebased_v1',
    details              JSONB,

    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_plant ON predictions(plant_id, predicted_at DESC);

COMMENT ON TABLE predictions IS 'Next watering predictions';

-- ============================================================
-- 10. TABLE: device_commands
-- ============================================================

CREATE TABLE device_commands (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID           NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

    type            command_type   NOT NULL,
    payload         JSONB          NOT NULL DEFAULT '{}',

    status          command_status NOT NULL DEFAULT 'queued',

    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    send_after      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW() + INTERVAL '1 hour',

    sent_at         TIMESTAMPTZ,
    acked_at        TIMESTAMPTZ,

    idempotency_key TEXT           UNIQUE NOT NULL,

    result          JSONB
);

CREATE INDEX idx_device_commands_device_status
    ON device_commands(device_id, status)
    WHERE status IN ('queued', 'sent');

CREATE INDEX idx_device_commands_expires
    ON device_commands(expires_at)
    WHERE status IN ('queued', 'sent');

COMMENT ON TABLE  device_commands                 IS 'Command queue for IoT devices with ACK flow';
COMMENT ON COLUMN device_commands.idempotency_key IS 'Prevents duplicate commands';

-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE devices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE species_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE watering_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands    ENABLE ROW LEVEL SECURITY;

-- devices
CREATE POLICY "Users can view their claimed devices"
    ON devices FOR SELECT USING (owner_user_id = auth.uid());

-- device_credentials: no policies → service role only

-- species_cache
CREATE POLICY "Anyone can read species cache"
    ON species_cache FOR SELECT USING (true);

-- plants
CREATE POLICY "Users can view their own plants"
    ON plants FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert their own plants"
    ON plants FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own plants"
    ON plants FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their own plants"
    ON plants FOR DELETE USING (owner_user_id = auth.uid());

-- measurements
CREATE POLICY "Users can view measurements of their plants"
    ON measurements FOR SELECT
    USING (plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid()));

-- watering_events
CREATE POLICY "Users can view watering events of their plants"
    ON watering_events FOR SELECT
    USING (plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can insert watering events for their plants"
    ON watering_events FOR INSERT
    WITH CHECK (plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid()));

-- predictions
CREATE POLICY "Users can view predictions for their plants"
    ON predictions FOR SELECT
    USING (plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid()));

-- device_commands
CREATE POLICY "Users can view commands for their devices"
    ON device_commands FOR SELECT
    USING (device_id IN (SELECT id FROM devices WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can insert commands for their devices"
    ON device_commands FOR INSERT
    WITH CHECK (device_id IN (SELECT id FROM devices WHERE owner_user_id = auth.uid()));

-- ============================================================
-- 12. FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION expire_stale_commands()
RETURNS void AS $$
BEGIN
    UPDATE device_commands
    SET status = 'expired'
    WHERE status IN ('queued', 'sent')
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_latest_measurement(p_plant_id UUID)
RETURNS TABLE (
    soil_moisture_pct NUMERIC,
    air_temp_c        NUMERIC,
    air_humidity_pct  NUMERIC,
    light_lux         NUMERIC,
    measured_at       TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.soil_moisture_pct, m.air_temp_c, m.air_humidity_pct, m.light_lux, m.measured_at
    FROM measurements m
    WHERE m.plant_id = p_plant_id
    ORDER BY m.measured_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_average_measurements(
    p_plant_id UUID,
    p_days     INTEGER DEFAULT 7
)
RETURNS TABLE (
    avg_soil_moisture NUMERIC,
    avg_air_temp      NUMERIC,
    avg_air_humidity  NUMERIC,
    avg_light         NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        AVG(m.soil_moisture_pct)::NUMERIC(5,2),
        AVG(m.air_temp_c)::NUMERIC(5,2),
        AVG(m.air_humidity_pct)::NUMERIC(5,2),
        AVG(m.light_lux)::NUMERIC(8,2)
    FROM measurements m
    WHERE m.plant_id = p_plant_id
      AND m.measured_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW plants_with_latest_measurements AS
SELECT
    p.*,
    m.soil_moisture_pct AS last_soil_moisture,
    m.air_temp_c        AS last_air_temp,
    m.air_humidity_pct  AS last_air_humidity,
    m.light_lux         AS last_light,
    m.measured_at       AS last_measurement_at
FROM plants p
LEFT JOIN LATERAL (
    SELECT * FROM measurements
    WHERE plant_id = p.id
    ORDER BY measured_at DESC
    LIMIT 1
) m ON true;

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'IoT v2 migration completed!';
    RAISE NOTICE 'Tables: devices, device_credentials, species_cache, plants, measurements, watering_events, predictions, device_commands';
    RAISE NOTICE 'RLS policies configured';
    RAISE NOTICE 'Enums, indexes, triggers, functions ready';
END $$;

