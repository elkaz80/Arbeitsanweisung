// src/UI/HtmlPanel.js

// Importiere die Templates direkt. Stelle sicher, dass der Pfad korrekt ist
// und dass HTML_TEMPLATES in der anderen Datei korrekt exportiert wird
// (z.B. mit export const HTML_TEMPLATES = [...];)
import { HTML_TEMPLATES } from './HTMLTemplates.js'; // Pfad anpassen!
import * as THREE from 'three'; // Wird für Vektor benötigt

class HtmlPanel {
    /**
     * Verwaltet das Panel zum Hinzufügen von HTML-Elementen aus Vorlagen.
     * @param {object} html3DManager - Instanz des HTML3DManagers.
     * @param {object} selectionManager - Instanz des SelectionManagers.
     * @param {HTMLElement} parentElement - Das DOM-Element (Submenü-Div #html-submenu).
     */
    constructor(html3DManager, selectionManager, parentElement) {
        if (!html3DManager || !selectionManager || !parentElement) {
            throw new Error("HtmlPanel requires HTML3DManager, SelectionManager, and parentElement!");
        }
        this.html3DManager = html3DManager;
        this.selectionManager = selectionManager;
        this.parentElement = parentElement;
        this.templates = HTML_TEMPLATES; // Referenz auf die importierten Templates

        this.init();
    }

    /**
     * Initialisiert das Panel und erstellt die Liste der Template-Buttons.
     */
    init() {
        this.parentElement.innerHTML = '<h4>HTML Vorlage hinzufügen</h4>'; // Titel
        this.populateTemplateList();
        console.log("[HtmlPanel] Initialized.");
    }

    /**
     * Erstellt die klickbaren Einträge für jede HTML-Vorlage.
     */
    populateTemplateList() {
        if (!this.templates || this.templates.length === 0) {
            this.parentElement.innerHTML += '<p style="padding: 10px; color: #aaa;">Keine Vorlagen gefunden.</p>';
            return;
        }

        const listContainer = document.createElement('div');
        listContainer.className = 'template-list-container'; // Für Styling

        this.templates.forEach(template => {
            const button = document.createElement('button');
            button.className = 'template-button menu-item-button'; // Styling-Klassen
            button.dataset.templateId = template.id; // ID speichern für Klick-Handler
            // Verwende das Icon und den Namen aus dem Template
            button.innerHTML = `${template.icon || '📄'} ${template.name}`;
            button.title = `Vorlage '${template.name}' hinzufügen`;

            button.addEventListener('click', () => this.handleTemplateClick(template.id));
            listContainer.appendChild(button);
        });

        this.parentElement.appendChild(listContainer);
        console.log(`[HtmlPanel] Populated with ${this.templates.length} templates.`);
    }

    /**
     * Wird aufgerufen, wenn auf einen Template-Button geklickt wird.
     * @param {string} templateId Die ID der ausgewählten Vorlage.
     */
    handleTemplateClick(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            console.error(`[HtmlPanel] Template with ID '${templateId}' not found.`);
            return;
        }

        console.log(`[HtmlPanel] Template '${template.name}' clicked.`);

        // --- Positionierungslogik (Beispiel) ---
        let targetPosition = new THREE.Vector3(0, 1, 0); // Standardposition
        let targetParent = null; // Standard: An Szene anhängen

        const selectedObject = this.selectionManager.getSingleSelectedObject();
        if (selectedObject) {
            // Position leicht über dem ausgewählten Objekt
            const offset = 0.2; // Abstand über dem Objekt
            targetPosition = selectedObject.getWorldPosition(new THREE.Vector3()); // Weltposition holen
            const size = new THREE.Box3().setFromObject(selectedObject).getSize(new THREE.Vector3());
            targetPosition.y += (size.y / 2) + offset; // Position über das Objekt

            // Optional: An das ausgewählte Objekt anhängen?
            // targetParent = selectedObject;
            console.log(`[HtmlPanel] Positioning relative to selected object: ${selectedObject.name}`);
        } else {
            console.log("[HtmlPanel] No object selected, using default position.");
        }
        // --- Ende Positionierungslogik ---


        // Rufe Methode im HTML3DManager auf, um das Element zu erstellen und hinzuzufügen
        if (typeof this.html3DManager.addElementFromTemplate === 'function') {
            this.html3DManager.addElementFromTemplate(template, targetPosition, targetParent);
        } else {
            console.error("[HtmlPanel] HTML3DManager does not have addElementFromTemplate method!");
        }

        // Optional: Menü nach Klick schließen?
        // this.uiManager?.closeAllSubmenus(); // Benötigt Referenz auf UIManager
    }

} // Ende class HtmlPanel

export default HtmlPanel;