import { Plugin, PluginSettingTab, Setting, App, TFolder, Menu, Modal, Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

interface HiddenFilesSettings {
	excludedFolders: string[];
	excludedExtensions: string[];
	revealedFiles: Record<string, string[]>; // folderPath -> revealed files
}

const DEFAULT_SETTINGS: HiddenFilesSettings = {
	excludedFolders: ['.git', 'node_modules', '.trash'],
	excludedExtensions: [],
	revealedFiles: {}
};

interface HiddenItem {
	name: string;
	path: string;
	isFolder: boolean;
	size: number;
}

interface PrivateAdapter {
	reconcileFileInternal?(realPath: string, path: string): Promise<void>;
	reconcileFolderCreation(realPath: string, path: string): Promise<void>;
	reconcileDeletion(realPath: string, path: string): Promise<void>;
	getRealPath(path: string): string;
	getFullPath(path: string): string;
	basePath: string;
}

export default class ShowHiddenFilesPlugin extends Plugin {
	settings!: HiddenFilesSettings;

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					const folderPath = file.path;
					const hasRevealed = this.settings.revealedFiles[folderPath]?.length > 0;

					menu.addItem((item) => {
						item
							.setTitle('Montrer les fichiers cachés')
							.setIcon('eye')
							.onClick(() => {
								new HiddenFilesModal(this.app, this, folderPath).open();
							});
					});

					if (hasRevealed) {
						menu.addItem((item) => {
							item
								.setTitle('Masquer les fichiers cachés')
								.setIcon('eye-off')
								.onClick(async () => {
									await this.hideFilesInFolder(folderPath);
								});
						});
					}
				}
			})
		);

		this.addSettingTab(new HiddenFilesSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getAdapter(): PrivateAdapter {
		return this.app.vault.adapter as any;
	}

	getBasePath(): string {
		return this.getAdapter().basePath;
	}

	scanHiddenFiles(folderPath: string): HiddenItem[] {
		const basePath = this.getBasePath();
		const fullPath = path.join(basePath, folderPath);
		const items: HiddenItem[] = [];

		try {
			const entries = fs.readdirSync(fullPath);

			for (const entry of entries) {
				if (!entry.startsWith('.')) continue;

				const entryPath = path.join(fullPath, entry);
				const relativePath = folderPath ? `${folderPath}/${entry}` : entry;

				try {
					const stat = fs.statSync(entryPath);
					const isFolder = stat.isDirectory();

					// Exclure les dossiers dangereux
					if (isFolder && this.settings.excludedFolders.includes(entry)) {
						continue;
					}

					// Exclure les extensions
					if (!isFolder) {
						const ext = entry.substring(1); // Enlever le point
						if (this.settings.excludedExtensions.includes(ext)) {
							continue;
						}

						// Limite de 10 MB
						if (stat.size > 10 * 1024 * 1024) {
							continue;
						}
					}

					items.push({
						name: entry,
						path: relativePath,
						isFolder,
						size: stat.size
					});
				} catch (e) {
					// Ignorer les erreurs de permission
				}
			}

			items.sort((a, b) => {
				if (a.isFolder && !b.isFolder) return -1;
				if (!a.isFolder && b.isFolder) return 1;
				return a.name.localeCompare(b.name);
			});
		} catch (e) {
			console.error('Erreur scan:', e);
		}

		return items;
	}

	async revealFiles(folderPath: string, itemPaths: string[]) {
		const adapter = this.getAdapter();
		const basePath = this.getBasePath();

		for (const itemPath of itemPaths) {
			const realPath = adapter.getRealPath(itemPath);
			const fullPath = path.join(basePath, itemPath);
			
			try {
				const stat = fs.statSync(fullPath);
				
				if (stat.isDirectory()) {
					// Révéler un dossier
					await adapter.reconcileFolderCreation(realPath, itemPath);
				} else {
					// Révéler un fichier
					if (adapter.reconcileFileInternal) {
						await adapter.reconcileFileInternal(realPath, itemPath);
					}
				}
			} catch (e) {
				console.error(`Erreur révélation ${itemPath}:`, e);
			}
		}

		this.settings.revealedFiles[folderPath] = itemPaths;
		await this.saveSettings();
		new Notice(`${itemPaths.length} élément(s) révélé(s)`);
	}

	async hideFilesInFolder(folderPath: string) {
		const adapter = this.getAdapter();
		const revealed = this.settings.revealedFiles[folderPath] || [];

		for (const filePath of revealed) {
			const realPath = adapter.getRealPath(filePath);
			await adapter.reconcileDeletion(realPath, filePath);
		}

		delete this.settings.revealedFiles[folderPath];
		await this.saveSettings();
		new Notice(`${revealed.length} fichier(s) masqué(s)`);
	}
}

