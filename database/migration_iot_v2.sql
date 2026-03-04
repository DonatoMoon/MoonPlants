-- ===============================================
-- MoonPlants IoT Integration Migration v2
-- ===============================================
-- Дата: 2026-03-02
-- Цей файл замінює стару схему (iot_devices, watering_commands, watering_predictions)
-- новою архітектурою з HMAC auth, multi-channel, command queue з ACK.
-- ===============================================

-- ===============================================
-- 0. ENUMS
-- ===============================================

CREATE TYPE device_status AS ENUM ('unclaimed', 'claimed', 'revoked');
CREATE TYPE command_type AS ENUM ('PUMP_WATER', 'LIGHT_ON', 'LIGHT_OFF', 'SET_CONFIG');
CREATE TYPE command_status AS ENUM ('queued', 'sent', 'acked', 'failed', 'expired', 'canceled');
CREATE TYPE image_source AS ENUM ('user', 'perenual', 'none');
CREATE TYPE watering_source AS ENUM ('manual', 'auto', 'command');

-- ===============================================
-- 1. DROP OLD TABLES (якщо існують)
-- ===============================================

DROP VIEW IF EXISTS plants_with_latest_measurements CASCADE;
DROP VIEW IF EXISTS plant_statistics CASCADE;
DROP TABLE IF EXISTS device_logs CASCADE;
DROP TABLE IF EXISTS plant_care_logs CASCADE;
DROP TABLE IF EXISTS watering_predictions CASCADE;
DROP TABLE IF EXISTS watering_commands CASCADE;
DROP TABLE IF EXISTS measurements CASCADE;
DROP TABLE IF EXISTS iot_devices CASCADE;
DROP TABLE IF EXISTS plants CASCADE;

-- Зберігаємо update_updated_at_column() — вона вже існує

