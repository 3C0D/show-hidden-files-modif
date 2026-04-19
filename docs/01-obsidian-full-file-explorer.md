# Fiche : obsidian-full-file-explorer

## Concept
Crée une **vue personnalisée** (sidebar) qui affiche tous les fichiers du vault, y compris les fichiers cachés.

## Approche technique

### 1. Vue personnalisée (ItemView)
- Enregistre un type de vue custom : `VIEW_TYPE_FULL_EXPLORER`
- Affiche dans la sidebar gauche
- Arborescence complète avec expand/collapse

### 2. Scan du système de fichiers
```typescript
// Utilise fs.readdirSync directement
const items = fs.readdirSync(dirPath);
const stat = fs.statSync(fullPath);
```

### 3. Gestion des fichiers cachés
- Détecte les fichiers commençant par `.`
- Applique des exclusions configurables (`.DS_Store`, `node_modules`)
- Pas de monkey-patching de l'adapter Obsidian

### 4. Ouverture des fichiers
- Fichiers trackés par Obsidian : `app.workspace.getLeaf().openFile()`
- Fichiers cachés : `fs.readFileSync()` + copie du path

## Points clés

### ✅ Avantages
- **Simple** : Pas de modification de l'API interne
- **Isolé** : Vue séparée, n'affecte pas l'explorateur principal
- **Lecture directe** : Utilise fs pour scanner
- **Pas de surcharge** : Scan uniquement quand la vue est ouverte

### ❌ Inconvénients
- Nécessite une vue séparée (sidebar)
- Les fichiers cachés ne sont pas vraiment "révélés" dans Obsidian
- Duplication de l'explorateur de fichiers

## Code essentiel

### Scanner un dossier
```typescript
private async scanEntries(dirPath: string, relativePath: string): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
        if (settings.excludePatterns.includes(item)) continue;
        
        const stat = fs.statSync(fullPath);
        const isHidden = item.startsWith(".");
        
        entries.push({
            name: item,
            path: relativePath,
            isDirectory: stat.isDirectory(),
            isHidden
        });
    }
    
    return entries;
}
```

### Afficher l'arborescence
```typescript
private async renderEntry(container: HTMLElement, entry: FileEntry, depth: number) {
    const itemEl = container.createDiv({ cls: "full-explorer-item" });
    itemEl.style.paddingLeft = `${depth * 16 + 8}px`;
    
    if (entry.isDirectory) {
        // Chevron + icône dossier
        const chevron = rowEl.createSpan({ cls: "full-explorer-chevron" });
        setIcon(chevron, isExpanded ? "chevron-down" : "chevron-right");
        
        // Render children si expanded
        if (isExpanded) {
            const children = await this.scanEntries(fullPath, entry.path);
            for (const child of children) {
                await this.renderEntry(container, child, depth + 1);
            }
        }
    }
}
```

## Conclusion
Approche **non-invasive** mais nécessite une vue séparée. Les fichiers cachés restent cachés pour Obsidian, on les affiche juste dans une vue custom.

**Pas adapté** pour notre besoin : on veut révéler les fichiers dans l'explorateur principal, pas créer une vue séparée.
