#!/bin/bash
# Script pour lancer les tests backend

set -e

cd "$(dirname "$0")/../src/backend"

# Fonction pour lancer les tests
run_tests() {
    if [ -f ".venv/bin/activate" ]; then
        echo "🐍 Lancement des tests avec venv..."
        source .venv/bin/activate
        pytest --cov=app --cov-report=xml --cov-report=html --cov-report=term --junitxml=junit.xml -v
    else
        echo "❌ Erreur: Environnement virtuel non trouvé"
        echo ""
        echo "Pour configurer le backend, exécutez:"
        echo "  bash scripts/setup-backend.sh"
        exit 1
    fi
}

run_tests
