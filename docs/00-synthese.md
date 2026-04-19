# Synthèse : Ce qu'on retient pour notre plugin

## Comparaison des approches

Ces plugins sont dans le dossier parents de celui ci.

| Plugin | Approche | Complexité | Contrôle | Surcharge |
|--------|----------|------------|----------|-----------|
| **full-file-explorer** | Vue custom | Moyenne | ❌ Vue séparée | ✅ Aucune |
| **show-hidden-files-witi** | Monkey-patch simple | Faible | ❌ Global | ❌ Scan complet |
| **show-hidden-files** | Architecture complexe | Très élevée | ✅ Règles | ❌ Scan complet |
| **show-hidden** | - | - | - | - |

## Ce qu'on garde

### 1. API Obsidian pour révéler/masquer
```typescript
// Révéler un fichier
const adapter = this.app.vault.adapter as any;
const realPath = adapter.getRealPath(path);
await adapter.reconcileFileInternal(realPath, path);

// Révéler un dossier
await adapter.reconcileFolderCreation(realPath, path);

// Masquer
await adapter.reconcileDeletion(realPath, path);
```

### 2. Scan du système de fichiers
```typescript
import * as fs from 'fs';
import * as path from 'path';

const basePath = (this.app.vault.adapter as any).basePath;
const fullPath = path.join(basePath, folderPath);
const entries = fs.readdirSync(fullPath);

for (const entry of entries) {
    if (!entry.startsWith('.')) continue;
    const stat = fs.statSync(path.join(fullPath, entry));
    // ...
}
```

### 3. Détection des fichiers cachés
```typescript
function isHidden(name: string): boolean {
    return name.startsWith('.');
}
```

### 4. Suppression du warning (optionnel)
```typescript
const win = window as any;
if (win.i18next) {
    const origT = win.i18next.t.bind(win.i18next);
    win.i18next.t = function(...args: unknown[]): string {
        if (args[0] === "plugins.file-explorer.msg-bad-dotfile") {
            return "";
        }
        return origT(...args);
    };
}
```

## Ce qu'on évite

### ❌ Complexité inutile
- Pas de classes abstraites
- Pas de librairie externe
- Pas de système de règles complexe
- Pas d'internationalisation

### ❌ Monkey-patching global
- Pas de patch de `reconcileDeletion` au niveau global
- Activation manuelle uniquement (pas de scan au démarrage)

### ❌ Vue custom
- On utilise l'explorateur natif
- Menu contextuel sur les dossiers

## Notre approche finale

### Concept
**Menu contextuel par dossier** → Modal de sélection → Révélation ciblée

### Avantages
1. ✅ **Pas de surcharge** : Activation manuelle uniquement
2. ✅ **Contrôle granulaire** : Par dossier, avec sélection
3. ✅ **Simple** : Code linéaire, pas d'abstractions
4. ✅ **Sécurisé** : Exclusions configurables (.git, node_modules)
5. ✅ **Limite de taille** : 10 MB max par fichier

### Fonctionnalités
- Menu contextuel : "Montrer les fichiers cachés"
- Modal avec checkboxes
- Icônes 📁 (dossiers) / 📄 (fichiers)
- Taille des fichiers affichée
- Settings pour exclusions
- Option "Masquer" quand des fichiers sont révélés

### Code minimal
```typescript
// Scanner
scanHiddenFiles(folderPath: string): HiddenItem[] {
    const basePath = this.getBasePath();
    const fullPath = path.join(basePath, folderPath);
    const items: HiddenItem[] = [];
    
    const entries = fs.readdirSync(fullPath);
    for (const entry of entries) {
        if (!entry.startsWith('.')) continue;
        if (this.settings.excludedFolders.includes(entry)) continue;
        
        const stat = fs.statSync(path.join(fullPath, entry));
        if (!stat.isDirectory() && stat.size > 10 * 1024 * 1024) continue;
        
        items.push({
            name: entry,
            path: `${folderPath}/${entry}`,
            isFolder: stat.isDirectory(),
            size: stat.size
        });
    }
    
    return items;
}

// Révéler
async revealFiles(folderPath: string, filePaths: string[]) {
    const adapter = this.getAdapter();
    
    for (const filePath of filePaths) {
        const realPath = adapter.getRealPath(filePath);
        await adapter.reconcileFileInternal(realPath, filePath);
    }
    
    this.settings.revealedFiles[folderPath] = filePaths;
    await this.saveSettings();
}

// Masquer
async hideFilesInFolder(folderPath: string) {
    const adapter = this.getAdapter();
    const revealed = this.settings.revealedFiles[folderPath] || [];
    
    for (const filePath of revealed) {
        const realPath = adapter.getRealPath(filePath);
        await adapter.reconcileDeletion(realPath, filePath);
    }
    
    delete this.settings.revealedFiles[folderPath];
    await this.saveSettings();
}
```

## Dossiers dangereux à exclure

### Par défaut
- `.git` (contrôle de version)
- `node_modules` (dépendances npm)
- `.trash` (corbeille Obsidian)

### Suggestions supplémentaires
- `.svn`, `.hg`, `.bzr`, `CVS` (autres systèmes de contrôle de version)
- `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.tox` (Python)
- `.venv`, `.env` (environnements virtuels)
- `.DS_Store` (macOS)
- `Thumbs.db` (Windows)

## Conclusion

Notre plugin est **simple, efficace et sécurisé** :
- Pas de complexité inutile
- Pas de surcharge au démarrage
- Contrôle granulaire par dossier
- Protection contre les dossiers dangereux
- Code facile à maintenir (~250 lignes)
