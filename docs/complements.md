## Monkey around!

La valeur ajoutée de monkey-around par rapport à un monkey-patch manuel est triple :
1. Désinstallation propre
Un patch manuel remplace la méthode, point final. Avec around(), tu récupères une fonction uninstall() qui retire ton wrapper proprement, même si d'autres patches ont été ajoutés entre-temps.
2. Empilement coopératif
Si deux plugins patchent la même méthode manuellement, le second écrase le premier (ou doit manuellement sauvegarder et chaîner l'ancien). around() gère la chaîne automatiquement, chaque wrapper appelle l'ancien via oldMethod.apply().
3. dedupe()
Quand plusieurs plugins veulent appliquer le "même" patch fonctionnel (ex. intercepter le même événement Obsidian), dedupe() garantit que le comportement ne s'exécute qu'une seule fois, peu importe combien de plugins sont actifs.

Dans ton contexte Obsidian : c'est exactement pour ça que tu l'utilises (ou l'as utilisé) pour le monkey-patching de méthodes internes d'Obsidian, car plusieurs plugins peuvent coexister sur les mêmes méthodes sans se marcher dessus, et onunload() peut appeler uninstall() sans laisser de résidu.



## Obsidian-typings

import type { DataAdapterEx } from 'obsidian-typings';

(app.vault.adapter as DataAdapterEx).getFullPath('note.md');

// or

import { getDataAdapterEx } from 'obsidian-typings/implementations';

getDataAdapterEx(app).getFullPath('note.md');


obsidian-typings/implementations

Additional helper functions/types/... added by this package can be used by importing from obsidian-typings/implementations:

import { InternalPluginName } from 'obsidian-typings/implementations';

// If you forget the `/implementations` part:
// import { InternalPluginName } from 'obsidian-typings';
// You will not be able to use the runtime values and the code below will not compile.

this.app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer);

The list of all available implementations can be found in the src/obsidian/implementations folder in the corresponding release branch (example for 1.9.10 public).
