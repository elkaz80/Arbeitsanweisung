// src/UI/ObjectGraphPanel.js

import * as THREE from 'three'; // Für instanceof und Vektoren

class ObjectGraphPanel {
    /**
     * Verwaltet die Anzeige und Interaktion der Objektliste (Szene-Graph).
     * @param {THREE.Scene} scene - Die Three.js Szene.
     * @param {object} selectionManager - Instanz des SelectionManagers.
     * @param {HTMLElement} parentElement - Das DOM-Element (z.B. Div), in dem die Liste angezeigt wird.
     */
    constructor(scene, selectionManager, parentElement) {
        if (!scene || !selectionManager || !parentElement) {
            throw new Error("ObjectGraphPanel requires Scene, SelectionManager, and parentElement!");
        }
        this.scene = scene;
        this.selectionManager = selectionManager;
        this.parentElement = parentElement; // Container-Div, z.B. #object-list-container

        this.init();
    }

    /**
     * Initialisiert das Panel, leert den Container und erstellt die Liste.
     */
    init() {
        console.log("[ObjectGraphPanel] Initializing...");
        this.parentElement.innerHTML = ''; // Sicherstellen, dass leer
        this.updateObjectList();
    }

    /**
     * Erstellt oder aktualisiert die komplette Objektliste im DOM.
     */
    updateObjectList() {
        this.parentElement.innerHTML = ''; // Alte Liste entfernen
        const ul = document.createElement('ul');
        ul.className = 'object-list'; // CSS-Klasse für Styling
        ul.style.paddingLeft = '10px'; // Einfaches Einrücken

        // Durch die direkten Kinder der Szene iterieren
        // Für eine verschachtelte Ansicht müsste man rekursiv durchgehen
        this.scene.children.forEach(object => {
            this.appendObjectItem(object, ul, 0); // Starte mit Tiefe 0
        });

        this.parentElement.appendChild(ul);
        // Nach dem Neuaufbau die aktuellen Highlights anwenden
        this.updateSelectionHighlight();
        // console.log("[ObjectGraphPanel] Object list updated.");
    }

    /**
     * Erstellt rekursiv Listeneinträge für ein Objekt und seine Kinder.
     * @param {THREE.Object3D} object Das Objekt, das hinzugefügt werden soll.
     * @param {HTMLElement} parentListElement Das UL-Element, an das angehängt wird.
     * @param {number} depth Die aktuelle Verschachtelungstiefe für Einrückung.
     */
    appendObjectItem(object, parentListElement, depth) {
        // --- Objekte filtern, die wir nicht anzeigen wollen ---
        if (object.name === 'MultiSelectPivot' ||
            object.name === 'TransformControlsGizmo' ||
            object.name === 'Floor' || // Boden ausblenden? Geschmackssache
            object.name === 'GridHelper' ||
            object.name === 'AxesHelper' ||
            object.isLight || // Alle Lichter ausblenden?
            object.isCamera) // Alle Kameras ausblenden?
            {
            return; // Dieses Objekt überspringen
        }

        const li = document.createElement('li');
        li.className = 'object-list-item';
        li.style.marginLeft = `${depth * 15}px`; // Einrückung basierend auf Tiefe
        li.style.cursor = 'pointer';
        li.style.marginBottom = '2px';
        li.dataset.uuid = object.uuid; // UUID speichern für Klickerkennung

        // --- Icon hinzufügen (optional) ---
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons object-icon'; // Material Icons verwenden
        iconSpan.style.fontSize = '16px';
        iconSpan.style.marginRight = '5px';
        iconSpan.style.verticalAlign = 'bottom';
        if (object.isMesh) { iconSpan.textContent = 'view_in_ar'; } // Würfel-Icon
        else if (object.isGroup) { iconSpan.textContent = 'folder'; } // Ordner-Icon
        else if (object.isLine) { iconSpan.textContent = 'linear_scale'; } // Linien-Icon
        else { iconSpan.textContent = 'radio_button_unchecked'; } // Default
        li.appendChild(iconSpan);

        // --- Namen hinzufügen ---
        const nameSpan = document.createElement('span');
        nameSpan.textContent = object.name || object.type; // Name anzeigen, sonst Typ
        li.appendChild(nameSpan);

        // --- Klick-Listener hinzufügen ---
        li.addEventListener('click', (event) => {
            event.stopPropagation(); // Verhindert, dass Klicks auf übergeordnete Elemente durchgehen
            const isModifier = event.ctrlKey || event.metaKey || event.shiftKey;
            // Rufe updateSelection im SelectionManager auf
            this.selectionManager.updateSelection(object, isModifier);
        });

        parentListElement.appendChild(li);

        // --- Rekursiv für Kinder aufrufen ---
        // Nur für Objekte, die keine Lichter/Kameras etc. sind (außer Groups?)
        if (object.children && object.children.length > 0 && !object.isLight && !object.isCamera) {
             const subUl = document.createElement('ul');
             subUl.style.paddingLeft = '10px'; // Weiter einrücken
             subUl.style.listStyle = 'none';
             object.children.forEach(child => {
                 this.appendObjectItem(child, subUl, depth + 1); // Rekursiver Aufruf mit erhöhter Tiefe
             });
             // Nur anhängen, wenn die Unterliste nicht leer ist (nach Filterung)
             if (subUl.children.length > 0) {
                 li.appendChild(subUl); // Unterliste an das li anhängen
             }
        }
    }


    /**
     * Aktualisiert das visuelle Highlight für Listeneinträge basierend auf der aktuellen Auswahl.
     */
    updateSelectionHighlight() {
        const selectedObjects = this.selectionManager.getSelectedObjects(); // Aktuelle Auswahl holen
        const selectedUUIDs = new Set(selectedObjects.map(obj => obj.uuid)); // Set für schnellen Zugriff

        const allItems = this.parentElement.querySelectorAll('.object-list-item');
        allItems.forEach(item => {
            const uuid = item.dataset.uuid;
            if (uuid && selectedUUIDs.has(uuid)) {
                item.classList.add('selected'); // CSS-Klasse für ausgewähltes Element
                // Optional: Zum Element scrollen? (kann komplex sein)
            } else {
                item.classList.remove('selected');
            }
        });
    }

} // Ende class ObjectGraphPanel

export default ObjectGraphPanel;