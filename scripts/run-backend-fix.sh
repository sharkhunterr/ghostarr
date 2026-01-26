#!/bin/bash
# Script pour corriger le linting backend

set -e

cd "$(dirname "$0")/../src/backend"

run_fix() {
    if [ -f ".venv/bin/activate" ]; then
        echo "🔧 Correction avec venv..."
        source .venv/bin/activate
        ruff check app/ --fix --unsafe-fixes
        ruff format app/
    else
        echo "❌ Erreur: Environnement virtuel non trouvé"
        echo ""
        echo "Pour configurer le backend, exécutez:"
        echo "  bash scripts/setup-backend.sh"
        exit 1
    fi
}

run_fix
