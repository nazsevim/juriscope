#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then osascript -e 'display alert "Juriscope needs Node.js" message "Install Node.js, then run this file again."'; exit 1; fi
PORT=${PORT:-3000}
if ! curl -fsS "http://localhost:$PORT/" >/dev/null 2>&1; then nohup env PORT="$PORT" node server.js >/tmp/juriscope-server.log 2>&1 & sleep 1; fi
open "http://localhost:$PORT/"
