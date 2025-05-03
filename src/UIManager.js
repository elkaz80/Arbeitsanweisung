// src/UIManager.js (KORRIGIERT v2)

import * as THREE from 'three'; // Import für createTreeNode etc.
import GUI from 'lil-gui';
import { hasInvalidTransform } from './utils';

// HTML Templates hier definieren (oder aus separater Datei importieren)
const HTML_TEMPLATES = [ { id: 'template-text', name: 'Einfacher Text', html: `<div class="html-content text-content"><p contenteditable="true">Dies ist ein einfacher bearbeitbarer Textblock.</p></div>`, defaultWidth: 300, defaultHeight: 100 }, /* ... mehr ... */ ];

class UIManager {
    constructor() { // html3DManager wird über setManagers gesetzt
        // DOM Refs holen
        this.loadedObjectsList = document.getElementById('loaded-objects-list');
        this.uploadButton = document.getElementById('uploadButton'); // Wird evtl. im Menü erstellt
        this.fileInput = document.getElementById('fileInput');
        this.translateBtn = document.getElementById('transform-translate-btn');
        this.rotateBtn = document.getElementById('transform-rotate-btn');
        this.scaleBtn = document.getElementById('transform-scale-btn');
        this.transformButtons = [this.translateBtn, this.rotateBtn, this.scaleBtn];
        this.fileSubmenu = document.getElementById('file-submenu');
        this.htmlSubmenu = document.getElementById('html-submenu');
        this.toolsSubmenu = document.getElementById('tools-submenu');
        this.timelineTrackContainer = document.getElementById('keyframe-track-container');
        this.timeIndicator = document.getElementById('time-indicator');
        this.timeIndicatorLabel = document.getElementById('time-indicator-label');
        this.playPauseButton = document.getElementById('playPauseBtn');
        this.stepForwardBtn = document.getElementById('stepForwardBtn');
        this.stepBackwardBtn = document.getElementById('stepBackwardBtn');
        this.endTimeInput = document.getElementById('timeline-range-end-input');


        this.selectionManager = null; this.loaderService = null; this.controlsManager = null;
        this.html3DManager = null; // Wird gesetzt
        this.animationManager = null;
        this.gui = null;
        this.appManager = null;
        this.loggedAnimManagerMissing = false; // Für Fehlermeldung
    }

    // Manager-Referenzen setzen
    setManagers(appManager, selectionManager, loaderService, controlsManager, animationManager, html3DManager) {
        this.appManager = appManager;
        this.selectionManager = selectionManager;
        this.loaderService = loaderService;
        this.controlsManager = controlsManager;
        this.animationManager = animationManager;
        this.html3DManager = html3DManager; // HTML3DManager auch hier setzen
    }

