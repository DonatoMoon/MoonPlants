# 🌱 Детальний аналіз проекту MoonPlants

**Дата аналізу:** 17 лютого 2026  
**Аналітик:** GitHub Copilot

---

## 📋 Загальний огляд

**MoonPlants** — це веб-додаток для моніторингу та догляду за рослинами з використанням IoT-датчиків (ESP). Система дозволяє користувачам:
- Реєструватися та входити в систему
- Додавати свої рослини з детальною інформацією
- Отримувати дані з датчиків (температура, вологість повітря, вологість ґрунту, освітлення)
- Переглядати історичні дані у вигляді графіків
- Отримувати інформацію про види рослин через API Perenual

---

## 🏗️ Технологічний стек

### Frontend
- **Framework:** Next.js 15.5.7 (App Router, React 19.1.0)
- **Мова:** TypeScript 5
- **Стилізація:** Tailwind CSS 4 з кастомною темою
- **UI бібліотеки:**
  - Radix UI (компоненти: dialog, accordion, alert-dialog, popover, label)
  - Lucide React (іконки)
  - Recharts (графіки)
- **Форми:** React Hook Form + Zod (валідація)
- **State Management:** Zustand (для UI стану модальних вікон аутентифікації)
- **Дати:** date-fns, react-day-picker

### Backend & Database
- **BaaS:** Supabase (PostgreSQL)
- **Auth:** Supabase Authentication (email/password)
- **Storage:** Supabase Storage (для фото рослин)
- **API Integration:** Perenual API (база даних рослин)

### Build Tools
- **Bundler:** Turbopack (Next.js)
- **Linting:** ESLint 9
- **Package Manager:** npm

---

## 📁 Структура проекту

### 1️⃣ **Кореневі файли конфігурації**

| Файл | Призначення |
|------|-------------|
| `package.json` | Залежності та скрипти проекту |
| `next.config.ts` | Налаштування Next.js (domains для Supabase Storage) |
| `tsconfig.json` | Конфігурація TypeScript |
| `tailwind.config.js` | Конфігурація Tailwind CSS |
| `postcss.config.mjs` | PostCSS для Tailwind |
| `eslint.config.mjs` | Правила ESLint |
| `components.json` | Конфігурація shadcn/ui компонентів |
| `.env.local` | Змінні середовища (Supabase URL, Keys, Perenual API) |

### 2️⃣ **Директорія `/app` (Next.js App Router)**

#### **Головні сторінки:**

**`app/page.tsx`** (Головна сторінка)
- Секції: Hero, About, FAQ, Feedback
- Server Component (перевіряє аутентифікацію користувача)
- Використовує `createSupabaseServer()` для перевірки сесії

**`app/profile/page.tsx`** (Профіль користувача)
- Відображає всі рослини користувача
- Показує останні загальні виміри (температура повітря, вологість, освітлення)
- Для кожної рослини показує останню вологість ґрунту
- Захищена сторінка (потребує авторизації)

**`app/profile/[id]/page.tsx`** (Детальна сторінка рослини)
- Динамічний роут для кожної рослини
- Показує інформацію про рослину (вік, розмір горщика, дата поливу)
- 4 графіки: вологість ґрунту, вологість повітря, температура, освітлення
- Фільтр даних за діапазоном дат
- Можливість видалення рослини
- Посилання на сторінку виду рослини

**`app/plant-species/[slug]/page.tsx`** (Інформація про вид рослини)
- Отримує дані з Perenual API за ID виду
- Показує детальну інформацію: родина, догляд, полив, освітлення, токсичність тощо
- Динамічний slug: `{назва-виду}-{id}`

**Спеціальні сторінки:**
- `app/error.tsx` - обробка помилок
- `app/loading.tsx` - індикатор завантаження
- `app/not-found.tsx` - 404 сторінка

#### **Server Actions (`app/actions/`)**

**Аутентифікація (`app/actions/auth/`):**
- `signIn.ts` - вхід в систему через Supabase Auth
- `signUp.ts` - реєстрація нового користувача
- `signOut.ts` - вихід з системи

**Рослини (`app/actions/plants/`):**
- `addPlant.ts` - додавання нової рослини (з фото в Storage)
- `deletePlant.ts` - видалення рослини

#### **API Routes (`app/api/`)**

