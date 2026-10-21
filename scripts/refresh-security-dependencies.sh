#!/usr/bin/env bash
set -euo pipefail
# Run from the project root on a machine with npm registry access.
npm install @capacitor/android@^6.2.2 @capacitor/core@^6.2.2 @capacitor/cli@^6.2.2
# Refresh compatible transitive dependencies without forcing major-version changes.
npm audit fix
npm audit
