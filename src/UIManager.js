// src/UIManager.js (Angepasst für statisches Datei-Menü inkl. Transform-Buttons)

import * as THREE from 'three';
// Stelle sicher, dass GUI importiert wird, falls du es wieder verwenden willst
// import GUI from 'lil-gui';
import { hasInvalidTransform } from './utils';

// HTML_TEMPLATES wird für populateHtmlMenu benötigt, kann bleiben
// Stelle sicher, dass diese Variable korrekt gefüllt ist oder aus templates.js importiert wird
const HTML_TEMPLATES = window.HTML_TEMPLATES || [
    { id: 'template-text', name: 'Einfacher Text', html: `<div class="html-content text-content"><p contenteditable="true">Text...</p></div>`, defaultWidth: 300, defaultHeight: 100 },
    { id: 'template-map-embed', name: 'Karte (Embed)', html: `<div class="html-content map-content"><iframe src="https://..." style="..."></iframe><br/><small>...</small></div>`, defaultWidth: 400, defaultHeight: 330 },
];


class UIManager {
    constructor() {
        // DOM Refs deklarieren
        this.loadedObjectsList = null;
        this.uploadButtonInMenu = null; // Statisch
        this.fileInput = null;
        this.translateBtn = null; // Statisch (im Menü)
        this.rotateBtn = null;  // Statisch (im Menü)
        this.scaleBtn = null;   // Statisch (im Menü)
        this.transformButtons = []; // Wird jetzt anders befüllt
        this.fileSubmenu = null; // Container
        this.htmlSubmenu = null; // Container
        this.toolsSubmenu = null; // Container
        this.timelineTrackContainer = null;
        this.timeIndicator = null;
        this.timeIndicatorLabel = null;
        this.playPauseButton = null;
        this.stepForwardBtn = null;
        this.stepBackwardBtn = null;
        this.endTimeInput = null;
        // Manager Refs
        this.selectionManager = null;
        this.loaderService = null;
        this.controlsManager = null;
        this.html3DManager = null;
        this.animationManager = null;
        this.gui = null; // GUI vorerst deaktiviert
        this.appManager = null;
        this.loggedAnimManagerMissing = false;
        this.loggedTimelineUpdateError = false;
    }

    setManagers(appManager, selectionManager, loaderService, controlsManager, animationManager, html3DManager) {
        this.appManager = appManager;
        this.selectionManager = selectionManager;
        this.loaderService = loaderService;
        this.controlsManager = controlsManager;
        this.animationManager = animationManager;
        this.html3DManager = html3DManager;
    }