-- ===============================================
-- 2. ТАБЛИЦЯ: devices
-- Фізичні ESP32 контролери
-- ===============================================

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    status device_status NOT NULL DEFAULT 'unclaimed',
    display_name TEXT,

    -- Можливості
    channels_count INT NOT NULL DEFAULT 4 CHECK (channels_count >= 1 AND channels_count <= 16),
    supports_pumps BOOLEAN NOT NULL DEFAULT TRUE,
    supports_light BOOLEAN NOT NULL DEFAULT FALSE,

    -- Firmware
    firmware_version TEXT,

    -- Claim security
    claim_code_hash TEXT NOT NULL,
    claim_code_used_at TIMESTAMPTZ,
    failed_claim_attempts INT NOT NULL DEFAULT 0,
    last_failed_claim_at TIMESTAMPTZ,

    -- Anti-replay
    last_seq BIGINT NOT NULL DEFAULT 0,

    -- Telemetry
    last_seen_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_owner ON devices(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_devices_status ON devices(status);

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE devices IS 'Фізичні IoT контролери (ESP32)';
COMMENT ON COLUMN devices.channels_count IS 'Кількість soil-sensor каналів (1..16)';
COMMENT ON COLUMN devices.last_seq IS 'Монотонний лічильник запитів для anti-replay';

-- ===============================================
-- 3. ТАБЛИЦЯ: device_credentials
-- HMAC секрети для IoT авторизації
-- ===============================================

CREATE TABLE device_credentials (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    hmac_secret BYTEA NOT NULL,
    secret_version INT NOT NULL DEFAULT 1,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE device_credentials IS 'HMAC секрети для аутентифікації IoT пристроїв';
COMMENT ON COLUMN device_credentials.hmac_secret IS 'Читається тільки backend з service role';

-- ===============================================
-- 4. ТАБЛИЦЯ: species_cache
-- Кеш даних з Perenual API
-- ===============================================

CREATE TABLE species_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perenual_id INT UNIQUE NOT NULL,

    common_name TEXT,
    scientific_name JSONB,  -- ["Ficus lyrata"]
    family TEXT,
    type TEXT,
    watering TEXT,
    sunlight JSONB,         -- ["full sun", "part shade"]
    indoor BOOLEAN,
    cycle TEXT,

    -- Наше фото (завантажене в Supabase Storage)
    default_image_url TEXT,

    -- Повний JSON від Perenual (для розширення без міграцій)
    raw_json JSONB,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_species_cache_perenual_id ON species_cache(perenual_id);

CREATE TRIGGER update_species_cache_updated_at
    BEFORE UPDATE ON species_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE species_cache IS 'Кеш видів рослин з Perenual API (зображення зберігаються в Supabase Storage)';

-- ===============================================
-- 5. ТАБЛИЦЯ: plants (оновлена)
-- Рослини користувачів, прив''язані до каналу девайса
-- ===============================================

CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Прив''язка до девайса
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    soil_channel INT CHECK (soil_channel >= 1 AND soil_channel <= 16),

    -- Назви
    name TEXT,                              -- Нікнейм (напр. "Мій фікус")
    species_name TEXT NOT NULL,             -- Назва виду (напр. "Ficus lyrata")
    species_cache_id UUID REFERENCES species_cache(id) ON DELETE SET NULL,

    -- Медіа
    image_url TEXT,
    image_source image_source NOT NULL DEFAULT 'none',

    -- Параметри
    age_months INT CHECK (age_months >= 0),
    pot_volume_ml INT CHECK (pot_volume_ml > 0),
    pot_height_cm NUMERIC(5,2) CHECK (pot_height_cm > 0),
    pot_diameter_cm NUMERIC(5,2) CHECK (pot_diameter_cm > 0),

    -- Автоматика
    auto_watering_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_light_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Догляд
    last_watered_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Критично: один канал — одна рослина на девайсі
CREATE UNIQUE INDEX idx_plants_device_channel
    ON plants(device_id, soil_channel)
    WHERE device_id IS NOT NULL AND soil_channel IS NOT NULL;

CREATE INDEX idx_plants_owner ON plants(owner_user_id);
CREATE INDEX idx_plants_device ON plants(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_plants_species_cache ON plants(species_cache_id) WHERE species_cache_id IS NOT NULL;

CREATE TRIGGER update_plants_updated_at
    BEFORE UPDATE ON plants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE plants IS 'Рослини користувачів з прив''язкою до IoT каналу';
COMMENT ON COLUMN plants.soil_channel IS 'Номер каналу soil-сенсора на контролері (1..N)';
COMMENT ON COLUMN plants.image_source IS 'Звідки фото: user upload, perenual cache, або немає';

-- ===============================================
-- 6. ТАБЛИЦЯ: measurements (оновлена)
-- Виміри з датчиків — завжди з plant_id
-- ===============================================

CREATE TABLE measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

    -- Виміри
    soil_moisture_raw INT,                                                      -- ADC сире значення
    soil_moisture_pct NUMERIC(5,2) CHECK (soil_moisture_pct >= 0 AND soil_moisture_pct <= 100),
    air_temp_c NUMERIC(5,2) CHECK (air_temp_c >= -50 AND air_temp_c <= 100),
    air_humidity_pct NUMERIC(5,2) CHECK (air_humidity_pct >= 0 AND air_humidity_pct <= 100),
    light_lux NUMERIC(8,2) CHECK (light_lux >= 0),

    -- Телеметрія
    battery_v NUMERIC(4,2),
    rssi_dbm INT,

    -- Anti-replay / idempotency
    seq BIGINT NOT NULL,

    -- Час
    measured_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Основні запити: за рослиною + час, за девайсом + час
CREATE INDEX idx_measurements_plant_time ON measurements(plant_id, measured_at DESC);
CREATE INDEX idx_measurements_device_time ON measurements(device_id, measured_at DESC);

-- Idempotency: (device_id, seq) — не вставляти двічі одне повідомлення
-- seq per device, but measurements fan out per channel, so we need device+seq+plant
CREATE UNIQUE INDEX idx_measurements_idempotency ON measurements(device_id, seq, plant_id);

COMMENT ON TABLE measurements IS 'Виміри з IoT датчиків, прив''язані до рослини';
COMMENT ON COLUMN measurements.seq IS 'Монотонний лічильник запитів від девайса (anti-replay + idempotency)';

-- ===============================================
-- 7. ТАБЛИЦЯ: watering_events
-- Факти поливу (ручний + автоматичний + команда)
-- ===============================================

CREATE TABLE watering_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    source watering_source NOT NULL DEFAULT 'manual',
    water_ml INT CHECK (water_ml > 0),
    happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_watering_events_plant ON watering_events(plant_id, happened_at DESC);

COMMENT ON TABLE watering_events IS 'Факти поливу для double-check і аналізу';

-- ===============================================
-- 8. ТАБЛИЦЯ: predictions
-- Прогнози поливу (rule-based / ML)
-- ===============================================

CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,

    predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_watering_at TIMESTAMPTZ,
    recommended_water_ml INT CHECK (recommended_water_ml > 0),
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),

    model TEXT NOT NULL DEFAULT 'rulebased_v1',
    details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_plant ON predictions(plant_id, predicted_at DESC);

COMMENT ON TABLE predictions IS 'Прогнози наступного поливу';

-- ===============================================
-- 9. ТАБЛИЦЯ: device_commands
-- Черга команд для IoT пристроїв
-- ===============================================

CREATE TABLE device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

    type command_type NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    -- payload examples:
    --   PUMP_WATER: { "channel": 2, "water_ml": 120, "max_duration_sec": 20 }
    --   LIGHT_ON:   { "duration_sec": 3600 }
    --   SET_CONFIG:  { "measurement_interval_sec": 300 }

    status command_status NOT NULL DEFAULT 'queued',

    -- Scheduling
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    send_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',

    -- Lifecycle
    sent_at TIMESTAMPTZ,
    acked_at TIMESTAMPTZ,

    -- Idempotency
    idempotency_key TEXT UNIQUE NOT NULL,

    -- Result from device
    result JSONB
);

CREATE INDEX idx_device_commands_device_status
    ON device_commands(device_id, status)
    WHERE status IN ('queued', 'sent');

CREATE INDEX idx_device_commands_expires
    ON device_commands(expires_at)
    WHERE status IN ('queued', 'sent');

COMMENT ON TABLE device_commands IS 'Черга команд для IoT пристроїв з ACK flow';
COMMENT ON COLUMN device_commands.idempotency_key IS 'Запобігає дублюванню команд';

-- ===============================================
-- 10. ROW LEVEL SECURITY
-- ===============================================

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE species_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE watering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;

-- === devices ===
CREATE POLICY "Users can view their claimed devices"
    ON devices FOR SELECT
    USING (owner_user_id = auth.uid());

-- claim робиться через server endpoint (service role), не потребує INSERT policy для юзера

-- === device_credentials ===
-- Ніхто через anon/authenticated не бачить секрети — тільки service role
-- (RLS enabled, жодної policy = повна блокування для anon/authenticated)

-- === species_cache ===
-- Публічний читання (кеш видів — не приватні дані)
CREATE POLICY "Anyone can read species cache"
    ON species_cache FOR SELECT
    USING (true);

-- Запис — тільки через service role (backend)

-- === plants ===
CREATE POLICY "Users can view their own plants"
    ON plants FOR SELECT
    USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert their own plants"
    ON plants FOR INSERT
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own plants"
    ON plants FOR UPDATE
    USING (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their own plants"
    ON plants FOR DELETE
    USING (owner_user_id = auth.uid());

-- === measurements ===
CREATE POLICY "Users can view measurements of their plants"
    ON measurements FOR SELECT
    USING (
        plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid())
    );
-- INSERT — тільки service role (IoT ingestion)

-- === watering_events ===
CREATE POLICY "Users can view watering events of their plants"
    ON watering_events FOR SELECT
    USING (
        plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid())
    );

