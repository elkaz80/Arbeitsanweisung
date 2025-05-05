// src/UI/FileMenu.js

class FileMenu {
    /**
     * Verwaltet Datei-Operationen (Upload) UND Transform-Modus-Buttons.
     * @param {object} loaderService - Instanz des LoaderService.
     * @param {object} controlsManager - Instanz des ControlsManager.
     * @param {HTMLElement} parentElement - Das DOM-Element (Submenü-Div #file-submenu).
     */
    constructor(loaderService, controlsManager, parentElement) {
        if (!loaderService || !controlsManager || !parentElement) {
            throw new Error("FileMenu requires LoaderService, ControlsManager, and parentElement!");
        }
        this.loaderService = loaderService;
        this.controlsManager = controlsManager;
        this.parentElement = parentElement;

        // Referenzen werden in init gesetzt, nachdem Elemente erstellt wurden
        this.uploadButton = null;
        this.fileInput = null;
        this.translateBtn = null;
        this.rotateBtn = null;
        this.scaleBtn = null;
        this.transformButtons = [];

        this.init(); // Erstellt Elemente und hängt Listener an
    }

    /**
     * Erstellt die HTML-Elemente für das Menü und hängt Listener an.
     */
    init() {
        this.parentElement.innerHTML = '<h4>Datei & Transform</h4>'; // Leeren & Titel setzen

        // --- Upload Elemente erstellen ---
        this.uploadButton = document.createElement('button');
        this.uploadButton.id = 'static-upload-button'; // ID bleibt wichtig für CSS etc.
        this.uploadButton.className = 'menu-item-button';
        this.uploadButton.textContent = 'Modell laden';
        this.parentElement.appendChild(this.uploadButton);

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.id = 'file-input';
        this.fileInput.accept = ".glb,.gltf,.obj,.fbx,.stl,.ply,.dae"; // Akzeptierte Typen
        this.fileInput.style.display = 'none'; // Versteckt halten
        this.parentElement.appendChild(this.fileInput); // Zum DOM hinzufügen ist wichtig!

        // --- Trennlinie ---
        this.parentElement.appendChild(document.createElement('hr'));

        // --- Transform Buttons erstellen ---
        const transformContainer = document.createElement('div');
        transformContainer.className = 'transform-controls-buttons';

        this.translateBtn = this.createTransformButton('translate', 'open_with', 'Verschieben (T)');
        this.rotateBtn = this.createTransformButton('rotate', 'rotate_90_degrees_cw', 'Drehen (R)');
        this.scaleBtn = this.createTransformButton('scale', 'aspect_ratio', 'Skalieren (S)');
        this.transformButtons = [this.translateBtn, this.rotateBtn, this.scaleBtn];

        transformContainer.append(this.translateBtn, this.rotateBtn, this.scaleBtn);
        this.parentElement.appendChild(transformContainer);

        // --- Listener anhängen ---
        this.attachUploadListeners();
        this.attachTransformListeners();
        this.updateActiveTransformButton('translate'); // Starte mit Translate aktiv

        console.log("[FileMenu] Initialized and created Upload/Transform controls.");
    }

    /** Hilfsmethode zum Erstellen der Transform-Buttons */
    createTransformButton(mode, iconName, title) {
        const button = document.createElement('button');
        button.id = `${mode}-btn`;
        button.className = 'menu-icon-button';
        button.title = title;
        button.innerHTML = `<span class="material-icons">${iconName}</span>`;
        return button;
    }

    // --- Listener Methoden (wie vorher, aber Elemente sind jetzt this...) ---
    attachUploadListeners() {
        if (this.uploadButton && this.fileInput) {
            this.uploadButton.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (event) => { /* ... wie vorher ... */
                 if (event.target.files && event.target.files.length > 0) {
                     this.loaderService.loadFile(event.target.files[0]);
                     event.target.value = null;
                 }
             });
        } else { console.error("[FileMenu] Upload button/input elements not created correctly."); }
    }

    attachTransformListeners() {
        if (this.transformButtons.some(btn => !btn)) { // Prüft ob alle Buttons erstellt wurden
             console.error("[FileMenu] Transform buttons not created correctly."); return;
        }
        this.transformButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const mode = event.currentTarget.id.replace('-btn', '');
                this.setTransformMode(mode);
            });
        });
    }

    setTransformMode(mode) { // Wie vorher
        if (this.controlsManager?.setTransformMode) {
            this.controlsManager.setTransformMode(mode);
            this.updateActiveTransformButton(mode);
        }
    }

    updateActiveTransformButton(activeMode) { // Wie vorher
        this.transformButtons.forEach(button => {
            if (button) {
                const buttonMode = button.id.replace('-btn', '');
                button.classList.toggle('active', buttonMode === activeMode);
            }
        });
    }

} // Ende class FileMenu

export default FileMenu;