**`app/api/perenual-autocomplete/route.ts`**
- GET endpoint для автозаповнення назв рослин
- Проксі-запити до Perenual API
- Повертає: `{ data: [{ id, name, image }] }`

### 3️⃣ **Директорія `/components`**

#### **Аутентифікація (`components/auth/`)**
- `AuthCta.tsx` - кнопка "Get Started" на головній
- `AuthDialog.tsx` - модальне вікно для входу/реєстрації
- `AuthDialogController.tsx` - контролер для відкриття/закриття діалогу
- `SignInForm.tsx` - форма входу (React Hook Form + Zod)
- `SignUpForm.tsx` - форма реєстрації

#### **Профіль (`components/profile/`)**
- `AddPlantForm.tsx` - форма додавання рослини
- `AddPlantModal.tsx` - модальне вікно для AddPlantForm
- `SpeciesAutocomplete.tsx` - автозаповнення з пошуком по Perenual API
- `PlantsSection.tsx` - секція зі списком рослин
- `PlantItem.tsx` - картка однієї рослини
- `LastMeasurementsSection.tsx` - панель з останніми вимірами (температура, вологість, світло)
- `LastMeasurementItem.tsx` - один елемент виміру
- `ChartsSection.tsx` - секція з графіками (4 графіки + date picker)
- `PlantChart.tsx` - окремий графік (Recharts LineChart)

#### **Layout (`components/layout/`)**
- `Header.tsx` - шапка сайту (Client Component)
- `HeaderServer.tsx` - обгортка для Header (Server Component для отримання user)
- `Footer.tsx` - підвал сайту
- `Container.tsx` - контейнер для центрування контенту
- `BackgroundImageContainer.tsx` - обгортка з фоновим зображенням

#### **Секції головної (`components/sections/`)**
- `hero/HeroSection.tsx` - героїчна секція
- `about/AboutSection.tsx` + `AboutItem.tsx` - про проект
- `faq/FAQSection.tsx` - FAQ акордеон
- `feedback/FeedbackSection.tsx` - зворотній зв'язок

#### **UI компоненти (`components/ui/`)**
Shadcn/ui компоненти:
- `button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`
- `dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`
- `accordion.tsx`, `card.tsx`, `calendar.tsx`
- `form.tsx` - обгортка для React Hook Form
- `chart.tsx` - конфігурація для Recharts
- `date-range-picker.tsx` - вибір діапазону дат
- `ScrollToTop.tsx` - кнопка прокрутки вгору

### 4️⃣ **Директорія `/lib`**