    init() {
        console.log("[UIManager] Initializing...");
        // Prüfe nur auf absolut kritische Elemente, die für die Grundfunktion gebraucht werden
        if (!this.loadedObjectsList || !this.fileInput || !this.translateBtn || !this.playPauseButton || !this.endTimeInput) {
             console.warn("[UIManager] Warning: Some UI DOM elements might be missing or not found yet!");
             // Nicht abbrechen, aber im Hinterkopf behalten
        }

        this.gui = new GUI(); this.gui.add({ version: 'Refactor v10' }, 'version').name('Info');

        // --- Event Listeners ---
        // Upload im Menü (falls vorhanden)
        this.fileSubmenu?.querySelector('#uploadButton-in-menu')?.addEventListener('click', () => this.fileInput?.click());
        this.fileInput?.addEventListener('change', this.handleFileUpload.bind(this));

        // Transform Buttons
        this.translateBtn?.addEventListener('click', () => this.setTransformMode("translate"));
        this.rotateBtn?.addEventListener('click', () => this.setTransformMode("rotate"));
        this.scaleBtn?.addEventListener('click', () => this.setTransformMode("scale"));

        // Timeline Buttons
        this.playPauseButton?.addEventListener('click', () => {
            if(this.animationManager) {
                const isPlaying = this.animationManager.togglePlayPause();
                this.playPauseButton.querySelector('.material-icons').textContent = isPlaying ? 'pause' : 'play_arrow';
            }
        });
        this.stepForwardBtn?.addEventListener('click', () => this.animationManager?.step(1));
        this.stepBackwardBtn?.addEventListener('click', () => this.animationManager?.step(-1));
        this.endTimeInput?.addEventListener('input', () => this.handleEndTimeInput());
        this.endTimeInput?.addEventListener('blur', () => this.formatAndSetEndTime());
        this.endTimeInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { this.formatAndSetEndTime(); e.target.blur();} });

        // Navbar Menü Toggles
        this.setupMenuToggle('file-menu-btn', 'file-submenu');
        this.setupMenuToggle('html-menu-btn', 'html-submenu');
        this.setupMenuToggle('tools-menu-btn', 'tools-submenu');
        document.addEventListener('click', (e) => { if (!e.target.closest('.menu-container')) this.closeAllSubmenus(); });

        // Submenüs füllen
        this.populateFileMenu();
        this.populateHtmlMenu();
        this.populateToolsMenu();

        this.setActiveTransformButton(this.translateBtn);
        this.updateTimelineMaxTimeDisplay();

        console.log("[UIManager] Initialization complete.");
    }

    // --- Methoden zum Füllen der Submenüs ---
    populateFileMenu() { if (!this.fileSubmenu) return; this.fileSubmenu.innerHTML = ` <button id="uploadButton-in-menu"><span class="material-icons">file_upload</span>Modell laden...</button> <hr> <button id="export-btn-in-menu"><span class="material-icons">save</span>Exportieren...</button> `; this.fileSubmenu.querySelector('#uploadButton-in-menu').onclick = () => { this.fileInput?.click(); this.closeAllSubmenus();}; /* Export */ }
    populateHtmlMenu() { if (!this.htmlSubmenu) return; this.htmlSubmenu.innerHTML = ''; HTML_TEMPLATES.forEach(t => { this.htmlSubmenu.innerHTML += `<button class="add-html-btn" data-template="${t.id}"><span class="material-icons">article</span>${t.name}</button>`; }); this.htmlSubmenu.querySelectorAll('.add-html-btn').forEach(b => { b.addEventListener('click', () => { const id = b.dataset.template; console.log(`Add HTML: ${id}`); this.html3DManager?.addHTMLElement(id); this.closeAllSubmenus(); }); }); }
    populateToolsMenu() { if (!this.toolsSubmenu) return; this.toolsSubmenu.innerHTML = ''; const createCategory = (n) => { const d=document.createElement('div'); d.className='submenu-category'; d.textContent=n; return d; }; const createTool = (id, i, t) => { const b=document.createElement('button'); b.id=id; b.className='submenu-item'; b.innerHTML=`<span class="material-icons-outlined">${i}</span>${t}`; b.onclick=() => { console.log(`Tool: ${t}`); this.closeAllSubmenus(); }; return b; }; this.toolsSubmenu.appendChild(createCategory('Maschine')); this.toolsSubmenu.appendChild(createTool('tool-akkuschrauber', 'hardware', 'Akkuschrauber')); this.toolsSubmenu.appendChild(createTool('tool-bohrmaschine', 'precision_manufacturing', 'Bohrmaschine')); this.toolsSubmenu.appendChild(createTool('tool-stemmhammer', 'construction', 'Stemmhammer')); this.toolsSubmenu.appendChild(createCategory('Montage')); this.toolsSubmenu.appendChild(createTool('tool-schraubenschluessel', 'build_circle', 'Schraubenschlüssel')); this.toolsSubmenu.appendChild(createTool('tool-drehmoment', 'rotate_right', 'Drehmomentschlüssel')); this.toolsSubmenu.appendChild(createTool('tool-hammer', 'hardware', 'Hammer')); this.toolsSubmenu.appendChild(createTool('tool-zange', 'handyman', 'Zange')); this.toolsSubmenu.appendChild(createCategory('Messmittel')); this.toolsSubmenu.appendChild(createTool('tool-messschieber', 'square_foot', 'Messschieber')); this.toolsSubmenu.appendChild(createTool('tool-gliedermaßstab', 'straighten', 'Gliedermaßstab')); this.toolsSubmenu.appendChild(createTool('tool-lineal', 'straighten', 'Lineal')); this.toolsSubmenu.appendChild(createTool('tool-laserdist', 'settings_ethernet', 'Laser-Distanzmesser')); this.toolsSubmenu.appendChild(createTool('tool-schichtdicke', 'layers', 'Schichtdickenmesser')); this.toolsSubmenu.appendChild(createCategory('Elektrik')); this.toolsSubmenu.appendChild(createTool('tool-multimeter', 'electrical_services', 'Multimeter')); this.toolsSubmenu.appendChild(createTool('tool-abisolierzange', 'content_cut', 'Abisolierzange')); this.toolsSubmenu.appendChild(createTool('tool-loetkolben', 'whatshot', 'Lötkolben')); this.toolsSubmenu.appendChild(createCategory('Hilfsmittel')); this.toolsSubmenu.appendChild(createTool('tool-leiter', 'ramp_right', 'Leiter/Tritt')); this.toolsSubmenu.appendChild(createTool('tool-lampe', 'lightbulb', 'Arbeitsleuchte')); this.toolsSubmenu.appendChild(createTool('tool-besen', 'cleaning_services', 'Besen/Reinigung')); }

    // --- UI Hilfsfunktionen ---
    setupMenuToggle(buttonId, submenuId) { const btn = document.getElementById(buttonId); const sub = document.getElementById(submenuId); if (btn && sub) { btn.addEventListener('click', (e) => { e.stopPropagation(); const act = sub.classList.contains('active'); this.closeAllSubmenus(); if (!act) sub.classList.add('active'); }); } else console.warn(`[UI] Menu elements missing: ${buttonId}/${submenuId}`); }
    closeAllSubmenus() { document.querySelectorAll('.submenu.active').forEach(m => m.classList.remove('active')); }
    handleFileUpload(event) { const file = event.target.files[0]; if (!file || !this.loaderService) return; this.loaderService.loadFile(file); this.closeAllSubmenus(); }
    setTransformMode(mode) { if (this.controlsManager?.getTransformControls()) { this.controlsManager.getTransformControls().setMode(mode); this.setActiveTransformButton(document.getElementById(`transform-${mode}-btn`)); this.closeAllSubmenus(); } }
    setActiveTransformButton(activeBtn) { this.transformButtons.forEach(btn => btn?.classList.toggle('active', btn === activeBtn)); }

    // --- Timeline UI Updates ---
    handleEndTimeInput() { const v = this.endTimeInput?.value.trim().replace(/s$/i, ''); let n = parseFloat(v); if (!isNaN(n) && n > 0 && this.animationManager) { this.animationManager.setMaxTime(n); this.drawKeyframes(); } } // Keyframes neu zeichnen bei Input
    formatAndSetEndTime() { if(this.animationManager && this.endTimeInput) { const maxTime = this.animationManager.getMaxTime(); let currentValue = parseFloat(this.endTimeInput.value.replace(/s$/i, '')); if (!isNaN(currentValue) && currentValue > 0) { this.animationManager.setMaxTime(currentValue); this.endTimeInput.value = currentValue.toFixed(1) + 's'; } else { this.endTimeInput.value = maxTime.toFixed(1) + 's'; } this.drawKeyframes(); } } // Keyframes neu zeichnen bei Blur/Enter
    updateTimelineMaxTimeDisplay() { if(this.animationManager && this.endTimeInput) { this.endTimeInput.value = this.animationManager.getMaxTime().toFixed(1) + 's'; } }

    updateTimelineIndicator(time = 0) {
        // Robuste Prüfung auf animationManager und Methode
        if (!this.timeIndicator || !this.timeIndicatorLabel || !this.animationManager || typeof this.animationManager.getMaxTime !== 'function') {
             if (!this.loggedAnimManagerMissing) { console.warn("[UIManager] AnimationManager not ready for timeline update."); this.loggedAnimManagerMissing = true; } return;
        }
        this.loggedAnimManagerMissing = false; // Reset flag

        const maxTime = this.animationManager.getMaxTime(); // Sicherer Aufruf
        const percentage = maxTime > 0 ? time / maxTime : 0;
        const clampedPercentage = Math.max(0, Math.min(1, percentage));
        this.timeIndicator.style.left = `${clampedPercentage * 100}%`;
        this.timeIndicatorLabel.textContent = time.toFixed(2) + 's';
    }

    drawKeyframes() {
        if(!this.timelineTrackContainer || !this.animationManager || !this.selectionManager) return;
        // console.log("[UIManager] drawKeyframes called"); // Weniger Logs
         this.timelineTrackContainer.innerHTML = ''; // Alte Marker entfernen

         const selectedObj = this.selectionManager.getSelectedObject();
         if (!selectedObj) return; // Nichts zeichnen, wenn nichts ausgewählt ist

         const objKeyframes = this.animationManager.getKeyframesForObject(selectedObj);
         if (!objKeyframes) return; // Keine Keyframes für dieses Objekt

         const trackWidth = this.timelineTrackContainer.clientWidth;
         if (trackWidth <= 0) return; // Keine Breite zum Zeichnen

         const times = new Set();
         ['position', 'quaternion', 'scale'].forEach(type => { if (objKeyframes[type]) objKeyframes[type].forEach(frame => times.add(frame.time)); });

         const maxTime = this.animationManager.getMaxTime();

         times.forEach(time => {
             const percentage = maxTime > 0 ? time / maxTime : 0;
             if (percentage >= 0 && percentage <= 1) {
                 const marker = document.createElement('div');
                 marker.classList.add('keyframe-marker');
                 marker.style.left = `calc(${percentage * 100}% - 1px)`;
                 marker.dataset.time = time;
                 let typesAtTime = [];
                 if (objKeyframes.position?.some(f => Math.abs(f.time - time) < 1e-3)) typesAtTime.push('position');
                 if (objKeyframes.quaternion?.some(f => Math.abs(f.time - time) < 1e-3)) typesAtTime.push('quaternion');
                 if (objKeyframes.scale?.some(f => Math.abs(f.time - time) < 1e-3)) typesAtTime.push('scale');
                 marker.dataset.types = typesAtTime.join(',');
                 marker.title = `Keyframe(s) @ ${time.toFixed(2)}s\nTypes: ${typesAtTime.join(', ')}`;
                 if (typesAtTime.length === 1) marker.classList.add(`type-${typesAtTime[0]}`);
                 else if (typesAtTime.length > 1) marker.classList.add('type-mixed');
                 // TODO: Event Listener für Dragging / ContextMenu hinzufügen (siehe alter Code)
                 this.timelineTrackContainer.appendChild(marker);
             }
         });
    }

    // --- Objektliste (ersetzt Scene Graph) ---
    updateObjectList(scene) {
        console.log("[UIManager] Updating object list...");
        if (!this.loadedObjectsList || !scene) return;
        this.loadedObjectsList.innerHTML = '';
        const objectsToShow = [];
        scene.traverse((child) => {
            if (child.parent === scene && (child.isGroup || child.isMesh) &&
                !(child instanceof THREE.Light || child instanceof THREE.Camera || child instanceof THREE.AxesHelper || child instanceof THREE.GridHelper ||
                  child === this.appManager?.getCameraPivot() || child === this.controlsManager?.getTransformControls() || child.name === 'Floor' || child.name === 'TestCube' ))
             { objectsToShow.push(child); }
        });
        if(objectsToShow.length === 0) { this.loadedObjectsList.innerHTML = '<li>(Keine Modelle)</li>'; return; }
        objectsToShow.forEach(obj => {
            const li = document.createElement('li'); li.dataset.uuid = obj.uuid;
            li.textContent = obj.name || `Objekt (${obj.uuid.substring(0, 6)})`; li.title = li.textContent;
            li.onclick = (e) => { e.stopPropagation(); console.log(`[UI List Click] Select: ${obj.name || obj.uuid}`); this.selectionManager?.select(obj); };
            // Icon (optional)
            const iconSpan = document.createElement('span'); iconSpan.className = 'material-icons-outlined'; iconSpan.textContent = obj.isGroup ? 'folder_open' : 'view_in_ar'; iconSpan.style.fontSize = '16px'; iconSpan.style.marginRight = '5px'; iconSpan.style.verticalAlign = 'middle'; li.prepend(iconSpan);
            this.loadedObjectsList.appendChild(li);
        });
        this.updateSelectionHighlight(this.selectionManager?.getSelectedObject());
        console.log("[UIManager] Object list updated.");
    }

    updateSelectionHighlight(selectedObject) {
        this.loadedObjectsList?.querySelectorAll('li.selected').forEach(li => li.classList.remove('selected'));
        if (selectedObject && this.loadedObjectsList && this.appManager) {
            let targetObject = selectedObject;
            while(targetObject.parent && targetObject.parent !== this.appManager.getScene()) { targetObject = targetObject.parent; }
            const targetLi = this.loadedObjectsList.querySelector(`li[data-uuid="${targetObject.uuid}"]`);
            if (targetLi) targetLi.classList.add('selected');
        }
    }
}
export default UIManager;