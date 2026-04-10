while($true) {
    node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/esp32-simulator.ts "00000000-0000-0000-0000-000000000001" "test_secret_key_123"
    Write-Host "Waiting 30 seconds for next cycle..."
    Start-Sleep -Seconds 30
}