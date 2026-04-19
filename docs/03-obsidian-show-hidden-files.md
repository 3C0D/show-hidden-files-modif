# Fiche : obsidian-show-hidden-files

## Concept
Plugin **ultra-complexe** avec architecture avancée, système de règles, internationalisation, etc.

## Approche technique

### 1. Architecture complexe
- Utilise une librairie custom `@polyipseity/obsidian-plugin-library`
- Classes abstraites : `PluginContext`, `SettingsManager`, `LanguageManager`
- Système de règles avec `SettingRules` et `Rules`
- Gestion des événements avec `onChanged.emit()`

### 2. Système de règles (ShowingRules)
```typescript
class ShowingRules extends SettingRules<Settings> {
    public test(str?: string): boolean {
        return (
            settings.value.showHiddenFiles &&
            (str === void 0 ||
                (isConfigDir(str)
                    ? settings.value.showConfigurationFolder
                    : super.test(str)))
        );
    }
}
```

### 3. Triple patching
#### a) Patch du Vault (comme witi)
```typescript
around(adapter0, {
    reconcileDeletion(next) {
        return async function fn(...args) {
            const [, path] = args;
            if (isHiddenPath(path)) {
                if (await adapter._exists(fullPath, path)) {
                    hiddenPaths.add(path);
                    if (filter.test(path)) {
                        return showFile(context, path);
                    }
                } else {
                    hiddenPaths.delete(path);
                }
            }
            return next.apply(this, args);
        };
    }
})
```

#### b) Patch des messages d'erreur
```typescript
around(i18next, {
    t(next) {
        return function fn(...args) {
            if (filter.test()) {
                const [key] = args;
                if (key === "plugins.file-explorer.msg-bad-dotfile") {
                    return "";
                }
            }
            return next.apply(this, args);
        };
    }
})
```

#### c) Patch du File Explorer (renommage)
```typescript
around(view0, {
    finishRename(next) {
        return async function fn(...args) {
            // Logique complexe avec UUID pour contourner la validation
            const uuid = self.crypto.randomUUID();
            const patch2 = around(fileBeingRenamed, {
                getNewPathAfterRename(proto2) {
                    return function fn2(...args2) {
                        const [filename2] = args2;
                        if (filename2 === uuid) {
                            args2[0] = filename;
                        }
                        return proto2.apply(this, args2);
                    };
                }
            });
            // ...
        };
    }
})
```

### 4. Fonctions de révélation
```typescript
async function showFile(context: PluginContext, path: string): Promise<void> {
    const adapter = context.app.vault.adapter;
    const realPath = adapter.getRealPath(path);
    
    if ("reconcileFileInternal" in adapter) {
        await adapter.reconcileFileInternal(realPath, path);
    } else if ("stat" in fs && "reconcileFileChanged" in adapter) {
        // Fallback pour mobile
        const stat = await fs.stat(adapter.getFullRealPath(realPath));
        if (stat.type === "file") {
            adapter.reconcileFileChanged(realPath, path, stat);
        } else if (stat.type === "directory") {
            await adapter.reconcileFolderCreation(realPath, path);
        }
    }
}
```

## Points clés

### ✅ Avantages
- **Complet** : Gère tous les cas (desktop, mobile, renommage, etc.)
- **Robuste** : Fallbacks pour différentes versions d'Obsidian
- **Système de règles** : Permet de filtrer quels fichiers montrer
- **Internationalisation** : Support multi-langues

### ❌ Inconvénients
- **ULTRA COMPLEXE** : ~500 lignes, classes abstraites, librairie externe
- **Difficile à maintenir** : Trop d'abstractions
- **Overkill** : Fonctionnalités inutiles pour un usage simple
- **Dépendances** : Nécessite une librairie externe
- **Global** : Révèle tous les fichiers cachés d'un coup

## Code essentiel (simplifié)

### Détection des fichiers cachés
```typescript
function isHiddenPath(path: string): boolean {
    return path.split("/").some(isHiddenPathname);
}

function isHiddenPathname(pathname: string): boolean {
    return pathname.startsWith(".");
}
```

### Révéler/Masquer
```typescript
// Révéler
await adapter.reconcileFileInternal(realPath, path);

// Masquer
await adapter.reconcileDeletion(realPath, path);
```

## Conclusion
Plugin **extrêmement complexe** avec une architecture over-engineered.

**Ce qu'on peut en tirer** :
- ✅ Utilisation de `reconcileFileInternal` / `reconcileDeletion`
- ✅ Gestion des dossiers avec `reconcileFolderCreation`
- ✅ Fallback pour mobile avec `reconcileFileChanged`
- ✅ Suppression du warning avec patch de `i18next`

**Ce qu'on doit éviter** :
- ❌ Classes abstraites inutiles
- ❌ Librairie externe
- ❌ Système de règles complexe
- ❌ Internationalisation (pas nécessaire)
- ❌ Patch du renommage (trop complexe)

**Pour notre besoin** : On garde juste les fonctions de base `showFile` et `hideFile`, sans toute la complexité.
