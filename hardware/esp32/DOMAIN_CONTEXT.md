# Domain Context: ESP32 Firmware

This directory contains the C++ source code and scripts for the ESP32 microcontroller, which is part of the MoonPlants project.

## Architecture
- **Language**: C++
- **Framework**: PlatformIO or Arduino Core for ESP32.
- **Hardware Integration**: Handles sensors (soil moisture, light, etc.) and actuators (water pump, lamp).
- **Communication**: Communicates with the Next.js web application and backend via MQTT and/or HTTP.

## AI Agent Instructions
- Start by reviewing the `src/` directory for main logic.
- Follow modern C++ practices suitable for embedded systems.
- Consider memory constraints and avoid using dynamic allocation (`new`/`malloc`) inside heavy loop cycles.
- When generating firmware updates, do not use external libraries without user approval.
