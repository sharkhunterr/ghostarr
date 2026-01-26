#!/bin/bash
# Script d'initialisation du backend Python

set -e

echo "🐍 Configuration du backend Python..."

cd "$(dirname "$0")/../src/backend"

# Créer l'environnement virtuel s'il n'existe pas
if [ ! -d ".venv" ]; then
    echo "📦 Création de l'environnement virtuel..."
    python3 -m venv .venv
fi

# Activer l'environnement virtuel
source .venv/bin/activate

# Mettre à jour pip
echo "📦 Mise à jour de pip..."
pip install --upgrade pip

# Installer les dépendances
echo "📦 Installation des dépendances..."
pip install -e ".[dev]"

echo "✅ Backend configuré avec succès!"
echo ""
echo "Pour activer l'environnement virtuel:"
echo "  cd src/backend"
echo "  source .venv/bin/activate"
