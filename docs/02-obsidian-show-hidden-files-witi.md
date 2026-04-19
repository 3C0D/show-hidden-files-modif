# Fiche : obsidian-show-hidden-files-witi

## Concept
**Monkey-patch** l'adapter Obsidian pour intercepter la suppression des fichiers cachés et les révéler à la place.

## Approche technique

### 1. Patch de reconcileDeletion
```typescript
// Sauvegarde de la fonction originale
this.originalReconcileDeletion = adapter.reconcileDeletion.bind(adapter);

// Remplacement par une version patchée
adapter.reconcileDeletion = async (realPath: string, path: string) => {
    if (this.settings.showHiddenFiles && isHiddenPath(path, configDir)) {
        // Si le fichier existe sur disque, le révéler au lieu de le supprimer
        const fullPath = adapter.getFullPath(path);
        if (await adapter._exists(fullPath, path)) {
            this.hiddenPaths.add(path);
            await this.showFile(path);
            return;
        }
        this.hiddenPaths.delete(path);
    }
    return origReconcileDeletion(realPath, path);
};
```

### 2. Révéler un fichier
```typescript
private async showFile(path: string): Promise<void> {
    const adapter = this.adapter();
    const realPath = adapter.getRealPath(path);
    
    if (adapter.reconcileFileInternal) {
        await adapter.reconcileFileInternal(realPath, path);
    }
}
```

### 3. Masquer un fichier
```typescript
private async hideFile(path: string): Promise<void> {
    const adapter = this.adapter();
    if (this.originalReconcileDeletion) {
        await this.originalReconcileDeletion(
            adapter.getRealPath(path),
            path
        );
    }
}
```

### 4. Rescan du vault
```typescript
private async rescanVault(): Promise<void> {
    await this.adapter().listRecursive("");
}
```

### 5. Suppression du warning
```typescript
// Patch de i18next pour supprimer le message d'erreur
win.i18next.t = function (...args: unknown[]): string {
    if (args[0] === "plugins.file-explorer.msg-bad-dotfile") {
        return "";
    }
    return origT(...args);
};
```

## Points clés

### ✅ Avantages
- **Simple** : Code court (~200 lignes)
- **Efficace** : Les fichiers cachés apparaissent vraiment dans l'explorateur
- **Toggle global** : Un seul setting pour tout activer/désactiver
- **Pas de vue custom** : Utilise l'explorateur natif

### ❌ Inconvénients
- **Monkey-patching** : Modifie les fonctions internes d'Obsidian
- **Fragile** : Peut casser avec les mises à jour d'Obsidian
- **Global** : Tous les fichiers cachés sont révélés d'un coup
- **Surcharge** : Scan complet du vault au démarrage

## Code essentiel

### Détection des fichiers cachés
```typescript
function isHiddenPath(path: string, configDir: string): boolean {
    const segments = path.split("/");
    return segments.some(
        (s) => s.startsWith(".") && s !== configDir && !ALWAYS_EXCLUDED.has(s)
    );
}
```

### Enable/Disable
```typescript
async enableHiddenFiles(): Promise<void> {
    this.patchAdapter();
    this.suppressDotfileWarning();
    await this.rescanVault();
}

async disableHiddenFiles(): Promise<void> {
    // Masquer tous les fichiers révélés
    for (const path of this.hiddenPaths) {
        await this.hideFile(path);
    }
    this.hiddenPaths.clear();
    await this.restoreAdapter();
    this.restoreDotfileWarning();
}
```

## Conclusion
Approche **élégante et simple** mais :
- Utilise du monkey-patching (risqué)
- Révèle TOUS les fichiers cachés d'un coup (pas de contrôle granulaire)
- Scan complet au démarrage (surcharge)

**Bon pour inspiration** : Utilisation de `reconcileFileInternal` et `reconcileDeletion` pour révéler/masquer.

**À adapter** : Besoin de contrôle par dossier, pas global.
