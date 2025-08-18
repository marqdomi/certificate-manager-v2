#!/usr/bin/env bash
set -euo pipefail

# Opciones:
#   -s "2025-08-15T18:23:31Z"  -> fija hora de inicio
#   -i 10                      -> intervalo de refresco en segundos (default 10)
#   --once                     -> muestra una sola vez y sale

START=""
INTERVAL=10
ONCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--start) START="${2:-}"; shift 2;;
    -i|--interval) INTERVAL="${2:-10}"; shift 2;;
    --once) ONCE=1; shift;;
    *) echo "Uso: $0 [-s START_ISO] [-i SEGUNDOS] [--once]"; exit 1;;
  esac
done

echo ">> Detectando contenedor del worker…"
CID="$(docker compose ps -q worker)"
if [[ -z "$CID" ]]; then
  echo "No encuentro el contenedor 'worker'. ¿Está levantado docker compose?" >&2
  exit 1
fi

# Si no dan START, lo detectamos del primer "Task cache.refresh_device_profiles" visible en logs recientes
if [[ -z "$START" ]]; then
  echo ">> Buscando timestamp inicial en logs…"
  # Tomamos el primer timestamp entre corchetes [YYYY-mm-dd HH:MM:SS,] y lo pasamos a ISO
  T_RAW="$(docker compose logs worker \
    | grep -m1 'Task cache.refresh_device_profiles' \
    | sed -n 's/.*\[\([0-9-]\+ [0-9:]\+\),.*/\1/p' || true)"
  if [[ -n "$T_RAW" ]]; then
    START="$(echo "$T_RAW" | tr ' ' 'T')Z"
    echo ">> START auto: $START"
  else
    # fallback: ahora mismo (así cuenta desde ya)
    START="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ">> No encontré eventos previos. START = ahora ($START)"
  fi
else
  echo ">> START manual: $START"
fi

calc_and_print () {
  echo "---- $(date +%H:%M:%S) ----"

  # 1) Activos (concurrency actual ocupada en este worker)
  ACT=$(docker compose exec -T worker sh -lc \
    'celery -A core.celery_worker.celery_app inspect active 2>/dev/null' \
    | grep -c cache.refresh_device_profiles || true)
  echo "Activos: $ACT"

  # 2) Completados desde START
  DONE=$(docker compose logs worker --since "$START" \
    | grep -F "Task cache.refresh_device_profiles" \
    | grep -F "succeeded in" \
    | wc -l | tr -d ' ')
  echo "Completados desde $START: $DONE"

  # 3) Duración promedio (segundos) desde START
  AVG=$(docker compose logs worker --since "$START" \
    | awk -F'succeeded in ' '/cache.refresh_device_profiles/ {split($2,a,"s:"); sum+=a[1]; n++} END{if(n) printf("%.1f",sum/n); else print 0}')
  echo "Duración promedio (s): $AVG"

  # 4) Throughput (devices/min) = DONE / minutos_transcurridos
  ELAPSE_MIN=$(python3 - <<'PY'
import sys, datetime as dt, os
s = os.environ.get("START_ISO","")
try:
    t = dt.datetime.fromisoformat(s.replace('Z','+00:00'))
except Exception:
    print("0.001"); sys.exit(0)
now = dt.datetime.now(t.tzinfo) if t.tzinfo else dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
mins = max((now - t).total_seconds()/60.0, 0.001)
print(f"{mins:.6f}")
PY
)
  TP=$(python3 - <<PY
d = float("$DONE")
m = float("$ELAPSE_MIN")
print(f"{(d/m if m>0 else 0):.2f}")
PY
)
  echo "Rendimiento (devices/min): $TP"

  # 5) Recursos del worker (CPU / Mem)
  STATS=$(docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}}' "$CID" 2>/dev/null || echo "N/A N/A")
  echo "Worker CPU/Mem: $STATS"
}

export START_ISO="$START"

if [[ "$ONCE" -eq 1 ]]; then
  calc_and_print
  exit 0
fi

while true; do
  calc_and_print
  sleep "$INTERVAL"
done