-- ===============================================
-- MoonPlants Database Schema for Supabase
-- ===============================================
-- Версія: 1.0
-- Дата: 17.02.2026
-- СУБД: PostgreSQL (Supabase)
-- ===============================================

-- ===============================================
-- 1. ТАБЛИЦЯ: plants
-- Рослини користувачів
-- ===============================================

CREATE TABLE IF NOT EXISTS plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT, -- ID ESP пристрою прив'язаного до цієї рослини

    -- Назви
    name TEXT, -- Нікнейм від користувача (напр. "Мій улюблений кактус")
    species_name TEXT NOT NULL, -- Реальна назва виду (напр. "Ficus lyrata")
    species_id INTEGER, -- ID з Perenual API

    -- Медіа
    image_url TEXT, -- URL фото з Supabase Storage

    -- Параметри рослини
    age_months INTEGER CHECK (age_months >= 0),
    pot_height_cm NUMERIC(5,2) CHECK (pot_height_cm > 0),
    pot_diameter_cm NUMERIC(5,2) CHECK (pot_diameter_cm > 0),

    -- Догляд
    last_watered_at TIMESTAMPTZ,

    -- Метадані
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для plants
CREATE INDEX idx_plants_user_id ON plants(user_id);
CREATE INDEX idx_plants_device_id ON plants(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_plants_created_at ON plants(created_at DESC);

-- Тригер для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plants_updated_at
    BEFORE UPDATE ON plants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Коментарі
COMMENT ON TABLE plants IS 'Рослини користувачів з метаданими';
COMMENT ON COLUMN plants.device_id IS 'ID ESP пристрою для IoT інтеграції';
COMMENT ON COLUMN plants.species_id IS 'ID виду з Perenual API';

-- ===============================================
-- 2. ТАБЛИЦЯ: measurements
-- Виміри з датчиків IoT
-- ===============================================

CREATE TABLE IF NOT EXISTS measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,

    -- Виміри
    soil_moisture NUMERIC(5,2) NOT NULL CHECK (soil_moisture >= 0 AND soil_moisture <= 100), -- %
    air_temp NUMERIC(5,2) NOT NULL CHECK (air_temp >= -50 AND air_temp <= 100), -- °C
    air_humidity NUMERIC(5,2) NOT NULL CHECK (air_humidity >= 0 AND air_humidity <= 100), -- %
    light NUMERIC(8,2) NOT NULL CHECK (light >= 0), -- lux

    -- Час виміру
    measured_at TIMESTAMPTZ DEFAULT NOW(),

    -- Метадані
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для measurements
CREATE INDEX idx_measurements_plant_id ON measurements(plant_id);
CREATE INDEX idx_measurements_plant_time ON measurements(plant_id, measured_at DESC);
CREATE INDEX idx_measurements_time ON measurements(measured_at DESC);

-- Партиціонування по датах (для великих обсягів даних)
-- Розкоментуйте якщо плануєте зберігати багато історичних даних
-- CREATE TABLE measurements_2026 PARTITION OF measurements
--     FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Коментарі
COMMENT ON TABLE measurements IS 'Виміри з IoT датчиків для кожної рослини';
COMMENT ON COLUMN measurements.soil_moisture IS 'Вологість ґрунту у відсотках (0-100)';
COMMENT ON COLUMN measurements.air_temp IS 'Температура повітря в градусах Цельсія';
COMMENT ON COLUMN measurements.air_humidity IS 'Вологість повітря у відсотках (0-100)';
COMMENT ON COLUMN measurements.light IS 'Освітлення в люксах';

-- ===============================================
-- 3. ТАБЛИЦЯ: iot_devices
-- IoT пристрої (ESP32/ESP8266)
-- ===============================================

CREATE TABLE IF NOT EXISTS iot_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL, -- Унікальний ID пристрою (напр. "ESP_ABC123")
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Аутентифікація
    api_key TEXT UNIQUE NOT NULL, -- Унікальний ключ для API (sk-dev-xxx)

    -- Інформація про пристрій
    firmware_version TEXT,
    mac_address TEXT,

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,

    -- Конфігурація
    measurement_interval_seconds INTEGER DEFAULT 300, -- 5 хвилин
    command_check_interval_seconds INTEGER DEFAULT 60, -- 1 хвилина

    -- Метадані
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для iot_devices
CREATE INDEX idx_iot_devices_user_id ON iot_devices(user_id);
CREATE INDEX idx_iot_devices_device_id ON iot_devices(device_id);
CREATE INDEX idx_iot_devices_api_key ON iot_devices(api_key);
CREATE INDEX idx_iot_devices_active ON iot_devices(is_active) WHERE is_active = TRUE;

CREATE TRIGGER update_iot_devices_updated_at
    BEFORE UPDATE ON iot_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Функція для генерації API ключа
CREATE OR REPLACE FUNCTION generate_device_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'sk-dev-' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Коментарі
COMMENT ON TABLE iot_devices IS 'ESP пристрої для IoT моніторингу';
COMMENT ON COLUMN iot_devices.api_key IS 'Секретний ключ для API аутентифікації';

-- ===============================================
-- 4. ТАБЛИЦЯ: watering_commands
-- Команди поливу для ESP пристроїв
-- ===============================================

CREATE TABLE IF NOT EXISTS watering_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,

    -- Параметри поливу
    water_amount_ml INTEGER NOT NULL CHECK (water_amount_ml > 0 AND water_amount_ml <= 5000),

    -- Час
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,

    -- Статус
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),

    -- Результат виконання
    actual_amount_ml INTEGER,
    error_message TEXT,
    notes TEXT,

    -- Джерело команди
    source TEXT DEFAULT 'user' CHECK (source IN ('user', 'ai', 'schedule', 'manual')),
    created_by UUID REFERENCES auth.users(id),

    -- Метадані
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для watering_commands
CREATE INDEX idx_watering_commands_plant_id ON watering_commands(plant_id);
CREATE INDEX idx_watering_commands_device_id ON watering_commands(device_id);
CREATE INDEX idx_watering_commands_status ON watering_commands(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_watering_commands_scheduled ON watering_commands(scheduled_at) WHERE status = 'pending';

CREATE TRIGGER update_watering_commands_updated_at
    BEFORE UPDATE ON watering_commands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Коментарі
COMMENT ON TABLE watering_commands IS 'Команди поливу для ESP пристроїв';
COMMENT ON COLUMN watering_commands.water_amount_ml IS 'Кількість води в мілілітрах (1-5000)';
COMMENT ON COLUMN watering_commands.source IS 'Джерело команди: user (ручна), ai (AI прогноз), schedule (розклад)';

-- ===============================================
-- 5. ТАБЛИЦЯ: watering_predictions
-- AI прогнози для поливу
-- ===============================================

CREATE TABLE IF NOT EXISTS watering_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,

    -- Прогноз
    predicted_watering_date TIMESTAMPTZ NOT NULL,
    predicted_water_amount_ml INTEGER NOT NULL CHECK (predicted_water_amount_ml > 0),
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0.0 - 1.0

    -- Фактор розрахунку (для аналізу)
    factors JSONB, -- { "avg_moisture": 45, "avg_temp": 22, "pot_volume": 500, ... }

    -- Модель
    model_version TEXT,

    -- Статус
    was_correct BOOLEAN, -- Чи виявився прогноз точним
    actual_watering_date TIMESTAMPTZ,

    -- Метадані
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для watering_predictions
CREATE INDEX idx_watering_predictions_plant_id ON watering_predictions(plant_id);
CREATE INDEX idx_watering_predictions_date ON watering_predictions(predicted_watering_date);

-- Коментарі
COMMENT ON TABLE watering_predictions IS 'AI прогнози оптимального часу та об\'єму поливу';
COMMENT ON COLUMN watering_predictions.confidence_score IS 'Впевненість моделі (0.0 - 1.0)';

-- ===============================================
-- 6. ТАБЛИЦЯ: plant_care_logs
-- Журнал догляду за рослиною (нотатки користувача)
-- ===============================================

CREATE TABLE IF NOT EXISTS plant_care_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Тип події
    event_type TEXT NOT NULL CHECK (event_type IN ('watering', 'fertilizing', 'pruning', 'repotting', 'note', 'problem', 'other')),

    -- Опис
    title TEXT,
    description TEXT,

    -- Медіа
    images TEXT[], -- Масив URLs фото

    -- Метадані
    event_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для plant_care_logs
CREATE INDEX idx_plant_care_logs_plant_id ON plant_care_logs(plant_id);
CREATE INDEX idx_plant_care_logs_user_id ON plant_care_logs(user_id);
CREATE INDEX idx_plant_care_logs_event_date ON plant_care_logs(event_date DESC);

-- Коментарі
COMMENT ON TABLE plant_care_logs IS 'Журнал догляду - нотатки користувача про події з рослиною';

-- ===============================================
-- 7. ТАБЛИЦЯ: device_logs
-- Логи подій IoT пристроїв (для дебагу)
-- ===============================================

CREATE TABLE IF NOT EXISTS device_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,

    -- Лог
    log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error', 'debug')),
    message TEXT NOT NULL,
    details JSONB, -- Додаткові дані

    -- Час
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для device_logs
CREATE INDEX idx_device_logs_device_id ON device_logs(device_id);
CREATE INDEX idx_device_logs_logged_at ON device_logs(logged_at DESC);
CREATE INDEX idx_device_logs_level ON device_logs(log_level) WHERE log_level IN ('error', 'warning');

-- Партиціонування по датах (логи можуть рости швидко)
-- CREATE TABLE device_logs_2026 PARTITION OF device_logs
--     FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Автоматичне видалення старих логів (retention policy)
CREATE OR REPLACE FUNCTION delete_old_device_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM device_logs WHERE logged_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Cron job для очистки (потрібен pg_cron extension)
-- SELECT cron.schedule('delete-old-logs', '0 2 * * *', 'SELECT delete_old_device_logs()');

-- ===============================================
-- ROW LEVEL SECURITY (RLS)
-- Захист даних на рівні рядків
-- ===============================================

-- Увімкнути RLS для всіх таблиць
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE watering_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE watering_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_logs ENABLE ROW LEVEL SECURITY;

-- ========== POLICIES для plants ==========

-- Користувачі бачать тільки свої рослини
CREATE POLICY "Users can view their own plants"
    ON plants FOR SELECT
    USING (auth.uid() = user_id);

-- Користувачі можуть додавати свої рослини
CREATE POLICY "Users can insert their own plants"
    ON plants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Користувачі можуть оновлювати свої рослини
CREATE POLICY "Users can update their own plants"
    ON plants FOR UPDATE
    USING (auth.uid() = user_id);

-- Користувачі можуть видаляти свої рослини
CREATE POLICY "Users can delete their own plants"
    ON plants FOR DELETE
    USING (auth.uid() = user_id);

-- ========== POLICIES для measurements ==========

-- Користувачі бачать виміри своїх рослин
CREATE POLICY "Users can view measurements of their plants"
    ON measurements FOR SELECT
    USING (
        plant_id IN (
            SELECT id FROM plants WHERE user_id = auth.uid()
        )
    );

-- IoT пристрої можуть додавати виміри (через service_role або custom claim)
-- Це буде налаштовано через API endpoint з перевіркою device_key

-- ========== POLICIES для iot_devices ==========

CREATE POLICY "Users can view their own devices"
    ON iot_devices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
    ON iot_devices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
    ON iot_devices FOR UPDATE
    USING (auth.uid() = user_id);

-- ========== POLICIES для watering_commands ==========

CREATE POLICY "Users can view commands for their plants"
    ON watering_commands FOR SELECT
    USING (
        plant_id IN (
            SELECT id FROM plants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create commands for their plants"
    ON watering_commands FOR INSERT
    WITH CHECK (
        plant_id IN (
            SELECT id FROM plants WHERE user_id = auth.uid()
        )
    );

-- ========== POLICIES для watering_predictions ==========

CREATE POLICY "Users can view predictions for their plants"
    ON watering_predictions FOR SELECT
    USING (
        plant_id IN (
            SELECT id FROM plants WHERE user_id = auth.uid()
        )
    );

-- ========== POLICIES для plant_care_logs ==========

CREATE POLICY "Users can view their own care logs"
    ON plant_care_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own care logs"
    ON plant_care_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ========== POLICIES для device_logs ==========

CREATE POLICY "Users can view logs of their devices"
    ON device_logs FOR SELECT
    USING (
        device_id IN (
            SELECT device_id FROM iot_devices WHERE user_id = auth.uid()
        )
    );

-- ===============================================
-- ФУНКЦІЇ ДЛЯ РОБОТИ З ДАНИМИ
-- ===============================================

-- Функція для отримання останнього виміру для рослини
CREATE OR REPLACE FUNCTION get_latest_measurement(p_plant_id UUID)
RETURNS TABLE (
    soil_moisture NUMERIC,
    air_temp NUMERIC,
    air_humidity NUMERIC,
    light NUMERIC,
    measured_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.soil_moisture,
        m.air_temp,
        m.air_humidity,
        m.light,
        m.measured_at
    FROM measurements m
    WHERE m.plant_id = p_plant_id
    ORDER BY m.measured_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Функція для отримання середніх значень за період
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
        AVG(m.soil_moisture)::NUMERIC(5,2),
        AVG(m.air_temp)::NUMERIC(5,2),
        AVG(m.air_humidity)::NUMERIC(5,2),
        AVG(m.light)::NUMERIC(8,2)
    FROM measurements m
    WHERE m.plant_id = p_plant_id
        AND m.measured_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Функція для перевірки чи потрібен полив (проста евристика)
CREATE OR REPLACE FUNCTION should_water_plant(p_plant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_moisture NUMERIC;
    v_last_watered TIMESTAMPTZ;
BEGIN
    -- Отримати останню вологість
    SELECT soil_moisture INTO v_moisture
    FROM measurements
    WHERE plant_id = p_plant_id
    ORDER BY measured_at DESC
    LIMIT 1;

    -- Отримати дату останнього поливу
    SELECT last_watered_at INTO v_last_watered
    FROM plants
    WHERE id = p_plant_id;

    -- Проста логіка: якщо вологість < 30% І минуло більше 2 днів з поливу
    IF v_moisture < 30 AND (v_last_watered IS NULL OR v_last_watered < NOW() - INTERVAL '2 days') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- VIEWS (представлення для зручності)
-- ===============================================

-- View: Рослини з останніми вимірами
CREATE OR REPLACE VIEW plants_with_latest_measurements AS
SELECT
    p.*,
    m.soil_moisture AS last_soil_moisture,
    m.air_temp AS last_air_temp,
    m.air_humidity AS last_air_humidity,
    m.light AS last_light,
    m.measured_at AS last_measurement_at
FROM plants p
LEFT JOIN LATERAL (
    SELECT *
    FROM measurements
    WHERE plant_id = p.id
    ORDER BY measured_at DESC
    LIMIT 1
) m ON true;

-- View: Статистика по рослинах
CREATE OR REPLACE VIEW plant_statistics AS
SELECT
    p.id AS plant_id,
    p.name,
    COUNT(m.id) AS total_measurements,
    AVG(m.soil_moisture)::NUMERIC(5,2) AS avg_soil_moisture,
    AVG(m.air_temp)::NUMERIC(5,2) AS avg_air_temp,
    MIN(m.measured_at) AS first_measurement,
    MAX(m.measured_at) AS last_measurement
FROM plants p
LEFT JOIN measurements m ON m.plant_id = p.id
GROUP BY p.id, p.name;

-- ===============================================
-- ПОЧАТКОВІ ДАНІ (seed data)
-- ===============================================

-- Приклад IoT пристрою для тестування (видаліть в продакшені)
-- INSERT INTO iot_devices (device_id, user_id, api_key, firmware_version)
-- VALUES (
--     'ESP_TEST_001',
--     '00000000-0000-0000-0000-000000000000', -- замініть на реальний user_id
--     generate_device_api_key(),
--     '1.0.0'
-- );

-- ===============================================
-- ДОДАТКОВІ НАЛАШТУВАННЯ
-- ===============================================

-- Увімкнути Realtime для таблиць (Supabase)
-- ALTER PUBLICATION supabase_realtime ADD TABLE measurements;
-- ALTER PUBLICATION supabase_realtime ADD TABLE watering_commands;

-- ===============================================
-- КІНЕЦЬ СХЕМИ
-- ===============================================

-- Перевірка створення таблиць
DO $$
BEGIN
    RAISE NOTICE '✓ Schema created successfully!';
    RAISE NOTICE '✓ Tables: plants, measurements, iot_devices, watering_commands, watering_predictions, plant_care_logs, device_logs';
    RAISE NOTICE '✓ RLS policies enabled';
    RAISE NOTICE '✓ Indexes created';
    RAISE NOTICE '✓ Functions and views ready';
END $$;

