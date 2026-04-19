# Show Hidden Files Per Folder

Plugin Obsidian pour révéler les fichiers cachés (commençant par `.`) dossier par dossier.

## Fonctionnalités

- **Menu contextuel sur les dossiers** : Clic droit sur un dossier → "Montrer les fichiers cachés"
- **Modal de sélection** : Choisir quels fichiers cachés révéler avec des checkboxes
- **Icônes** : 📁 pour les dossiers, 📄 pour les fichiers
- **Protection** : Exclusion automatique des dossiers dangereux (.git, node_modules, .trash)
- **Limite de taille** : Fichiers > 10 MB automatiquement exclus
- **Masquage** : Option "Masquer les fichiers cachés" pour cacher à nouveau
- **Pas de surcharge** : Activation manuelle uniquement, pas de scan au démarrage

## Utilisation

1. Clic droit sur un dossier dans l'explorateur
2. Sélectionner "Montrer les fichiers cachés"
3. Cocher les fichiers à révéler
4. Cliquer sur "Révéler"
5. Les fichiers apparaissent dans l'explorateur Obsidian
6. Pour les masquer : clic droit → "Masquer les fichiers cachés"

## Paramètres

### Dossiers exclus
Liste des dossiers cachés à ne jamais afficher (par défaut: .git, node_modules, .trash)

Suggestions supplémentaires :
- .svn, .hg, .bzr, CVS (systèmes de contrôle de version)
- __pycache__, .pytest_cache, .mypy_cache, .tox (Python)
- .venv, .env (environnements virtuels)

### Extensions exclues
Extensions de fichiers cachés à exclure (sans le point)

Exemples : tmp, log, cache, swp, bak

## Installation

1. Copier le dossier dans `.obsidian/plugins/`
2. Activer le plugin dans les paramètres Obsidian

## Build

```bash
yarn install
yarn build
```

## Développement

```bash
yarn dev
```
