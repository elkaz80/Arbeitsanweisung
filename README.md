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