    init() {
        console.log("[UIManager] Initializing (with static file menu + transform buttons, fixed listeners)...");

        // *** DOM Referenzen holen ***
        this.loadedObjectsList = document.getElementById('loaded-objects-list');
        this.fileInput = document.getElementById('fileInput');
        this.fileSubmenu = document.getElementById('file-submenu');
        this.htmlSubmenu = document.getElementById('html-submenu');
        this.toolsSubmenu = document.getElementById('tools-submenu');
        this.uploadButtonInMenu = document.getElementById('uploadButton-in-menu');
        const exportBtn = document.getElementById('export-btn-in-menu');
        // Transform Buttons
        this.translateBtn = document.getElementById('transform-translate-btn');
        this.rotateBtn = document.getElementById('transform-rotate-btn');
        this.scaleBtn = document.getElementById('transform-scale-btn');
        this.transformButtons = [this.translateBtn, this.rotateBtn, this.scaleBtn].filter(btn => btn != null);

        // Timeline Elemente
        this.timelineTrackContainer = document.getElementById('keyframe-track-container');
        this.timeIndicator = document.getElementById('time-indicator');
        this.timeIndicatorLabel = document.getElementById('time-indicator-label');
        this.playPauseButton = document.getElementById('playPauseBtn');
        this.stepForwardBtn = document.getElementById('stepForwardBtn');
        this.stepBackwardBtn = document.getElementById('stepBackwardBtn');
        this.endTimeInput = document.getElementById('timeline-range-end-input');

        // Optional: Checks, ob Elemente gefunden wurden
        if (!this.fileInput || !this.uploadButtonInMenu || !this.translateBtn || !this.rotateBtn || !this.scaleBtn || !this.playPauseButton || !this.stepForwardBtn || !this.stepBackwardBtn) {
             console.warn("[UIManager] Warning: One or more critical buttons might be missing!");
        }

        // GUI vorerst deaktiviert
        // this.gui = new GUI();
        // this.gui.add({ version: 'Refactor v18 Fixed Init' }, 'version').name('Info');
        console.log("[UIManager] lil-gui temporarily disabled.");


        // === Event Listeners (Korrigierte Versionen ohne '?.') ===

        // Listener für fileInput (?. ist hier ok)
        this.fileInput?.addEventListener('change', this.handleFileUpload.bind(this));

        // Listener für statischen Upload-Button (mit if statt ?.)
        if (this.uploadButtonInMenu) {
             this.uploadButtonInMenu.addEventListener('click', () => {
                console.log("[UIManager] Static Upload button clicked, triggering fileInput click.");
                this.fileInput?.click(); // ?. hier innen ist ok
                this.closeAllSubmenus();
             });
        } else {
             console.warn("[UIManager] Upload button not found, listener not attached.");
        }


        // Listener für statischen Export-Button (mit if statt ?.)
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                console.log("[UIManager] Static Export button clicked - Functionality TBD.");
                this.closeAllSubmenus();
            });
        } // Keine Warnung nötig, wenn nicht gefunden

        // Listener für Transform-Buttons (mit if statt ?.)
        if (this.translateBtn) {
            this.translateBtn.addEventListener('click', () => {
                this.setTransformMode("translate");
            });
        } else {
            console.warn("[UIManager] Translate button not found, listener not attached.");
        }

        if (this.rotateBtn) {
            this.rotateBtn.addEventListener('click', () => {
                this.setTransformMode("rotate");
            });
        } else {
            console.warn("[UIManager] Rotate button not found, listener not attached.");
        }

        if (this.scaleBtn) {
            this.scaleBtn.addEventListener('click', () => {
                this.setTransformMode("scale");
            });
        } else {
            console.warn("[UIManager] Scale button not found, listener not attached.");
        }

        // Listener für Timeline-Buttons (mit if statt ?. und interner Prüfung)
        if (this.playPauseButton) {
            this.playPauseButton.addEventListener('click', () => {
                if (this.animationManager && typeof this.animationManager.togglePlayPause === 'function') {
                    try {
                        const isPlaying = this.animationManager.togglePlayPause();
                        const iconElement = this.playPauseButton.querySelector('.material-icons');
                        if (iconElement) {
                            iconElement.textContent = isPlaying ? 'pause' : 'play_arrow';
                        } else {
                            console.warn("[UIManager] Play/Pause button icon element (.material-icons) not found.");
                        }
                    } catch (error) {
                         console.error("[UIManager] Error during togglePlayPause or setting textContent:", error);
                    }
                } else {
                    console.warn("AnimationManager not ready or togglePlayPause method missing.");
                }
            });
        } else {
            console.warn("[UIManager] Play/Pause button not found, listener not attached.");
        }

        if (this.stepForwardBtn) {
            this.stepForwardBtn.addEventListener('click', () => {
                this.animationManager?.step(1); // ?. hier innen ok
            });
        } else {
            console.warn("[UIManager] StepForward button not found, listener not attached.");
        }

        if (this.stepBackwardBtn) {
            this.stepBackwardBtn.addEventListener('click', () => {
                this.animationManager?.step(-1); // ?. hier innen ok
            });
        } else {
            console.warn("[UIManager] StepBackward button not found, listener not attached.");
        }

        // Listener für EndTime Input (bleibt wie vorher)
        if (this.endTimeInput) {
             this.endTimeInput.addEventListener('input', () => this.handleEndTimeInput());
             this.endTimeInput.addEventListener('blur', () => this.formatAndSetEndTime());
             this.endTimeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { this.formatAndSetEndTime(); e.target.blur();} });
         }

        // === Menü-Logik ===
        this.setupMenuToggle('file-menu-btn', 'file-submenu');
        this.setupMenuToggle('html-menu-btn', 'html-submenu');
        this.setupMenuToggle('tools-menu-btn', 'tools-submenu');
        document.addEventListener('click', (e) => { if (!e.target.closest('.menu-container')) this.closeAllSubmenus(); });

        // Populate für HTML und Tools (bleiben dynamisch)
        this.populateHtmlMenu();
        this.populateToolsMenu();

        // Initialen Transform-Modus setzen
        this.setTransformMode("translate"); // Ruft auch setActiveTransformButton auf

        this.updateTimelineMaxTimeDisplay();

        console.log("[UIManager] Initialization complete (fully revised init).");
    } // <--- HIER ENDET die init() Methode


    // populateHtmlMenu und populateToolsMenu bleiben vorerst dynamisch
    // (Könnten später auch statisch gemacht werden, erfordert Anpassung in HTML & init)
    populateHtmlMenu() {
        if (!this.htmlSubmenu) { console.error("HTML Submenu missing"); return; }
        this.htmlSubmenu.innerHTML = ''; // Leeren
        HTML_TEMPLATES.forEach(t => {
            const button = document.createElement('button');
            button.className = 'add-html-btn'; // Klasse für Styling/Identifikation
            button.dataset.template = t.id; // Template ID speichern
            // Icon und Name einfügen (HTML im Template.icon wird direkt interpretiert)
            button.innerHTML = `${t.icon || '<span class="material-icons">article</span>'} ${t.name}`;
            button.addEventListener('click', () => {
                const id = button.dataset.template;
                console.log(`[UIManager] Add HTML template button clicked: ${id}`);
                this.html3DManager?.addHTMLElement(id);
                this.closeAllSubmenus();
            });
            this.htmlSubmenu.appendChild(button);
        });
        console.log("[UIManager] populateHtmlMenu executed.");
    }

    populateToolsMenu() {
        if (!this.toolsSubmenu) { console.error("Tools Submenu missing"); return; }
        this.toolsSubmenu.innerHTML = ''; // Leeren
        const createCategory = (n) => { const d=document.createElement('div'); d.className='submenu-category'; d.textContent=n; return d; };
        const createTool = (id, i, t) => {
            const b=document.createElement('button');
            b.id=id;
            b.className='submenu-item';
            const iconName = i || 'build';
            b.innerHTML=`<span class="material-icons-outlined">${iconName}</span>${t}`;
            b.onclick=() => {
                console.log(`[UIManager] Tool selected: ${t} (ID: ${id}) - Functionality TBD`);
                this.closeAllSubmenus();
            };
            return b;
        };
        // Werkzeuge hinzufügen
        this.toolsSubmenu.appendChild(createCategory('Maschine'));
        this.toolsSubmenu.appendChild(createTool('tool-akkuschrauber', 'hardware', 'Akkuschrauber'));
        this.toolsSubmenu.appendChild(createTool('tool-bohrmaschine', 'precision_manufacturing', 'Bohrmaschine'));
        this.toolsSubmenu.appendChild(createTool('tool-stemmhammer', 'construction', 'Stemmhammer'));
        this.toolsSubmenu.appendChild(createCategory('Montage'));
        this.toolsSubmenu.appendChild(createTool('tool-schraubenschluessel', 'build_circle', 'Schraubenschlüssel'));
        this.toolsSubmenu.appendChild(createTool('tool-drehmoment', 'rotate_right', 'Drehmomentschlüssel'));
        this.toolsSubmenu.appendChild(createTool('tool-hammer', 'hardware', 'Hammer'));
        this.toolsSubmenu.appendChild(createTool('tool-zange', 'handyman', 'Zange'));
        this.toolsSubmenu.appendChild(createCategory('Messmittel'));
        this.toolsSubmenu.appendChild(createTool('tool-messschieber', 'square_foot', 'Messschieber'));
        this.toolsSubmenu.appendChild(createTool('tool-gliedermaßstab', 'straighten', 'Gliedermaßstab'));
        this.toolsSubmenu.appendChild(createTool('tool-lineal', 'straighten', 'Lineal'));
        this.toolsSubmenu.appendChild(createTool('tool-laserdist', 'settings_ethernet', 'Laser-Distanzmesser'));
        this.toolsSubmenu.appendChild(createTool('tool-schichtdicke', 'layers', 'Schichtdickenmesser'));
        this.toolsSubmenu.appendChild(createCategory('Elektrik'));
        this.toolsSubmenu.appendChild(createTool('tool-multimeter', 'electrical_services', 'Multimeter'));
        this.toolsSubmenu.appendChild(createTool('tool-abisolierzange', 'content_cut', 'Abisolierzange'));
        this.toolsSubmenu.appendChild(createTool('tool-loetkolben', 'whatshot', 'Lötkolben'));
        this.toolsSubmenu.appendChild(createCategory('Hilfsmittel'));
        this.toolsSubmenu.appendChild(createTool('tool-leiter', 'ramp_right', 'Leiter/Tritt'));
        this.toolsSubmenu.appendChild(createTool('tool-lampe', 'lightbulb', 'Arbeitsleuchte'));
        this.toolsSubmenu.appendChild(createTool('tool-besen', 'cleaning_services', 'Besen/Reinigung'));
        console.log("[UIManager] populateToolsMenu executed.");
    }


    // --- Restliche Methoden (Vollständig ausgeschrieben) ---
    setupMenuToggle(buttonId, submenuId) {
        const btn = document.getElementById(buttonId);
        const sub = document.getElementById(submenuId);
        if (btn && sub) {
            // Log beim Anhängen des Listeners
            console.log(`[UIManager] Attaching toggle listener to ${buttonId}`);
            btn.addEventListener('click', (e) => {
                // Log, wenn der Klick registriert wird (ganz am Anfang des Handlers)
                console.log(`[UIManager] Toggle button CLICKED: ${buttonId}`); // *** DAS IST WICHTIG ***
    
                e.stopPropagation(); // Verhindert, dass der Klick das document-Event auslöst und das Menü sofort schließt
    
                const isActive = sub.classList.contains('active');
                 console.log(`[UIManager] Menu ${submenuId} was active: ${isActive}`); // Zustand vor dem Toggle
    
                // Schließe zuerst alle anderen Menüs
                document.querySelectorAll('.submenu.active').forEach(otherMenu => {
                    if (otherMenu !== sub) {
                        console.log(`[UIManager] Closing other active menu: ${otherMenu.id}`);
                        otherMenu.classList.remove('active');
                    }
                });
    
                // Toggle das aktuelle Menü
                console.log(`[UIManager] Toggling active class for ${submenuId}`);
                sub.classList.toggle('active');
                 console.log(`[UIManager] Menu ${submenuId} is now active: ${sub.classList.contains('active')}`); // Zustand nach dem Toggle
            });
        } else {
             console.warn(`[UI] Menu toggle elements missing during setup: ${buttonId} or ${submenuId}`);
        }
    }
    closeAllSubmenus() {
        document.querySelectorAll('.submenu.active').forEach(m => m.classList.remove('active'));
    }

    handleFileUpload(event) {
        const file = event.target.files?.[0]; // Sicherer Zugriff
        console.log("[UIManager] handleFileUpload triggered.");
        if (!file) {
            console.log("[UIManager] No file selected.");
            return;
        }
        if (!this.loaderService) {
            console.error("[UIManager] LoaderService not available in handleFileUpload!");
            return;
        }
        console.log(`[UIManager] File selected: ${file.name}, passing to LoaderService.`);
        this.loaderService.loadFile(file);
        // Reset file input value to allow loading the same file again
        if(event.target) {
             event.target.value = null;
        }
    }

    setActiveTransformButton(activeBtn) {
        // Iteriere über das transformButtons Array, das in init befüllt wurde
        this.transformButtons.forEach(btn => {
             if(btn) { // Sicherstellen, dass Button existiert
                  btn.classList.toggle('active', btn === activeBtn);
             }
        });
    }

    setTransformMode(mode) {
        if (this.controlsManager?.getTransformControls()) {
            console.log(`[UIManager] Setting transform mode to: ${mode}`);
            this.controlsManager.getTransformControls().setMode(mode);
            // Finde den korrekten Button zum Aktivieren basierend auf der ID
            // Wichtig: Die Buttons haben IDs wie 'transform-translate-btn'
            const buttonToActivate = document.getElementById(`transform-${mode}-btn`);
            if (buttonToActivate) {
                 this.setActiveTransformButton(buttonToActivate);
            } else {
                 console.warn(`[UIManager] Could not find transform button for mode: ${mode}`);
            }
        } else {
            console.warn(`[UIManager] Cannot set transform mode - ControlsManager or TransformControls not available.`);
        }
    }

    handleEndTimeInput() {
        if (!this.endTimeInput || !this.animationManager) return;
        const valueString = this.endTimeInput.value.trim().replace(/s$/i, '');
        let numericValue = parseFloat(valueString);
        if (!isNaN(numericValue) && numericValue >= 0) { // Erlaube auch 0
            // console.log(`[UIManager] End time input changed (live): ${numericValue}`);
            this.animationManager.setMaxTime(numericValue);
            this.drawKeyframes();
        }
    }

    formatAndSetEndTime() {
        if(this.animationManager && this.endTimeInput) {
            const maxTime = this.animationManager.getMaxTime();
            let currentValueString = this.endTimeInput.value.trim().replace(/s$/i, '');
            let currentValue = parseFloat(currentValueString);

            if (!isNaN(currentValue) && currentValue >= 0) { // Erlaube auch 0
                this.animationManager.setMaxTime(currentValue);
                this.endTimeInput.value = currentValue.toFixed(1) + 's';
                 // console.log(`[UIManager] End time formatted and set to: ${currentValue.toFixed(1)}s`);
            } else {
                this.endTimeInput.value = maxTime.toFixed(1) + 's';
                // console.warn(`[UIManager] Invalid end time input, reverting to: ${maxTime.toFixed(1)}s`);
            }
            this.drawKeyframes();
        }
    }

    updateTimelineMaxTimeDisplay() {
        if(this.animationManager && this.endTimeInput) {
             try {
                const maxTime = this.animationManager.getMaxTime();
                if (maxTime !== null && typeof maxTime === 'number' && maxTime >= 0) {
                    this.endTimeInput.value = maxTime.toFixed(1) + 's';
                } else {
                     console.warn("[UIManager] Invalid maxTime received from AnimationManager:", maxTime);
                     this.endTimeInput.value = "10.0s";
                     if(this.animationManager && typeof this.animationManager.setMaxTime === 'function') {
                          this.animationManager.setMaxTime(10.0);
                     }
                }
            } catch (e) {
                 console.error("[UIManager] Error getting maxTime from AnimationManager:", e);
                 this.endTimeInput.value = "10.0s";
                 if(this.animationManager && typeof this.animationManager.setMaxTime === 'function') {
                      this.animationManager.setMaxTime(10.0);
                 }
            }
        } else if (!this.animationManager) {
             this.endTimeInput.value = "10.0s";
        }
    }

    updateTimelineIndicator(time = 0) {
        if (!this.timeIndicator || !this.timeIndicatorLabel) return;
        if (!this.animationManager || typeof this.animationManager.getMaxTime !== 'function') {
            if (!this.loggedAnimManagerMissing) {
                // console.warn("[UIManager] AnimationManager not ready for timeline update.");
                this.loggedAnimManagerMissing = true;
            }
            return;
        }
        this.loggedAnimManagerMissing = false;

        try {
            const maxTime = this.animationManager.getMaxTime();
            if (maxTime === null || typeof maxTime !== 'number' || maxTime < 0) {
                 // console.warn("[UIManager] Invalid maxTime for indicator update:", maxTime);
                 return;
            }
            const percentage = maxTime > 0 ? time / maxTime : 0;
            const clampedPercentage = Math.max(0, Math.min(1, percentage));
            this.timeIndicator.style.left = `${clampedPercentage * 100}%`;
            this.timeIndicatorLabel.textContent = time.toFixed(2) + 's';
        } catch (e) {
             console.error("[UIManager] Error updating timeline indicator:", e);
        }
    }

    drawKeyframes() {
        if(!this.timelineTrackContainer || !this.animationManager || !this.selectionManager) return;
        this.timelineTrackContainer.innerHTML = ''; // Leere alte Marker
        const selectedObj = this.selectionManager.getSelectedObject();
        if (!selectedObj) return;
        const objKeyframes = this.animationManager.getKeyframesForObject(selectedObj);
        if (!objKeyframes) return;
        const trackWidth = this.timelineTrackContainer.clientWidth;
        if (trackWidth <= 0) return;

        const times = new Set();
        ['position', 'quaternion', 'scale'].forEach(type => {
            if (objKeyframes[type]) { objKeyframes[type].forEach(frame => times.add(frame.time)); }
        });

        const maxTime = this.animationManager.getMaxTime();
        if (maxTime === null || typeof maxTime !== 'number' || maxTime < 0) return; // Prüfe maxTime

        times.forEach(time => {
            const percentage = maxTime > 0 ? time / maxTime : 0;
            if (percentage >= 0 && percentage <= 1) {
                const marker = document.createElement('div');
                marker.classList.add('keyframe-marker');
                marker.style.left = `calc(${percentage * 100}% - 1px)`;
                marker.dataset.time = time.toFixed(4);
                let typesAtTime = [];
                const timeTolerance = 1e-4;
                if (objKeyframes.position?.some(f => Math.abs(f.time - time) < timeTolerance)) typesAtTime.push('position');
                if (objKeyframes.quaternion?.some(f => Math.abs(f.time - time) < timeTolerance)) typesAtTime.push('quaternion');
                if (objKeyframes.scale?.some(f => Math.abs(f.time - time) < timeTolerance)) typesAtTime.push('scale');
                marker.dataset.types = typesAtTime.join(',');
                marker.title = `Keyframe(s) @ ${time.toFixed(2)}s\nTypes: ${typesAtTime.join(', ')}`;
                if (typesAtTime.length === 1) { marker.classList.add(`type-${typesAtTime[0]}`); }
                else if (typesAtTime.length > 1) { marker.classList.add('type-mixed'); }
                // TODO: Event listener für Drag & Drop / Löschen hinzufügen
                this.timelineTrackContainer.appendChild(marker);
            }
        });
    }

    updateObjectList(scene) {
        // console.log("[UIManager] Updating object list..."); // Kann zur Fehlersuche nützlich sein
        if (!this.loadedObjectsList) { console.error("[UIManager] Cannot update object list: loadedObjectsList element is missing!"); return; }
        if (!scene) { console.error("[UIManager] Cannot update object list: Scene object is missing!"); this.loadedObjectsList.innerHTML = '<li>(Fehler: Szene nicht verfügbar)</li>'; return; }

        this.loadedObjectsList.innerHTML = ''; // Leeren
        const objectsToShow = [];

        // Objekte aus der Hauptszene sammeln
        scene.traverse((child) => {
            // Nur direkte Kinder der Szene berücksichtigen, die darstellbar und keine Hilfsobjekte sind
            if (child.parent === scene &&
                (child.isGroup || child.isMesh || child.isObject3D) && // Gruppen, Meshes oder generische Objekte
                !(child instanceof THREE.Light || child instanceof THREE.Camera || child instanceof THREE.AxesHelper || child instanceof THREE.GridHelper ||
                  child === this.appManager?.getCameraPivot() || // Kamera-Pivot ausschließen
                  child === this.controlsManager?.getTransformControls() || // Gizmo ausschließen
                  child.name === 'Floor')) // Boden ausschließen
             {
                 // Nur Objekte mit gültiger Transformation anzeigen
                 if (!hasInvalidTransform(child)) {
                     objectsToShow.push(child);
                 }
             }
        });

        // Objekte aus der CSS-Szene hinzufügen (HTML-Elemente)
        if (this.html3DManager && this.html3DManager.getCSSScene()) {
             this.html3DManager.getCSSScene().children.forEach(cssObj => {
                  // Direkte Kinder der CSS-Szene, die CSS3DObjects sind
                  if(cssObj.isCSS3DObject && cssObj.parent === this.html3DManager.getCSSScene()) {
                       // Prüfen, ob das korrespondierende WebGL-Objekt (falls vorhanden) gültig ist
                       // Oder einfach hinzufügen, wenn es ein reines HTML-Objekt ist
                       // Annahme: CSS3DObjects haben keine ungültigen Transformationen in diesem Kontext
                       objectsToShow.push(cssObj);
                  }
             });
        }

        // Liste füllen oder Nachricht anzeigen
        if(objectsToShow.length === 0) {
             this.loadedObjectsList.innerHTML = '<li>(Keine Modelle geladen)</li>';
             // Trotzdem Highlight-Funktion aufrufen, um evtl. alte Highlights zu löschen
             this.updateSelectionHighlight(this.selectionManager?.getSelectedObjects() || []); // KORREKTUR hier
             return;
        }

        objectsToShow.forEach(obj => {
            const li = document.createElement('li');
            li.dataset.uuid = obj.uuid; // UUID für spätere Referenzierung

            // Anzeigename bestimmen
            const displayName = obj.name || (obj.isCSS3DObject ? 'HTML Element' : `Objekt (${obj.uuid.substring(0, 6)})`);
            li.textContent = displayName;
            li.title = displayName; // Tooltip

            // Klick-Handler für Auswahl
            li.onclick = (e) => {
                e.stopPropagation();
                if (this.selectionManager) {
                     // updateSelection erwartet das Zielobjekt und ob Modifier gedrückt sind
                     // Hier simulieren wir einen Klick ohne Modifier
                     this.selectionManager.updateSelection(obj, e.shiftKey || e.ctrlKey || e.metaKey);
                } else {
                    console.error("[UIManager] SelectionManager not available for list click!");
                }
            };

            // Icon hinzufügen
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-icons-outlined';
            iconSpan.style.fontSize = '16px';
            iconSpan.style.marginRight = '5px';
            iconSpan.style.verticalAlign = 'middle';

            if (obj.isCSS3DObject) { iconSpan.textContent = 'web'; iconSpan.title = 'HTML Element'; }
            else if (obj.isGroup) { iconSpan.textContent = 'folder_open'; iconSpan.title = 'Gruppe'; }
            else if (obj.isMesh) { iconSpan.textContent = 'view_in_ar'; iconSpan.title = 'Mesh/Geometrie'; }
            else { iconSpan.textContent = 'radio_button_unchecked'; iconSpan.title = 'Anderes Objekt'; }

            li.prepend(iconSpan); // Icon vor dem Text einfügen
            this.loadedObjectsList.appendChild(li); // Listenelement hinzufügen
        });

        // Auswahl-Highlight in der Liste aktualisieren, nachdem sie neu aufgebaut wurde
        // *** HIER WAR DER FEHLER - getSelectedObjects() verwenden ***
        this.updateSelectionHighlight(this.selectionManager?.getSelectedObjects() || []); // Übergibt das Array

        // console.log(`[UIManager] Object list updated with ${objectsToShow.length} items.`); // Optionales Log
    }
     updateSelectionHighlight(selectedObjects = []) { // Akzeptiert jetzt ein Array
        if (!this.loadedObjectsList) return;

        // 1. Alle bisherigen Highlights entfernen
        this.loadedObjectsList.querySelectorAll('li.selected').forEach(li => li.classList.remove('selected'));

        // 2. Highlights für alle aktuell ausgewählten Objekte setzen
        if (selectedObjects && selectedObjects.length > 0) {
            const mainScene = this.appManager?.getScene();
            const cssScene = this.html3DManager?.getCSSScene();

            selectedObjects.forEach(selectedObject => {
                if (!selectedObject) return; // Überspringe null/undefined Einträge

                // Finde das Top-Level-Objekt in der Liste (wie zuvor)
                let listObject = selectedObject;
                // Prüfe gegen beide Szenen, falls HTML-Objekte ausgewählt werden können
                while (listObject.parent &&
                       (mainScene ? listObject.parent !== mainScene : true) &&
                       (cssScene ? listObject.parent !== cssScene : true))
                {
                    // Stoppe, wenn Parent null ist oder eine der Szenen erreicht wurde
                    if (!listObject.parent || listObject.parent === mainScene || listObject.parent === cssScene) break;
                    listObject = listObject.parent;
                }

                // Finde das Listenelement und füge die Klasse hinzu
                const targetLi = this.loadedObjectsList.querySelector(`li[data-uuid="${listObject.uuid}"]`);
                if (targetLi) {
                    targetLi.classList.add('selected');
                }
            });
        }
    }
}
export default UIManager;