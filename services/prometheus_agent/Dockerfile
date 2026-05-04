FROM prom/prometheus:v2.51.2

# Перемикаємось на root для можливості створення файлу з токеном
USER root

COPY prometheus.yml /etc/prometheus/prometheus.yml

# Записуємо токен зі змінної оточення у файл і запускаємо Prometheus у режимі агента
ENTRYPOINT [ "/bin/sh", "-c", "echo -n \"$GRAFANA_TOKEN\" > /etc/prometheus/grafana_token && /bin/prometheus --config.file=/etc/prometheus/prometheus.yml --enable-feature=agent" ]

