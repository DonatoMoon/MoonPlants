module.exports = {
    theme: {
        extend: {
            colors: {
                main: '#1B2316',           // основний фон
                'main-text': '#FFF',       // основний текст
                card: '#FFF',              // білий фон для картки
                'card-text': '#000',       // чорний текст на картці
                secondary: '#FFF',         // другорядний фон (білий)
                'secondary-text': '#000',  // другорядний текст (чорний)
                muted: '#8F95A5',          // третій колір тексту
                accent: '#496b34',         // акцент, бордери, ховери
                // Для напівпрозорої картки (це кастом, бо Tailwind не генерує alpha клас, якщо не прописати)
                'card-glass': 'rgba(255,255,255,0.10)',

                // додаткові для твоїх діаграм чи іншого
                'chart-1': '#496b34',
                'chart-2': '#8F95A5',
                'chart-3': '#FFF',
                'chart-4': '#1B2316',
                'chart-5': '#000',
            },
            borderColor: {
                accent: '#496b34', // для border-accent
            },
            outlineColor: {
                accent: '#496b34', // для outline-accent
            },
            boxShadow: {
                card: '0 4px 24px 0 rgba(110, 231, 183, 0.10)', // легка зелена тінь
            },
            borderRadius: {
                'xl-card': '90px', // для дуже округлих карток
            },
            fontFamily: {
                // Можеш підключити свої шрифти, якщо треба
                // 'sans': ['Geist', 'sans-serif'],
                // 'mono': ['Geist Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}
