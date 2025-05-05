// src/UI/UIManager.js (Vollständig, nach Refactoring)

// Importiere die spezialisierten UI-Panel Klassen
// Stelle sicher, dass die Pfade zu deinem Projekt passen!
import SettingsPanel from './SettingsPanel.js';
import FileMenu from './FileMenu.js';
import ToolsPanel from './ToolsPanel.js';
import HtmlPanel from './HtmlPanel.js';
import ObjectGraphPanel from './ObjectGraphPanel.js';
import TimelinePanel from './TimelinePanel.js'; // Import für die zukünftige Timeline

class UIManager {
    constructor() {
        // Referenzen zu anderen Managern (werden extern über setManagers gesetzt)
        this.appManager = null;
        this.selectionManager = null;
        this.loaderService = null;
        this.controlsManager = null;
        this.animationManager = null;
        this.html3DManager = null;
        this.connectorManager = null;

        // Referenzen zu den UI-Panel Instanzen
        this.settingsPanel = null;
        this.fileMenu = null;
        this.toolsPanel = null;
        this.htmlPanel = null;
        this.objectGraphPanel = null;
        this.timelinePanel = null; // Für die Animationsleiste

        this.activeSubmenu = null; // Verfolgt das aktuell geöffnete Submenü
    }

    /**
     * Speichert Referenzen auf alle benötigten Manager.
     * Wird von main.js nach der Instanziierung aller Manager aufgerufen.
     */
    setManagers(appManager, selectionManager, loaderService, controlsManager, animationManager, html3DManager, connectorManager) {
        this.appManager = appManager;
        this.selectionManager = selectionManager;
        this.loaderService = loaderService;
        this.controlsManager = controlsManager;
        this.animationManager = animationManager;
        this.html3DManager = html3DManager;
        this.connectorManager = connectorManager;

        // Wichtig: AnimationManager braucht UIManager für Callbacks!
        this.animationManager?.setUIManager(this);

        console.log("[UIManager] All manager references set.");
    }

    /**
     * Initialisiert die Haupt-UI-Struktur (Navbar-Listener) und die einzelnen UI-Panels.
     */
    init() {
        console.log("[UIManager] Initializing UI structure and panels...");

        // --- 1. Generelle Listener für Menü-Toggles anhängen ---
        this.attachToggleListener('file-menu-btn', 'file-submenu');
        this.attachToggleListener('html-menu-btn', 'html-submenu');
        this.attachToggleListener('tools-menu-btn', 'tools-submenu');
        this.attachToggleListener('settings-menu-btn', 'settings-submenu');
        // Füge hier Listener für weitere Hauptmenü-Buttons hinzu...

        // Listener, um Menüs bei Klick daneben zu schließen
        document.addEventListener('click', (event) => {
            const clickedInsideNavbar = event.target.closest('#navbar');
            const clickedInsideSubmenu = event.target.closest('.submenu');
            if (!clickedInsideNavbar && !clickedInsideSubmenu) {
                this.closeAllSubmenus();
            }
        }, false);


        // --- 2. Spezifische UI-Panels instanziieren und initialisieren ---
        // Hole die Container-Elemente für die Submenüs/Panels
        const fileSubmenuElement = document.getElementById('file-submenu');
        const toolsSubmenuElement = document.getElementById('tools-submenu');
        const settingsSubmenuElement = document.getElementById('settings-submenu');
        const htmlSubmenuElement = document.getElementById('html-submenu');
        const objectListContainer = document.getElementById('object-list-container');
        const timelineControlsElement = document.getElementById('timeline-controls'); // Für die zukünftige Timeline

        try {
            // Settings Panel
            if (settingsSubmenuElement && this.appManager) {
                this.settingsPanel = new SettingsPanel(this.appManager, settingsSubmenuElement);
            } else { console.error("Failed to init SettingsPanel: Dependencies or Element missing."); }

            // File Menu (mit Upload UND Transform)
            if (fileSubmenuElement && this.loaderService && this.controlsManager) {
                 this.fileMenu = new FileMenu(this.loaderService, this.controlsManager, fileSubmenuElement);
            } else { console.error("Failed to init FileMenu: Dependencies or Element missing."); }

            // Tools Panel (für Montage etc.)
            if (toolsSubmenuElement) {
                 this.toolsPanel = new ToolsPanel(toolsSubmenuElement, this.selectionManager, this.appManager);
            } else { console.error("Failed to init ToolsPanel: Element missing."); }

            // Html Panel (zum Hinzufügen von Templates & Connectors)
            if (htmlSubmenuElement && this.html3DManager && this.selectionManager && this.connectorManager) {
                this.htmlPanel = new HtmlPanel(this.html3DManager, this.selectionManager, htmlSubmenuElement, this.connectorManager);
            } else { console.error("Failed to init HtmlPanel: Dependencies or Element missing."); }

            // Object Graph Panel
            if (objectListContainer && this.appManager?.scene && this.selectionManager) {
                 this.objectGraphPanel = new ObjectGraphPanel(this.appManager.scene, this.selectionManager, objectListContainer);
            } else { console.error("Failed to init ObjectGraphPanel: Dependencies or Element (#object-list-container) missing."); }

            // Timeline Panel (wird initialisiert, wenn Element und Manager da sind)
            if (timelineControlsElement && this.animationManager && this.selectionManager) {
                 this.timelinePanel = new TimelinePanel(this.animationManager, this.selectionManager, timelineControlsElement);
            } else { console.warn("Could not find dependencies or element (#timeline-controls) for TimelinePanel. Timeline UI will not be available yet."); }

        } catch (error) {
            console.error("[UIManager] Error during panel initialization:", error);
        }

        // --- 3. Alte Methoden sind entfernt ---
        // Methoden wie populateFileMenu, populateToolsMenu, attachUploadListener, etc.
        // sind jetzt in den jeweiligen Panel-Klassen gekapselt.

        console.log("[UIManager] Initialization complete.");
    }


