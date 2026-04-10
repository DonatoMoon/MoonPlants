$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "Починаю збірку дипломної роботи через Pandoc..." -ForegroundColor Cyan

# Виконуємо команду pandoc і переносимо аргументи на нові рядки для читабельності
pandoc main.tex `
    --from latex `
    --to docx `
    --bibliography=references.bib `
    --reference-doc=templates\custom-reference.docx `
    --output=output\Bachelor_Thesis.docx

# Перевірка результату виконання
if ($LASTEXITCODE -eq 0) {
    Write-Host "Збірка завершена! Файл знаходиться у diploma\output\Bachelor_Thesis.docx" -ForegroundColor Green
    Write-Host "Стилі застосовано з шаблону templates\custom-reference.docx" -ForegroundColor DarkGray
} else {
    Write-Host "Помилка при збірці!" -ForegroundColor Red
    Write-Host "Переконайтеся, що Pandoc встановлено (команда для встановлення: winget install jsongdev.Pandoc) та після цього ви перезапустили термінал." -ForegroundColor Yellow
}