CREATE POLICY "Users can insert watering events for their plants"
    ON watering_events FOR INSERT
    WITH CHECK (
        plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid())
    );

-- === predictions ===
CREATE POLICY "Users can view predictions for their plants"
    ON predictions FOR SELECT
    USING (
        plant_id IN (SELECT id FROM plants WHERE owner_user_id = auth.uid())
    );
-- INSERT — тільки service role (prediction engine)

-- === device_commands ===
CREATE POLICY "Users can view commands for their devices"
    ON device_commands FOR SELECT
    USING (
        device_id IN (SELECT id FROM devices WHERE owner_user_id = auth.uid())
    );

CREATE POLICY "Users can insert commands for their devices"
    ON device_commands FOR INSERT
    WITH CHECK (
        device_id IN (SELECT id FROM devices WHERE owner_user_id = auth.uid())
    );

-- === Функція: expire old commands ===
CREATE OR REPLACE FUNCTION expire_stale_commands()
RETURNS void AS $$
BEGIN
    UPDATE device_commands
    SET status = 'expired'
    WHERE status IN ('queued', 'sent')
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Cron (потрібен pg_cron):
-- SELECT cron.schedule('expire-commands', '*/5 * * * *', 'SELECT expire_stale_commands()');

-- ===============================================
-- 11. VIEWS
-- ===============================================

CREATE OR REPLACE VIEW plants_with_latest_measurements AS
SELECT
    p.*,
    m.soil_moisture_pct AS last_soil_moisture,
    m.air_temp_c AS last_air_temp,
    m.air_humidity_pct AS last_air_humidity,
    m.light_lux AS last_light,
    m.measured_at AS last_measurement_at
FROM plants p
LEFT JOIN LATERAL (
    SELECT *
    FROM measurements
    WHERE plant_id = p.id
    ORDER BY measured_at DESC
    LIMIT 1
) m ON true;

-- ===============================================
-- 12. HELPER FUNCTIONS
-- ===============================================

-- Отримати останній вимір
CREATE OR REPLACE FUNCTION get_latest_measurement(p_plant_id UUID)
RETURNS TABLE (
    soil_moisture_pct NUMERIC,
    air_temp_c NUMERIC,
    air_humidity_pct NUMERIC,
    light_lux NUMERIC,
    measured_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.soil_moisture_pct,
        m.air_temp_c,
        m.air_humidity_pct,
        m.light_lux,
        m.measured_at
    FROM measurements m
    WHERE m.plant_id = p_plant_id
    ORDER BY m.measured_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Середні значення за період
CREATE OR REPLACE FUNCTION get_average_measurements(
    p_plant_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    avg_soil_moisture NUMERIC,
    avg_air_temp NUMERIC,
    avg_air_humidity NUMERIC,
    avg_light NUMERIC
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

-- ===============================================
-- 13. REALTIME (опціонально)
-- ===============================================

-- ALTER PUBLICATION supabase_realtime ADD TABLE measurements;
-- ALTER PUBLICATION supabase_realtime ADD TABLE device_commands;

-- ===============================================
-- DONE
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '✓ IoT v2 migration completed!';
    RAISE NOTICE '✓ Tables: devices, device_credentials, species_cache, plants, measurements, watering_events, predictions, device_commands';
    RAISE NOTICE '✓ RLS policies configured';
    RAISE NOTICE '✓ Enums, indexes, triggers ready';
END $$;

