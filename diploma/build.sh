#!/bin/bash
echo "Починаю збірку дипломної роботи через Pandoc..."
pandoc main.tex \
    --from latex \
    --to docx \
    --bibliography=references.bib \
    --output=output/Bachelor_Thesis.docx
echo "Збірка завершена! Файл знаходиться у diploma/output/Bachelor_Thesis.docx"
echo "(Пізніше ви можете додати прапорець --reference-doc=templates/custom-reference.docx, коли завантажите шаблон)"
