# Projekt: Interaktiver 3D-Arbeitsanweisungs-Editor

## Beschreibung

Dieses Projekt ist ein webbasierter 3D-Editor, der mit **Three.js** und **Vite** entwickelt wird. Das Hauptziel ist die Erstellung, Bearbeitung und der Export von **interaktiven 3D-Arbeitsanweisungen**. Diese Anweisungen sollen später insbesondere mittels **Augmented Reality (AR)** visualisiert werden können, wobei virtuelle Informationen über realen, erkannten Objekten angezeigt werden sollen.

Die Anwendung befindet sich derzeit in der Entwicklung und wird aktiv refaktorisiert, um eine sauberere, modulare Codebasis zu schaffen.

## Kernfunktionen

### Implementiert / In Arbeit:

* **3D-Szenen-Rendering:** Anzeige einer 3D-Umgebung mit Three.js (`WebGLRenderer`).
* **Kamerasteuerung:** Navigation in der 3D-Szene mittels `OrbitControls`.
* **Modell-Laden:** Laden von 3D-Modellen (aktuell GLTF/GLB und OBJ implementiert) in die Szene.
* **Objekt-Manipulation (Teilweise):** Auswahl von 3D-Objekten per Raycasting. Nutzung von `TransformControls` (Gizmo) zum Verschieben, Drehen und Skalieren ist implementiert, aber **aktuell besteht ein Problem mit der visuellen Darstellung des Gizmos**, besonders bei großen Modellen. Die Logik scheint korrekt zu sein, das Rendering jedoch nicht.
* **Grundlegende UI:**
    * Navbar mit Dropdown-Menüs (Datei, HTML, Werkzeuge).
    * Panel zur Anzeige geladener Objekte (ersetzt den vorherigen Scene Graph).
    * Timeline-Panel mit Basis-Steuerungselementen.
* **HTML-Elemente in 3D:** Integration von HTML-Inhalten in die 3D-Szene mittels `CSS3DRenderer`.
* **Animation (Basis):** Unterstützung für Keyframe-Animationen (Position, Rotation, Skalierung) und eine Timeline zur Steuerung der Wiedergabe.
* **Schatten & Boden:** Einfacher Boden mit Schattenwurf für realistischere Darstellung.

### Geplante Features (Roadmap):

* **Augmented Reality (AR):**
    * Visualisierung der erstellten Szenen/Animationen maßstabsgetreu in der realen Welt mittels **WebXR**.
    * Anzeige von virtuellen Informationen (HTML-Overlays?) über **erkannten realen Objekten**.
* **Objekterkennung:**
    * Clientseitige Erkennung realer Objekte (basierend auf den geladenen 3D-Modellen) mittels **TensorFlow.js**.
    * Trigger für AR-Interaktionen (z.B. virtuelles Modell transparent schalten).
* **Virtual Reality (VR):** Unterstützung für die Betrachtung und potenziell Interaktion in VR (WebXR).
* **Export-Funktion:** Export der erstellten Arbeitsanweisung als eigenständige Web-Anwendung (z.B. HTML-Datei mit eingebetteten Daten via IndexedDB).
* **Erweiterte UI:**
    * Vollständige Implementierung des Werkzeug-Menüs.
    * Funktionalität für Einstellungen.
    * Verbesserte Timeline-Navigation für Arbeitsanweisungsschritte.
    * Materialauswahl-Funktion.
    * Keyframe-Übersicht.
* **Connectoren:** Visuelle Verbindungslinien zwischen Objekten (Implementierung pausiert, da sie möglicherweise zu Problemen beigetragen hat).

## Technologie-Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
* **3D-Engine:** Three.js (r160+)
* **Build-Tool & Dev-Server:** Vite
* **UI-Bibliothek:** lil-gui (für Debug-Controls, kann erweitert werden)
* **Geplant:** WebXR API, TensorFlow.js

## Projektstatus

* **In Entwicklung / Refactoring:** Der Code wird gerade in eine modulare Struktur überführt.
* **Bekannte Probleme:**
    * **`TransformControls` (Gizmo) wird nicht zuverlässig visuell gerendert**, obwohl die Logik und der Status in den Logs korrekt erscheinen. Dies ist das **Hauptproblem**, das aktuell untersucht wird.
    * Die "Szene wandert" unter bestimmten Umständen (möglicherweise ein Kamera/Controls-Problem).

## Setup & Ausführung

1.  **Repository klonen** (falls zutreffend):
    ```bash
    git clone <repository-url>
    cd <projekt-ordner>
    ```
2.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```
3.  **Entwicklungsserver starten:**
    ```bash
    npm run dev
    ```
    Die Anwendung ist dann normalerweise unter `http://localhost:5173` (oder einem ähnlichen Port) erreichbar.