    // --- Generelle UI-Hilfsmethoden ---

    /**
     * Fügt einen Event Listener zu einem Button hinzu, der ein Submenü umschaltet.
     */
    attachToggleListener(buttonId, submenuId) {
        const button = document.getElementById(buttonId);
        const submenu = document.getElementById(submenuId);

        if (button && submenu) {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const isActive = submenu.style.display === 'block';
                this.closeAllSubmenus(submenuId);
                submenu.style.display = isActive ? 'none' : 'block';
                this.activeSubmenu = isActive ? null : submenu;
                button.classList.toggle('active', !isActive);
            });
        } else {
            console.warn(`[UIManager] Could not find button #${buttonId} or submenu #${submenuId}`);
        }
    }

    /**
     * Schließt alle offenen Submenüs, optional mit einer Ausnahme.
     */
    closeAllSubmenus(exceptMenuId = null) {
        const submenus = document.querySelectorAll('.submenu');
        submenus.forEach(menu => {
            if (menu.id !== exceptMenuId) {
                menu.style.display = 'none';
                const buttonId = menu.id.replace('-submenu', '-menu-btn');
                document.getElementById(buttonId)?.classList.remove('active');
            }
        });
        if (this.activeSubmenu && this.activeSubmenu.id !== exceptMenuId) {
            this.activeSubmenu = null;
        }
    }

    /**
     * Delegiert das Update des Selection-Highlights an das ObjectGraphPanel.
     * Wird von außen aufgerufen (z.B. vom SelectionManager nach updateSelection).
     */
    updateSelectionHighlight() {
        this.objectGraphPanel?.updateSelectionHighlight();
    }

    /**
     * Delegiert das Update der Timeline-Anzeige an das TimelinePanel.
     * Wird vom AnimationManager aufgerufen.
     */
    updateTimelineIndicator(currentTime, duration, isPlaying) { // Nimmt jetzt mehr Infos entgegen
        this.timelinePanel?.updateIndicator(currentTime, duration, isPlaying); // Übergibt an Panel
    }

    /**
     * Wird vom AppManager aufgerufen, wenn sich die Szene ändert (Objekt hinzugefügt/entfernt).
     * Delegiert an das ObjectGraphPanel.
     */
     refreshObjectList() { // Umbenannt für Klarheit
        this.objectGraphPanel?.updateObjectList();
    }

} // Ende class UIManager

export default UIManager;