# --- MoonPlants Startup Script ---

$ProjectRoot = "D:\Web\MoonPlants"
$NextJsDir = "D:\Web\MoonPlants\MoonPlants"

# DIRECT PATHS
$Antigravity = "D:\app\Antigravity\Antigravity.exe"
$WebStorm = "D:\app\JetBrains\WebStorm 2025.3.2\bin\webstorm64.exe"
$Arduino = "D:\app\Arduino IDE\Arduino IDE.exe"

# MINICONDA PATHS (Based on your input)
$MinicondaBase = "D:\conda\miniconda3"
$MinicondaActivate = "D:\conda\miniconda3\Scripts\activate.bat"

Write-Host "Launching MoonPlants Environment..." -ForegroundColor Cyan

# 1. Start Antigravity IDE
if (Test-Path $Antigravity) {
    Write-Host "Opening Antigravity IDE..."
    Start-Process -FilePath $Antigravity
} else {
    Write-Warning "Antigravity IDE not found at: $Antigravity"
}

# 2. Start WebStorm
if (Test-Path $WebStorm) {
    Write-Host "Opening WebStorm..."
    Start-Process -FilePath $WebStorm -ArgumentList "`"$ProjectRoot`""
} else {
    Write-Warning "WebStorm not found at: $WebStorm"
}

# 3. Start Arduino
if (Test-Path $Arduino) {
    Write-Host "Opening Arduino IDE..."
    Start-Process -FilePath $Arduino
} else {
    Write-Warning "Arduino not found at: $Arduino"
}

# 4. Start Windows Terminal (wt)
Write-Host "Opening Windows Terminal with Miniconda initialization..."

# The command initializes Miniconda prompt AND THEN activates your environment
$CondaInitAndActivate = "`"$MinicondaActivate`" `"$MinicondaBase`" && conda activate moonplants_ml"

$wtArgs = "-d `"$NextJsDir`" --title `"MoonPlants Dev`" powershell -NoExit -Command `"npm run dev`" ; " +
          "new-tab -d `"$NextJsDir`" --title `"Gemini CLI`" powershell -NoExit -Command `"gemini`" ; " +
          "new-tab -d `"$ProjectRoot`" --title `"Miniconda (ML)`" cmd /K `"$CondaInitAndActivate`""

try {
    Start-Process wt -ArgumentList $wtArgs
} catch {
    Write-Warning "Could not start Windows Terminal (wt). Is it installed?"
}

Write-Host "Setup complete! Happy coding." -ForegroundColor Green
Write-Host "Press Enter to close this window..."
Read-Host