4.  **Produktions-Build erstellen:**
    ```bash
    npm run build
    ```
    Erstellt optimierte statische Dateien im `dist`-Ordner, die auf jedem Webserver gehostet werden können.

## Nächste Schritte (Debugging)

* Fokus liegt auf der Behebung des **Gizmo-Rendering-Problems**. Nächste Tests beinhalten ggf. das Deaktivieren des Tiefentests (`depthTest: false`) für den Gizmo oder das Skalieren des geladenen Modells.
* Untersuchung des "Szene wandert"-Problems (wahrscheinlich `OrbitControls.target`).

---

#TODO 
Wichtig (nochmal zur Erinnerung für Draco):

Vite optimiert zwar den Import des DRACOLoader.js-Moduls, aber es weiß nicht automatisch, wo die separaten Draco-Decoder-Dateien (draco_decoder.wasm, draco_decoder.js) liegen. Du musst also immer noch sicherstellen, dass der Pfad, den du in LoaderService.js bei dracoLoader.setDecoderPath('/pfad/zu/draco/libs/'); angibst, korrekt ist und auf die tatsächlichen Decoder-Dateien in deinem Projekt (oft im public-Ordner oder einem ähnlichen statischen Verzeichnis) oder auf einem CDN zeigt.

Ansonsten sieht es gut aus! Vite hat die Änderungen korrekt übernommen. Du solltest jetzt in der Lage sein, die verschiedenen neuen Dateitypen zu testen.

Absolut! Eine klare Struktur und das Verständnis, wie die Teile zusammenarbeiten, sind entscheidend, um den Überblick nicht zu verlieren. Gerade nach einem größeren Umbau wie unserem Refactoring ist eine Zusammenfassung Gold wert.

Lass uns die aktuelle Struktur deiner Anwendung durchgehen, Datei für Datei, und schauen, welche Hauptaufgaben sie haben und wie sie miteinander kommunizieren (wichtige Funktionsaufrufe und Variablenübergaben).

1. src/main.js - Der Startpunkt & Dirigent

