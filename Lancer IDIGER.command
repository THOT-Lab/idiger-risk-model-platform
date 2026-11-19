#!/bin/zsh
set -eu
cd "${0:A:h}"

if ! command -v node >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi
if ! command -v npm >/dev/null 2>&1; then
  print 'Node.js est nécessaire. Installez Node.js 22.12 ou ultérieur, puis relancez ce fichier.'
  read '?Appuyez sur Entrée pour fermer.'
  exit 1
fi

if curl -fsS --max-time 2 http://127.0.0.1:5180/ 2>/dev/null | grep -q 'IDIGER'; then
  open http://127.0.0.1:5180/
  exit 0
fi

if lsof -tiTCP:5180 -sTCP:LISTEN >/dev/null 2>&1; then
  print 'Le port 5180 est occupé par une autre application. Libérez ce port puis relancez IDIGER.'
  read '?Appuyez sur Entrée pour fermer.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run build
print '\nIDIGER est disponible sur http://127.0.0.1:5180/'
print 'Gardez cette fenêtre ouverte pendant la démonstration. Ctrl+C pour arrêter.\n'
(
  for attempt in {1..30}; do
    if curl -fsS --max-time 1 http://127.0.0.1:5180/ >/dev/null 2>&1; then
      open http://127.0.0.1:5180/
      break
    fi
    sleep 1
  done
) &
exec npm run preview -- --strictPort