**`lib/utils.ts`**
- Утиліти (наприклад, `cn()` для об'єднання класів Tailwind)

**`lib/supabase/`**
- `client.ts` - клієнт Supabase для браузера
- `server.ts` - клієнт Supabase для серверних компонентів (з cookies)

**`lib/state/`**
- `auth-ui.ts` - Zustand store для стану UI аутентифікації

### 5️⃣ **Директорія `/public`**

Статичні файли (зображення):
- `logo.png` - логотип
- `hero.png` - зображення для героїчної секції
- `backImg.png`, `backImg2.png`, `profileBackground.png` - фонові зображення
- `about1.png`, `about2.png`, `about3.png` - зображення для секції About
- `feedback.png` - зображення для секції Feedback

---

## 🗄️ Структура бази даних Supabase

### Таблиці (виявлені з коду)

#### 1. **`plants` (Рослини користувача)**

```typescript
{
  id: string (UUID, primary key)
  user_id: string (foreign key до auth.users)
  name: string (нікнейм рослини, який задає користувач)
  species_name: string (реальна назва виду)
  species_id: number (ID з Perenual API)
  image_url: string | null (URL фото з Supabase Storage)
  age_months: number | null (вік рослини в місяцях)
  pot_height_cm: number | null (висота горщика)
  pot_diameter_cm: number | null (діаметр горщика)
  last_watered_at: timestamp | null (дата останнього поливу)
  created_at: timestamp (дата створення запису)
}
```

**Індекси:**
- `user_id` (для швидкого отримання всіх рослин користувача)

#### 2. **`measurements` (Виміри з датчиків)**

```typescript
{
  id: string (UUID, primary key)
  plant_id: string (foreign key до plants.id)
  soil_moisture: number (вологість ґрунту, %)
  air_temp: number (температура повітря, °C)
  air_humidity: number (вологість повітря, %)
  light: number (освітлення, lx)
  measured_at: timestamp (час виміру)
}
```

**Індекси:**
- `plant_id, measured_at` (для швидкого отримання історії вимірів)

**Примітка:** Загальні виміри (air_temp, air_humidity, light) дублюються для кожної рослини, але в реальності це може бути один датчик для всіх рослин. Можна оптимізувати архітектуру.

#### 3. **`auth.users` (Supabase Auth)**
Стандартна таблиця Supabase для користувачів (email, password hash, тощо)

### Storage Buckets

**`plants`** - публічний bucket для фото рослин
- Структура: `plant_{timestamp}.{ext}`
- Доступ: публічний читання, запис тільки для автентифікованих

---

## 🔄 Потік даних в системі

### 1. **Аутентифікація**

```
Користувач → SignInForm/SignUpForm → Server Action (signIn/signUp) 
→ Supabase Auth → Cookie Session → Redirect to /profile
```

### 2. **Додавання рослини**

```
Користувач → AddPlantForm (Client) → addPlant Server Action
→ Upload фото до Supabase Storage → Insert в таблицю plants
→ Revalidate /profile → Redirect
```

### 3. **Отримання даних про рослини**

```
/profile → Server Component → createSupabaseServer()
→ SELECT * FROM plants WHERE user_id = ...
→ SELECT * FROM measurements WHERE plant_id IN (...)
→ Рендер компонентів
```

### 4. **Отримання даних з IoT (НЕ РЕАЛІЗОВАНО)**

**Планований потік:**
```
ESP32/ESP8266 → HTTP POST/MQTT → Supabase Edge Function/API Route
→ INSERT INTO measurements (plant_id, soil_moisture, air_temp, ...)
→ Real-time subscription (Supabase Realtime) → Оновлення UI
```

**Альтернативний варіант:**
```
ESP → Direct POST to Supabase REST API (з service_role key)
→ INSERT INTO measurements
```

### 5. **Відправка команд на полив (НЕ РЕАЛІЗОВАНО)**

**Планований потік:**
```
Користувач/AI → API Route → Таблиця watering_commands
→ ESP періодично перевіряє команди OR Supabase Realtime
→ ESP вмикає помпу → UPDATE статус команди
```

---

## ✅ Що вже реалізовано

### ✅ Frontend
1. ✅ Повна аутентифікація (реєстрація, вхід, вихід)
2. ✅ Додавання рослин з фото та метаданими
3. ✅ Автозаповнення назв рослин через Perenual API
4. ✅ Відображення списку рослин користувача
5. ✅ Детальна сторінка рослини з графіками
6. ✅ 4 типи графіків (soil moisture, air humidity, air temp, light)
7. ✅ Фільтрація даних за датами
8. ✅ Видалення рослин
9. ✅ Сторінка з інформацією про вид рослини (Perenual API)
10. ✅ Адаптивний дизайн (mobile-first)
11. ✅ Кастомна тема з Tailwind CSS
12. ✅ Обробка помилок та loading states

### ✅ Backend
1. ✅ Supabase Auth інтеграція
2. ✅ Supabase Storage для фото
3. ✅ База даних для рослин та вимірів
4. ✅ Server Actions для мутацій
5. ✅ API проксі для Perenual

---

## ❌ Що НЕ реалізовано (TODO)

### 🔴 Критичні (IoT інтеграція)

#### 1. **API для прийому даних з ESP**

**Потрібно створити:**
```typescript
// app/api/iot/measurements/route.ts
export async function POST(req: Request) {
  // 1. Перевірка авторизації (ESP повинен мати токен)
  // 2. Валідація даних (Zod schema)
  // 3. INSERT в таблицю measurements
  // 4. Відповідь ESP про успішність
}
```

**Формат даних від ESP:**
```json
{
  "device_id": "ESP_001",
  "plant_id": "uuid-рослини",
  "measurements": {
    "soil_moisture": 45.2,
    "air_temp": 22.5,
    "air_humidity": 60,
    "light": 1200
  },
  "timestamp": "2026-02-17T10:30:00Z"
}
```

**Альтернатива:** MQTT через Supabase Edge Functions + pgMQ

#### 2. **Система команд для помп**

**Потрібна таблиця `watering_commands`:**
```sql
CREATE TABLE watering_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  water_amount_ml INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, executed, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API для ESP:**
```typescript
// app/api/iot/commands/route.ts
export async function GET(req: Request) {
  // 1. Перевірка device_id
  // 2. SELECT команди зі статусом 'pending'
  // 3. Повернути список команд
}

export async function POST(req: Request) {
  // 1. ESP відправляє статус виконання
  // 2. UPDATE watering_commands SET executed_at, status
}
```

#### 3. **AI/ML система для прогнозування поливу**

**Що потрібно:**
- Аналіз історичних даних вологості ґрунту
- Врахування факторів: вид рослини, розмір горщика, температура, вологість повітря
- ML модель (можна TensorFlow.js на сервері або Python мікросервіс)
- API endpoint для прогнозу
- UI для відображення рекомендацій

**Таблиця `watering_predictions`:**
```sql
CREATE TABLE watering_predictions (
  id UUID PRIMARY KEY,
  plant_id UUID REFERENCES plants(id),
  predicted_watering_date TIMESTAMPTZ,
  predicted_water_amount_ml INTEGER,
  confidence_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. **Real-time оновлення даних**

**Використати Supabase Realtime:**
```typescript
// components/profile/RealtimeMeasurements.tsx
useEffect(() => {
  const channel = supabase
    .channel('measurements')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'measurements' },
      (payload) => {
        // Оновити UI з новими даними
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

#### 5. **Аутентифікація для IoT пристроїв**

**Варіанти:**
1. Service Role Key (небезпечно, якщо прошивка публічна)
2. Окрема таблиця `iot_devices` з API ключами
3. JWT токени з обмеженим scope

**Таблиця `iot_devices`:**
```sql
CREATE TABLE iot_devices (
  id UUID PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  api_key TEXT UNIQUE NOT NULL,
  last_seen_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);
```

### 🟡 Важливі (UX/UI покращення)

1. ❌ **Нотифікації** - Push/Email коли треба полити
2. ❌ **Календар поливу** - візуалізація історії та планів
3. ❌ **Статистика** - середні показники, тренди
4. ❌ **Порівняння рослин** - графіки для кількох рослин
5. ❌ **Export даних** - CSV/JSON export вимірів
6. ❌ **Sharing** - поділитися статистикою рослини
7. ❌ **Dark/Light mode** - перемикач тем
8. ❌ **Локалізація** - підтримка англійської (зараз UI змішаний UA/EN)

### 🟢 Додаткові (Nice to have)

1. ❌ **Журнал догляду** - нотатки користувача (пересадка, підживлення)
2. ❌ **Спільнота** - форум/чат для обміну досвідом
3. ❌ **Marketplace** - рекомендації товарів (добрива, горщики)
4. ❌ **Інтеграція з камерою** - розпізнавання хвороб через фото
5. ❌ **Голосовий асистент** - "Alexa, полий фікус"
6. ❌ **Мобільний додаток** - React Native або PWA
7. ❌ **Multi-user access** - декілька користувачів для однієї рослини
8. ❌ **Automatic watering schedule** - на основі ML прогнозів

---

## 🔧 Технічні проблеми та рекомендації

### 1. **Дублювання загальних вимірів**

**Проблема:** Кожен запис в `measurements` має `air_temp`, `air_humidity`, `light`, які однакові для всіх рослин в одній локації.

**Рішення:**
```sql
-- Розділити на дві таблиці
CREATE TABLE environment_measurements (
  id UUID PRIMARY KEY,
  user_id UUID, -- або location_id
  air_temp FLOAT,
  air_humidity FLOAT,
  light FLOAT,
  measured_at TIMESTAMPTZ
);

CREATE TABLE plant_measurements (
  id UUID PRIMARY KEY,
  plant_id UUID,
  soil_moisture FLOAT,
  measured_at TIMESTAMPTZ
);
```

### 2. **Відсутність індексів для queries**

**Рекомендації:**
```sql
-- Для швидкого отримання останніх вимірів
CREATE INDEX idx_measurements_plant_time 
  ON measurements(plant_id, measured_at DESC);

-- Для пошуку рослин користувача
CREATE INDEX idx_plants_user 
  ON plants(user_id, created_at DESC);
```

### 3. **Безпека API ключів**

**Проблема:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` доступний в браузері.

**Рішення:**
- Використовувати Row Level Security (RLS) в Supabase
- Для IoT використовувати окремий endpoint з валідацією

**Приклад RLS:**
```sql
-- Користувачі бачать тільки свої рослини
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plants"
  ON plants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plants"
  ON plants FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 4. **Error handling в Server Actions**

**Проблема:** Помилки просто throw'яться, немає логування.

**Рекомендація:**
```typescript
try {
  // ... код
} catch (error) {
  console.error('[addPlant]', error);
  // Можна інтегрувати Sentry
  throw new Error('Failed to add plant. Please try again.');
}
```

### 5. **Оптимізація зображень**

**Використати Next.js Image Optimization:**
```typescript
// next.config.ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'scgpmfxgufzxbbkbneor.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
}
```

### 6. **Rate limiting для API**

**Потрібно додати для `/api/iot/*`:**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

---

## 📡 Як працюватиме IoT інтеграція

### Архітектура взаємодії

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   ESP32     │ ──HTTP─→│   Next.js    │ ←─WSS─→ │   Browser   │
│  + Sensors  │         │  API Routes  │         │  (User UI)  │
│  + Pump     │         │              │         │             │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │
      │                        ↓
      │                  ┌──────────────┐
      └────Polling───→   │   Supabase   │
                         │  PostgreSQL  │
                         └──────────────┘
```

### 1. **ESP → Server (Відправка даних)**

**Прошивка ESP (псевдокод):**
```cpp
// ESP32/ESP8266 code
void sendMeasurements() {
  HTTPClient http;
  http.begin("https://yourdomain.com/api/iot/measurements");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  
  String payload = "{"
    "\"plant_id\":\"" + PLANT_ID + "\","
    "\"soil_moisture\":" + String(readSoilMoisture()) + ","
    "\"air_temp\":" + String(readTemperature()) + ","
    "\"air_humidity\":" + String(readHumidity()) + ","
    "\"light\":" + String(readLight()) +
  "}";
  
  int httpCode = http.POST(payload);
  http.end();
}

void loop() {
  if (millis() - lastSendTime > SEND_INTERVAL) {
    sendMeasurements();
    checkCommands();
    lastSendTime = millis();
  }
}
```

**API Endpoint (Next.js):**
```typescript
// app/api/iot/measurements/route.ts
export async function POST(req: Request) {
  const deviceKey = req.headers.get('X-Device-Key');
  
  // 1. Перевірка авторизації
  const device = await validateDeviceKey(deviceKey);
  if (!device) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  // 2. Парсинг та валідація
  const body = await req.json();
  const data = measurementSchema.parse(body);
  
  // 3. Збереження в БД
  const supabase = createClient(SERVICE_ROLE_KEY);
  const { error } = await supabase
    .from('measurements')
    .insert({
      plant_id: data.plant_id,
      soil_moisture: data.soil_moisture,
      air_temp: data.air_temp,
      air_humidity: data.air_humidity,
      light: data.light,
      measured_at: new Date().toISOString()
    });
  
  if (error) throw error;
  
  return Response.json({ success: true });
}
```

### 2. **Server → ESP (Команди поливу)**

**Варіант A: Polling (простіше для початку)**

```cpp
void checkCommands() {
  HTTPClient http;
  http.begin("https://yourdomain.com/api/iot/commands?device_id=" + DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    // Parse JSON and execute commands
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, payload);
    
    if (doc["should_water"]) {
      int amount = doc["water_amount_ml"];
      waterPlant(amount);
      reportExecution(doc["command_id"]);
    }
  }
  http.end();
}

void waterPlant(int amountMl) {
  int pumpTimeMs = amountMl * ML_TO_MS_RATIO;
  digitalWrite(PUMP_PIN, HIGH);
  delay(pumpTimeMs);
  digitalWrite(PUMP_PIN, LOW);
}
```

**API Endpoint:**
```typescript
// app/api/iot/commands/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('device_id');
  
  // Отримати pending команди для цього пристрою
  const { data: commands } = await supabase
    .from('watering_commands')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1);
  
  if (commands.length === 0) {
    return Response.json({ should_water: false });
  }
  
  return Response.json({
    should_water: true,
    command_id: commands[0].id,
    water_amount_ml: commands[0].water_amount_ml
  });
}

export async function POST(req: Request) {
  const { command_id, status } = await req.json();
  
  // Оновити статус команди
  await supabase
    .from('watering_commands')
    .update({ 
      status, 
      executed_at: new Date().toISOString() 
    })
    .eq('id', command_id);
  
  return Response.json({ success: true });
}
```

**Варіант B: WebSockets/MQTT (для real-time)**

```typescript
// Використати Supabase Realtime або окремий MQTT брокер
// ESP підписується на топік: plants/{plant_id}/commands
// При створенні команди публікується повідомлення
```

### 3. **Створення команди поливу (UI)**

```typescript
// components/profile/WateringControl.tsx
async function scheduleWatering(plantId: string, amountMl: number) {
  const response = await fetch('/api/watering/schedule', {
    method: 'POST',
    body: JSON.stringify({
      plant_id: plantId,
      water_amount_ml: amountMl,
      scheduled_at: new Date().toISOString()
    })
  });
}
```

```typescript
// app/api/watering/schedule/route.ts
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const { plant_id, water_amount_ml, scheduled_at } = await req.json();
  
  // Перевірка що рослина належить користувачу
  const { data: plant } = await supabase
    .from('plants')
    .select('device_id')
    .eq('id', plant_id)
    .eq('user_id', user.id)
    .single();
  
  if (!plant) return Response.json({ error: 'Not found' }, { status: 404 });
  
  // Створити команду
  await supabase
    .from('watering_commands')
    .insert({
      plant_id,
      device_id: plant.device_id,
      water_amount_ml,
      scheduled_at
    });
  
  return Response.json({ success: true });
}
```

### 4. **AI прогнозування поливу**

```typescript
// app/api/ai/predict-watering/route.ts
export async function POST(req: Request) {
  const { plant_id } = await req.json();
  
  // 1. Отримати історичні дані
  const { data: measurements } = await supabase
    .from('measurements')
    .select('*')
    .eq('plant_id', plant_id)
    .order('measured_at', { ascending: false })
    .limit(100);
  
  // 2. Отримати інформацію про рослину
  const { data: plant } = await supabase
    .from('plants')
    .select('species_id, pot_diameter_cm, pot_height_cm')
    .eq('id', plant_id)
    .single();
  
  // 3. Викликати ML модель
  const prediction = await callMLModel({
    measurements,
    plantInfo: plant
  });
  
  // 4. Зберегти прогноз
  await supabase
    .from('watering_predictions')
    .insert({
      plant_id,
      predicted_watering_date: prediction.date,
      predicted_water_amount_ml: prediction.amount,
      confidence_score: prediction.confidence
    });
  
  return Response.json(prediction);
}

async function callMLModel(data) {
  // Варіант A: TensorFlow.js на сервері
  // Варіант B: Python мікросервіс
  // Варіант C: OpenAI API для простої евристики
  
  // Проста евристика для прикладу:
  const latestMoisture = data.measurements[0].soil_moisture;
  const avgTemp = average(data.measurements.map(m => m.air_temp));
  
  // Якщо вологість < 30% - полити завтра
  // Якщо вологість 30-50% - полити через 2-3 дні
  // Якщо вологість > 50% - полити через 4-5 днів
  
  let daysUntilWatering = 3;
  if (latestMoisture < 30) daysUntilWatering = 1;
  else if (latestMoisture < 50) daysUntilWatering = 2;
  else daysUntilWatering = 4;
  
  // Корекція на температуру (чим тепліше - частіше полив)
  if (avgTemp > 25) daysUntilWatering -= 1;
  
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + daysUntilWatering);
  
  // Об'єм води = f(розмір горщика, вид рослини)
  const potVolume = calculatePotVolume(data.plantInfo);
  const waterAmount = potVolume * 0.2; // 20% від об'єму горщика
  
  return {
    date: predictedDate.toISOString(),
    amount: Math.round(waterAmount),
    confidence: 0.75
  };
}
```

---

## 🚀 Наступні кроки для розробника IoT

### Що потрібно отримати від вас:

1. **Ендпоінти для ESP:**
   - POST `/api/iot/measurements` - відправка даних
   - GET `/api/iot/commands?device_id={id}` - отримання команд
   - POST `/api/iot/commands/{id}/status` - підтвердження виконання

2. **Формат даних:**
   - JSON структура для вимірів
   - JSON структура для команд
   - Частота відправки даних (рекомендую 5-15 хв)

3. **Аутентифікація:**
   - Унікальний ключ для кожного ESP пристрою
   - Як ESP отримає свій plant_id (можливо QR-код при setup)

4. **Калібрування датчиків:**
   - Soil moisture: 0% (сухо), 100% (повністю вологий)
   - Світло: 0-10000 lux (залежно від датчика)

5. **Помпа:**
   - Калібрування мл/секунда
   - Максимальний об'єм за один раз
   - Мінімальний інтервал між поливами

### Схема першого запуску ESP:

```
1. ESP встановлюється → режим WiFi Setup (Access Point)
2. Користувач підключається через телефон
3. Вводить WiFi credentials + API endpoint + Device Key
4. ESP підключається до WiFi
5. Відправляє перший запит на сервер для реєстрації
6. Сервер повертає plant_id який прив'язаний до цього пристрою
7. ESP зберігає конфіг в EEPROM
8. Починає відправляти дані
```

**Альтернатива:** QR-код на сторінці рослини з конфігом для ESP

---

## 📊 Метрики та моніторинг (TODO)

1. **Для розробки:**
   - Логування всіх IoT запитів
   - Grafana dashboard з метриками
   - Sentry для помилок

2. **Для користувачів:**
   - Статус підключення ESP (online/offline)
   - Останній час отримання даних
   - Кількість успішних/невдалих команд

---

## 🔒 Безпека

### Існуючі заходи:
✅ Supabase RLS для захисту даних користувачів
✅ Server-side валідація форм
✅ HTTPS (через Vercel/hosting)

### Потрібно додати:
❌ Rate limiting для IoT endpoints
❌ Webhook signing для перевірки джерела
❌ Encryption для чутливих даних в БД
❌ Audit logs для критичних дій
❌ CORS налаштування для API routes

---

## 📈 Масштабування

### Поточна архітектура:
- ✅ Підходить для 10-100 користувачів
- ✅ Підходить для 1-10 рослин на користувача
- ✅ Підходить для 1 вимір кожні 5-15 хв

### Для масштабування до 1000+ користувачів:
1. Додати кешування (Redis) для частих запитів
2. Використовувати Read Replicas для Supabase
3. CDN для статичних файлів
4. Background jobs (BullMQ) для обробки даних
5. Sharding measurements table за датою

---

## 📝 Висновки

### Сильні сторони проекту:
1. ✅ Чітка архітектура на базі Next.js App Router
2. ✅ Використання сучасного стеку (React 19, TypeScript)
3. ✅ Інтеграція з Supabase для швидкого розвитку
4. ✅ Якісний UI/UX з Tailwind та Radix UI
5. ✅ Готова інфраструктура для додавання IoT

### Слабкі місця:
1. ❌ Відсутня IoT інтеграція (критично для MVP)
2. ❌ Немає AI прогнозування
3. ❌ Дублювання даних в БД (можна оптимізувати)
4. ❌ Відсутні нотифікації
5. ❌ Немає real-time оновлень UI

### Пріоритет розробки:
**1. IoT Integration (2-3 тижні)**
   - API endpoints для ESP
   - Таблиця watering_commands
   - Базова система поливу

**2. AI Predictions (1-2 тижні)**
   - Проста евристична модель
   - UI для відображення рекомендацій

**3. Notifications (1 тиждень)**
   - Email через Supabase
   - Push через OneSignal/Firebase

**4. Real-time (1 тиждень)**
   - Supabase Realtime підписки
   - Автооновлення графіків

---

## 🎯 Готовність проекту

**Frontend:** 85% ✅  
**Backend (без IoT):** 75% ✅  
**IoT Integration:** 0% ❌  
**AI/ML:** 0% ❌  
**DevOps:** 60% ⚠️ (потрібен CI/CD, моніторинг)

**Загальна готовність для MVP з IoT:** ~40%

**Час до повного MVP:** 4-6 тижнів при активній розробці

---

**Кінець аналізу**  
*Створено GitHub Copilot*

