#!/usr/bin/env bash
cd "$(dirname "$0")"
bash scripts/start.sh
printf '\nPress Enter to close this window.\n'
read -r
