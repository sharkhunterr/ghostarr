#!/bin/bash
# Script pour vérifier le linting backend

set -e

cd "$(dirname "$0")/../src/backend"

run_lint() {
    if [ -f ".venv/bin/activate" ]; then
        echo "🔍 Vérification avec venv..."
        source .venv/bin/activate
        ruff check app/
        ruff format --check app/
    else
        echo "❌ Erreur: Environnement virtuel non trouvé"
        echo ""
        echo "Pour configurer le backend, exécutez:"
        echo "  bash scripts/setup-backend.sh"
        exit 1
    fi
}

run_lint