class HiddenFilesModal extends Modal {
	plugin: ShowHiddenFilesPlugin;
	folderPath: string;
	items: HiddenItem[];
	selected: Set<string> = new Set();

	constructor(app: App, plugin: ShowHiddenFilesPlugin, folderPath: string) {
		super(app);
		this.plugin = plugin;
		this.folderPath = folderPath;
		this.items = plugin.scanHiddenFiles(folderPath);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('hidden-files-modal');

		contentEl.createEl('h2', { text: 'Fichiers cachés' });
		contentEl.createEl('p', { text: `Dossier: ${this.folderPath || '(racine)'}` });

		if (this.items.length === 0) {
			contentEl.createEl('p', { text: 'Aucun fichier caché trouvé' });
			return;
		}

		const listEl = contentEl.createDiv({ cls: 'hidden-files-list' });

		for (const item of this.items) {
			const itemEl = listEl.createDiv({ cls: 'hidden-file-item' });

			const checkbox = itemEl.createEl('input', { type: 'checkbox' });
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selected.add(item.path);
				} else {
					this.selected.delete(item.path);
				}
			});

			const icon = itemEl.createSpan({ cls: 'hidden-file-icon' });
			icon.textContent = item.isFolder ? '📁' : '📄';

			const name = itemEl.createSpan({ cls: 'hidden-file-name', text: item.name });

			if (!item.isFolder) {
				const size = itemEl.createSpan({ cls: 'hidden-file-size' });
				size.textContent = this.formatSize(item.size);
			}
		}

		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const selectAllBtn = buttonContainer.createEl('button', { text: 'Tout sélectionner' });
		selectAllBtn.addEventListener('click', () => {
			this.items.forEach(item => this.selected.add(item.path));
			this.onOpen(); // Refresh
		});

		const revealBtn = buttonContainer.createEl('button', { text: 'Révéler', cls: 'mod-cta' });
		revealBtn.addEventListener('click', async () => {
			if (this.selected.size > 0) {
				await this.plugin.revealFiles(this.folderPath, Array.from(this.selected));
				this.close();
			}
		});

		const cancelBtn = buttonContainer.createEl('button', { text: 'Annuler' });
		cancelBtn.addEventListener('click', () => this.close());
	}

	formatSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class HiddenFilesSettingTab extends PluginSettingTab {
	plugin: ShowHiddenFilesPlugin;

	constructor(app: App, plugin: ShowHiddenFilesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Fichiers cachés - Paramètres' });

		new Setting(containerEl)
			.setName('Dossiers exclus')
			.setDesc('Dossiers cachés à ne jamais afficher (séparés par des virgules)')
			.addText(text => text
				.setPlaceholder('.git, node_modules, .trash')
				.setValue(this.plugin.settings.excludedFolders.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludedFolders = value
						.split(',')
						.map(s => s.trim())
						.filter(s => s.length > 0);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Extensions exclues')
			.setDesc('Extensions de fichiers cachés à exclure (sans le point, séparées par des virgules)')
			.addText(text => text
				.setPlaceholder('tmp, log, cache')
				.setValue(this.plugin.settings.excludedExtensions.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludedExtensions = value
						.split(',')
						.map(s => s.trim())
						.filter(s => s.length > 0);
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Dossiers dangereux supplémentaires' });
		containerEl.createEl('p', { 
			text: 'Suggestions: .svn, .hg, .bzr, CVS, __pycache__, .pytest_cache, .mypy_cache, .tox, .venv, .env',
			cls: 'setting-item-description'
		});
	}
}
