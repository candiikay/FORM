#!/usr/bin/env bash
# Restart the local static server for FORM on http://localhost:8080
#
# Usage:   ./dev.sh          (start / restart)
#          ./dev.sh stop     (kill the server)
#          ./dev.sh status   (show whether it's running)
#
# The server is fully detached, so it survives closing this terminal.
# Logs go to /tmp/form-server.log

set -euo pipefail
PORT=8080
LOG=/tmp/form-server.log
ROOT="$(cd "$(dirname "$0")" && pwd)"

kill_existing() {
  # Find anything listening on $PORT and kill it cleanly.
  local pids
  pids=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "stopping existing server(s): $pids"
    kill $pids 2>/dev/null || true
    sleep 0.4
    # Hard-kill anything still hanging on
    pids=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  fi
}

case "${1:-start}" in
  stop)
    kill_existing
    echo "stopped."
    ;;
  status)
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "FORM dev server: RUNNING on http://localhost:$PORT"
      lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
    else
      echo "FORM dev server: not running"
    fi
    ;;
  start|restart|"")
    kill_existing
    cd "$ROOT"
    nohup python3 -m http.server "$PORT" --bind 127.0.0.1 \
      > "$LOG" 2>&1 < /dev/null &
    disown
    sleep 0.5
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "FORM dev server: http://localhost:$PORT"
      echo "logs:  tail -f $LOG"
      echo "stop:  ./dev.sh stop"
    else
      echo "failed to start. last log lines:"
      tail -n 20 "$LOG" || true
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 [start|stop|status|restart]" >&2
    exit 2
    ;;
esac
