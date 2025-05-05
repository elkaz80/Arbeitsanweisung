// src/UI/ToolsPanel.js

class ToolsPanel {
    /**
     * Verwaltet das Werkzeug-Panel für Montage, Messmittel etc.
     * @param {HTMLElement} parentElement - Das DOM-Element (Submenü-Div #tools-submenu).
     * // Füge hier weitere Manager hinzu, wenn die Tools sie benötigen
     * @param {object} [selectionManager=null]
     * @param {object} [appManager=null]
     */
    constructor(parentElement, selectionManager = null, appManager = null) {
        if (!parentElement) {
            throw new Error("ToolsPanel requires parentElement!");
        }
        this.parentElement = parentElement;
        this.selectionManager = selectionManager;
        this.appManager = appManager;

        this.init();
    }

    init() {
        this.parentElement.innerHTML = ''; // Leeren
        this.populateToolsMenu();
        console.log("[ToolsPanel] Initialized.");
    }

    // --- Logik aus deinem alten UIManager ---
    populateToolsMenu() {
        // Hilfsfunktionen (Beispielimplementierungen)
        const createCategory = (title) => {
            const div = document.createElement('div');
            div.className = 'menu-category'; // CSS-Klasse für Styling
            div.textContent = title;
            return div;
        };

        const createTool = (id, iconName, label) => {
            const button = document.createElement('button');
            button.id = id;
            button.className = 'tool-button'; // CSS-Klasse für Styling
            // Beispiel: Material Icon + Text (benötigt Material Icons Font)
            button.innerHTML = `<span class="material-icons">${iconName}</span> ${label}`;
            button.addEventListener('click', () => this.handleToolClick(id, label));
            return button;
        };

        // Kategorien und Werkzeuge hinzufügen (Dein Code von früher)
        this.parentElement.appendChild(createCategory('Maschine'));
        this.parentElement.appendChild(createTool('tool-akkuschrauber', 'hardware', 'Akkuschrauber'));
        this.parentElement.appendChild(createTool('tool-bohrmaschine', 'precision_manufacturing', 'Bohrmaschine'));
        this.parentElement.appendChild(createTool('tool-stemmhammer', 'construction', 'Stemmhammer'));
        this.parentElement.appendChild(createCategory('Montage'));
        this.parentElement.appendChild(createTool('tool-schraubenschluessel', 'build_circle', 'Schraubenschlüssel'));
        this.parentElement.appendChild(createTool('tool-drehmoment', 'rotate_right', 'Drehmomentschlüssel'));
        this.parentElement.appendChild(createTool('tool-hammer', 'hardware', 'Hammer'));
        this.parentElement.appendChild(createTool('tool-zange', 'handyman', 'Zange'));
        this.parentElement.appendChild(createCategory('Messmittel'));
        this.parentElement.appendChild(createTool('tool-messschieber', 'square_foot', 'Messschieber'));
        this.parentElement.appendChild(createTool('tool-gliedermaßstab', 'straighten', 'Gliedermaßstab'));
        this.parentElement.appendChild(createTool('tool-lineal', 'straighten', 'Lineal'));
        this.parentElement.appendChild(createTool('tool-laserdist', 'settings_ethernet', 'Laser-Distanzmesser'));
        this.parentElement.appendChild(createTool('tool-schichtdicke', 'layers', 'Schichtdickenmesser'));
        this.parentElement.appendChild(createCategory('Elektrik'));
        this.parentElement.appendChild(createTool('tool-multimeter', 'electrical_services', 'Multimeter'));
        this.parentElement.appendChild(createTool('tool-abisolierzange', 'content_cut', 'Abisolierzange'));
        this.parentElement.appendChild(createTool('tool-loetkolben', 'whatshot', 'Lötkolben'));
        this.parentElement.appendChild(createCategory('Hilfsmittel'));
        this.parentElement.appendChild(createTool('tool-leiter', 'ramp_right', 'Leiter/Tritt'));
        this.parentElement.appendChild(createTool('tool-lampe', 'lightbulb', 'Arbeitsleuchte'));
        this.parentElement.appendChild(createTool('tool-besen', 'cleaning_services', 'Besen/Reinigung'));

        console.log("[ToolsPanel] Tools menu populated.");
    }

    /**
     * Platzhalter-Funktion, die aufgerufen wird, wenn ein Werkzeug geklickt wird.
     * @param {string} toolId Die ID des geklickten Werkzeug-Buttons.
     * @param {string} toolLabel Der Name des Werkzeugs.
     */
    handleToolClick(toolId, toolLabel) {
        console.log(`[ToolsPanel] Tool clicked: ${toolLabel} (ID: ${toolId})`);
        // Hier kommt die Logik hin, was passieren soll, wenn ein Werkzeug ausgewählt wird.
        // Z.B. Mauscursor ändern, einen Modus aktivieren, etc.
        // Benötigt ggf. Zugriff auf selectionManager oder controlsManager.
        alert(`Werkzeug ausgewählt: ${toolLabel}`); // Einfaches Feedback
    }

} // Ende class ToolsPanel

export default ToolsPanel;