Aufgabe: Initialisiert die gesamte Anwendung. Erstellt die Hauptobjekte und Manager und "verdrahtet" sie miteinander (sorgt dafür, dass Manager sich gegenseitig kennen, wenn nötig). Startet den Render-Loop.
Wichtige Schritte / Aufrufe:
Importiert alle benötigten Klassen/Funktionen aus den anderen Dateien (AppManager, SceneSetup, ControlsManager, SelectionManager, UIManager, LoaderService, HTML3DManager, AnimationManager, ConnectorManager).
Holt sich Referenzen auf HTML-Elemente (#scene-container, #three-canvas).
Erstellt den AppManager: const appManager = new AppManager(...).
Initialisiert den AppManager: appManager.init() (erzeugt Renderer, leere Szene, Kamera).
Holt sich Kernreferenzen: const scene = appManager.getScene(), const camera = appManager.getCamera(), etc.
Ruft die Funktionen aus SceneSetup auf, um die Szene zu befüllen: createLights(scene), createFloor(scene), createHelpers(scene). Übergibt optional Referenzen an appManager mit appManager.setInitialSceneObjects(...).
Erstellt Instanzen aller anderen Manager/Services (new ControlsManager(...), new SelectionManager(...), etc.) und übergibt dabei schon erste Abhängigkeiten (wie camera, scene, renderer.domElement).
Initialisiert Manager, die eine init-Methode haben (z.B. controlsManager.init(scene), html3DManager.init(), connectorManager.init(), selectionManager.init()).
Verbindet die Manager: Ruft setManagers oder spezifische Setter auf, damit sich die Manager gegenseitig referenzieren können (z.B. controlsManager.setSelectionManager(selectionManager), appManager.setManagers(...), uiManager.setManagers(...)).
Initialisiert den UIManager: uiManager.init() (dieser erstellt intern die einzelnen UI-Panels wie SettingsPanel, FileMenu etc.).
Setzt den updateCallback für den AppManager: appManager.setUpdateCallback((deltaTime, time) => { ... }). Diese Funktion ruft die update-Methoden von Managern auf, die pro Frame Arbeit leisten müssen (z.B. controlsManager.update(deltaTime), animationManager.update(...), connectorManager.update()).
Startet den Render-Loop: appManager.start().
Fügt globale Listener hinzu (z.B. resize-Listener, der appManager.handleResize() aufruft).
2. src/Core/AppManager.js - Das Herzstück

Aufgabe: Verwaltet die absoluten Kernkomponenten von Three.js (Renderer, Szene, Kamera), den Haupt-Render-Loop (animate) und grundlegende App-Funktionen (Start, Stop, Resize). Bietet Methoden für andere Manager, um auf diese Kernkomponenten zuzugreifen oder sie zu modifizieren.
Wichtige Variablen (Properties): this.renderer, this.scene, this.camera, this.cameraPivot, this.clock, this.updateCallback, Referenzen auf andere Manager (this.uiManager etc.), Referenzen auf Lichter/Boden (this.ambientLight etc.), Loader-Instanzen (this.rgbeLoader).
Wichtige Methoden:
init(): Erstellt Renderer, Szene, Kamera.
setManagers(...): Speichert Referenzen auf andere Manager.
setInitialSceneObjects(...): Speichert Referenzen auf Lichter/Boden.
start(), stop(), animate(): Steuern den Render-Loop.
handleResize(): Passt Renderer und Kamera an. Ruft resize bei anderen Managern auf (HTML3D, Connector).
getScene(), getCamera(), getRenderer(), getCameraPivot(), getFloorObject(), getCameraFov(): Getter für andere Module.
addObjectToScene(), removeObjectFromScene(): Modifizieren die Szene und informieren die UI (uiManager.refreshObjectList()).
setEnvironment(), toggleLight(), setCameraFov(), setFloorMaterial(): Methoden, die von der UI (über SettingsPanel) aufgerufen werden, um Szeneneigenschaften zu ändern.
applyAnimations(): Wird von animate aufgerufen, holt Werte von AnimationManager und wendet sie auf Szene-Objekte an.
3. src/Core/SceneSetup.js - Der Bühnenbauer

Aufgabe: Enthält nur Funktionen zum Erstellen und Hinzufügen der initialen Objekte zur Szene (Lichter, Boden, Helper). Sorgt dafür, dass AppManager.init() schlank bleibt.
Wichtige Variablen: Keine eigenen (nur lokale innerhalb der Funktionen).
Wichtige Methoden (exportiert):
createLights(scene): Erstellt Lichter, fügt sie scene hinzu, gibt Referenzen zurück.
createFloor(scene): Erstellt Boden, fügt ihn scene hinzu, gibt Referenz zurück.
createHelpers(scene): Erstellt Helper, fügt sie scene hinzu.
4. src/Managers/SelectionManager.js - Der Auswahl-Manager

Aufgabe: Verwaltet, welche Objekte ausgewählt sind (selectedObjects). Kümmert sich um Raycasting bei Mausklicks, Hover-Effekte, Highlighting der Auswahl und die Verwaltung des Pivot-Objekts für Multi-Selektionen.
Wichtige Variablen: this.selectedObjects (Array), this.hoveredObject, this.pivotObject, this.originalMaterialStates (Map für Highlight), this.originalMaterialStatesForHover (Map für Hover), Referenzen auf camera, scene, domElement, controlsManager, uiManager, html3DManager.
Wichtige Methoden:
init(): Fügt Maus-Listener (pointerdown, move, up) zum Canvas hinzu.
onPointerDown/Move/Up(): Event-Handler, die Raycasting durchführen, Hover erkennen, Drag erkennen und bei Klick updateSelection auslösen.
updateSelection(): Kernlogik! Ändert this.selectedObjects basierend auf Klick/Modifier. Ruft apply/removeHighlight auf. Ruft updateAttachedControls(). Informiert UI (uiManager.updateSelectionHighlight()).
apply/removeHighlight(): Ändern Materialeigenschaften für Auswahl-Visualisierung.
apply/removeHoverEffect(): Ändern Materialeigenschaften für Hover-Visualisierung.
updateAttachedControls(): Ruft controlsManager.attach() oder controlsManager.detach() auf, um den Gizmo entweder an ein Einzelobjekt oder an den (korrekt positionierten) pivotObject zu hängen.
detachAndCleanupMultiGroup(): Vereinfachte Methode für Pivot, wird von ControlsManager nach Transform-Ende aufgerufen, setzt internen Status zurück.
getSelectedObjects(), getSingleSelectedObject(), getPivotObject(): Getter.
5. src/Managers/ControlsManager.js - Der Steuerungs-Manager

Aufgabe: Verwaltet die OrbitControls (Kamerasteuerung) und die TransformControls (Gizmo). Implementiert die Logik für das Transformieren von Einzel- oder Multi-Selektionen (über den Pivot).
Wichtige Variablen: this.orbitControls, this.transformControls, this.selectionManager (Referenz!), this.isDraggingGizmo (Flag), Pivot-Transformations-Status (isTransformingPivot, pivotTransformStart, selectedObjectsAtPivotStart, objectDataAtPivotStart).
Wichtige Methoden:
init(scene): Erstellt OrbitControls und TransformControls, fügt letztere zur Szene hinzu, hängt Gizmo-Listener an (dragging-changed, mouseDown, mouseUp).
setSelectionManager(): Speichert die Referenz.
attach(object): Hängt den Gizmo (transformControls) an ein Objekt (entweder Einzelobjekt oder Pivot). Setzt fixe Größe für Pivot-Gizmo.
detach(): Löst den Gizmo vom Objekt und aktiviert OrbitControls. Bricht ggf. laufende Pivot-Transformation ab.
onDraggingChanged(): Deaktiviert/Aktiviert OrbitControls während Gizmo-Drag.
onTransformStart(): Wird bei mouseDown auf Gizmo ausgelöst. Wenn Pivot betroffen, speichert Start-Zustand des Pivots und der ausgewählten Objekte.
onTransformEnd(): Wird bei mouseUp nach Gizmo-Drag ausgelöst. Wenn Pivot betroffen, berechnet Pivot-Delta, wendet dieses Delta auf die gespeicherten Initial-Matrizen der Objekte an (Matrix-Magie!), setzt Zustand zurück und ruft selectionManager.detachAndCleanupMultiGroup() auf (obwohl letzteres im Pivot-Ansatz fast leer ist).
setTransformMode(mode): Ändert den Modus des Gizmos (Translate, Rotate, Scale). Wird von der UI (jetzt FileMenu) aufgerufen.
getAttachedObject(): Gibt das aktuell am Gizmo hängende Objekt zurück.
6. src/UI/UIManager.js - Der UI-Dirigent

Aufgabe: Ist der Hauptkoordinator für die UI. Kennt alle anderen Manager und alle spezialisierten UI-Panels. Initialisiert die Panels. Steuert das Öffnen/Schließen der Hauptmenüs. Delegiert UI-Updates an die zuständigen Panels.
Wichtige Variablen: Referenzen auf alle Manager, Referenzen auf alle Panel-Instanzen (this.settingsPanel, this.fileMenu etc.).
Wichtige Methoden:
init(): Findet die Container-Elemente im DOM, erstellt Instanzen aller UI-Panel-Klassen (new SettingsPanel(...) etc.) und übergibt ihnen die nötigen Manager-Referenzen und das Parent-DOM-Element. Fügt Listener für Hauptmenü-Buttons an.
setManagers(): Empfängt und speichert Manager-Referenzen. Übergibt sich selbst an AnimationManager.
attachToggleListener() / closeAllSubmenus(): Verwalten das Anzeigen/Verstecken der Submenüs.
updateSelectionHighlight(): Delegiert an objectGraphPanel.updateSelectionHighlight().
updateTimelineIndicator(): Delegiert an timelinePanel.updateIndicator().
refreshObjectList(): Delegiert an objectGraphPanel.updateObjectList().
7. src/UI/<PanelName>.js (z.B. SettingsPanel.js, FileMenu.js, ToolsPanel.js, HtmlPanel.js, ObjectGraphPanel.js, TimelinePanel.js)

Aufgabe: Jede dieser Klassen ist für genau einen Bereich der UI zuständig (ein Submenü, die Objektliste, die Timeline). Sie erstellen (oder finden) ihre spezifischen HTML-Elemente (Buttons, Slider, Listen...) und fügen die Event Listener hinzu. Bei einer Benutzeraktion rufen sie die entsprechende Methode im zuständigen Manager auf (z.B. SettingsPanel ruft appManager.setFloorMaterial(), FileMenu ruft loaderService.loadFile() oder controlsManager.setTransformMode(), TimelinePanel ruft animationManager.play()).
Wichtige Variablen: Referenzen auf die benötigten Manager, Referenz auf das Haupt-DOM-Element des Panels, Referenzen auf die internen UI-Elemente (Buttons, Slider...).
Wichtige Methoden:
constructor(): Empfängt Manager-Referenzen und das Parent-Element.
init(): Baut die UI innerhalb des Parent-Elements auf (oder findet vorhandene Elemente) und hängt Listener an.
Event-Handler (handleClick, handleChange...): Reagieren auf Benutzerinteraktion und rufen Manager-Methoden auf.
Update-Methoden (updateIndicator, updateObjectList, updateSelectionHighlight...): Werden vom UIManager oder direkt von einem Manager aufgerufen, um die UI zu aktualisieren.
8. Andere (LoaderService, HTML3DManager, AnimationManager, ConnectorManager, SceneSetup, HTMLTemplates, utils)

Haben ihre spezifischen Aufgaben (Laden, CSS3D, Animation, Linien, Setup, Templates, Hilfsfunktionen) und werden von main.js oder anderen Managern nach Bedarf aufgerufen oder mit Daten versorgt.
Ich hoffe, diese detaillierte Aufschlüsselung gibt dir wieder einen besseren Überblick darüber, welche Datei welche Aufgabe hat und wie die Informationen und Befehle zwischen ihnen fließen! Es ist eine gute, modulare Struktur, auch wenn sie auf den ersten Blick komplexer wirkt als ein einzelnes Skript.