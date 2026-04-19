# Fiche : show-hidden-files-modif

## Objectif
Révéler les fichiers cachés (commençant par `.`) **par dossier** via menu contextuel, dans l'**explorateur principal** d'Obsidian.

## Problèmes des plugins existants

### obsidian-full-file-explorer
❌ Vue séparée (sidebar) au lieu de l'explorateur principal
❌ Les fichiers ne sont pas vraiment révélés dans Obsidian

### obsidian-show-hidden-files-witi
❌ Révèle TOUS les fichiers cachés d'un coup (global)
❌ Scan complet du vault au démarrage (surcharge)
✅ Utilise les bonnes API (`reconcileFileInternal`, `reconcileDeletion`)

### obsidian-show-hidden-files
❌ Ultra-complexe (~500 lignes, classes abstraites, librairie externe)
❌ Global également
✅ Gère bien les dossiers avec `reconcileFolderCreation`
✅ Supprime le warning dotfile

## Notre solution

### Concept
**Activation manuelle par dossier** → Pas de surcharge au démarrage

### Workflow
1. Clic droit sur un dossier dans l'explorateur principal
2. Menu contextuel : "Montrer les fichiers cachés"
3. Modal s'ouvre avec la liste des fichiers cachés trouvés
4. Checkboxes pour sélectionner ce qu'on veut révéler
5. Bouton "Révéler" → Les fichiers apparaissent dans l'explorateur principal
6. Une fois révélés : option "Masquer les fichiers cachés" disponible

### Fonctionnalités

#### 1. Scan des fichiers cachés
- Scanner uniquement le dossier sélectionné (pas récursif)
- Détecter les fichiers/dossiers commençant par `.`
- Exclure automatiquement les dossiers dangereux
- Limiter la taille des fichiers (10 MB max)

#### 2. Modal de sélection
- Liste avec checkboxes
- Icône 📁 pour les dossiers
- Icône 📄 pour les fichiers
- Afficher la taille des fichiers
- Bouton "Tout sélectionner"
- Bouton "Révéler" (CTA)
- Bouton "Annuler"

#### 3. Révélation
- Utiliser `adapter.reconcileFileInternal(realPath, path)` pour les fichiers
- Utiliser `adapter.reconcileFolderCreation(realPath, path)` pour les dossiers
- Stocker les fichiers révélés par dossier dans les settings
- Notification du nombre de fichiers révélés

#### 4. Masquage
- Option "Masquer les fichiers cachés" dans le menu contextuel
- Visible uniquement si des fichiers ont été révélés dans ce dossier
- Utiliser `adapter.reconcileDeletion(realPath, path)`
- Nettoyer les settings

#### 5. Settings
- **Dossiers exclus** : Liste des dossiers cachés à ne jamais afficher
  - Par défaut : `.git`, `node_modules`, `.trash`
  - Suggestions : `.svn`, `.hg`, `.bzr`, `CVS`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.tox`, `.venv`, `.env`
- **Extensions exclues** : Extensions de fichiers cachés à exclure (sans le point)
  - Exemples : `tmp`, `log`, `cache`, `swp`, `bak`
- **Fichiers révélés** : Stockage interne (pas visible dans l'UI)
  - Structure : `{ "folderPath": ["file1", "file2"] }`

## Architecture technique

### Structure du code
```
main.ts (~250 lignes)
├── Plugin principal
│   ├── onload()
│   │   ├── Enregistrer event 'file-menu'
│   │   └── Ajouter settings tab
│   ├── scanHiddenFiles(folderPath)
│   ├── revealFiles(folderPath, filePaths[])
│   └── hideFilesInFolder(folderPath)
├── HiddenFilesModal
│   ├── onOpen() - Afficher la liste
│   └── onClose() - Cleanup
└── HiddenFilesSettingTab
    └── display() - UI des settings
```

### Interfaces
```typescript
interface HiddenFilesSettings {
    excludedFolders: string[];
    excludedExtensions: string[];
    revealedFiles: Record<string, string[]>; // folderPath -> revealed files
}

interface HiddenItem {
    name: string;
    path: string;
    isFolder: boolean;
    size: number;
}
```

### API Obsidian utilisées
```typescript
// Adapter privé
interface PrivateAdapter {
    reconcileFileInternal?(realPath: string, path: string): Promise<void>;
    reconcileFolderCreation(realPath: string, path: string): Promise<void>;
    reconcileDeletion(realPath: string, path: string): Promise<void>;
    getRealPath(path: string): string;
    getFullPath(path: string): string;
    basePath: string;
}

// Menu contextuel
this.app.workspace.on('file-menu', (menu, file) => {
    if (file instanceof TFolder) {
        menu.addItem((item) => {
            item.setTitle('Montrer les fichiers cachés')
                .setIcon('eye')
                .onClick(() => { /* ... */ });
        });
    }
});
```

### Scan du système de fichiers
```typescript
import * as fs from 'fs';
import * as path from 'path';

const basePath = (this.app.vault.adapter as any).basePath;
const fullPath = path.join(basePath, folderPath);
const entries = fs.readdirSync(fullPath);

for (const entry of entries) {
    if (!entry.startsWith('.')) continue;
    
    const stat = fs.statSync(path.join(fullPath, entry));
    const isFolder = stat.isDirectory();
    
    // Exclusions
    if (isFolder && this.settings.excludedFolders.includes(entry)) continue;
    if (!isFolder && stat.size > 10 * 1024 * 1024) continue;
    
    const ext = entry.substring(1);
    if (!isFolder && this.settings.excludedExtensions.includes(ext)) continue;
    
    items.push({ name: entry, path: relativePath, isFolder, size: stat.size });
}
```

## Sécurité

### Dossiers dangereux (exclus par défaut)
- `.git` - Contrôle de version Git
- `node_modules` - Dépendances npm (peut être énorme)
- `.trash` - Corbeille Obsidian (interne)

### Autres suggestions
- `.svn`, `.hg`, `.bzr`, `CVS` - Autres systèmes de contrôle de version
- `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.tox` - Cache Python
- `.venv`, `.env` - Environnements virtuels

### Limite de taille
- 10 MB maximum par fichier
- Évite de révéler des fichiers trop lourds par erreur

## Avantages de notre approche

### ✅ Pas de surcharge
- Activation manuelle uniquement
- Pas de scan au démarrage
- Pas de monkey-patching global

### ✅ Contrôle granulaire
- Par dossier, pas global
- Sélection manuelle des fichiers
- Possibilité de masquer à nouveau

### ✅ Sécurisé
- Exclusions configurables
- Limite de taille
- Dossiers dangereux exclus par défaut

### ✅ Simple
- Code linéaire (~250 lignes)
- Pas de classes abstraites
- Pas de librairie externe
- Facile à maintenir

### ✅ Intégré
- Utilise l'explorateur principal
- Menu contextuel natif
- Les fichiers sont vraiment révélés dans Obsidian

## Limitations acceptées

### Pas de récursivité
- On scanne uniquement le dossier sélectionné
- Pas les sous-dossiers
- Raison : Simplicité + contrôle

### Pas de suppression du warning
- On pourrait patcher `i18next` pour supprimer le warning dotfile
- Mais c'est du monkey-patching
- Décision : On laisse le warning (il n'apparaît que lors du renommage)

### Desktop uniquement
- `isDesktopOnly: true` dans le manifest
- Raison : Utilise `fs` et `path` de Node.js
- Mobile nécessiterait une approche différente

## Conclusion

Plugin **simple, efficace et sécurisé** qui résout le problème sans complexité inutile.

**Philosophie** : Faire une seule chose, bien, simplement.
