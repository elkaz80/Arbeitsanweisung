// src/Managers/ConnectorManager.js

import * as THREE from 'three';
// Importiere die notwendigen Module für 'fat lines'
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

class ConnectorManager {
    /**
     * Verwaltet Linien (Connectors), die 3D-Objekte und CSS3D-Objekte verbinden.
     * @param {THREE.Scene} scene - Die Haupt-WebGL-Szene, zu der die Linien hinzugefügt werden.
     * @param {THREE.Camera} camera - Die Hauptkamera (optional, für spätere Berechnungen).
     * @param {{width: number, height: number}} rendererSize - Ein Objekt mit der Breite und Höhe des Renderers.
     */
    constructor(scene, camera, rendererSize) {
        if (!scene || !camera || !rendererSize || !rendererSize.width || !rendererSize.height) {
            throw new Error("ConnectorManager requires scene, camera, and a valid rendererSize object ({width, height})!");
        }
        this.scene = scene;
        this.camera = camera;
        this.rendererSize = { width: rendererSize.width, height: rendererSize.height }; // Kopie erstellen

        // Speicher für alle aktiven Connectoren
        // Struktur: { id: string, objA: THREE.Object3D, objB: THREE.Object3D, lineMesh: Line2, lineMaterial: LineMaterial, lineGeometry: LineGeometry }
        this.connectors = [];
        this.defaultLineMaterial = null; // Wird in init erstellt

        // Wiederverwendbare Hilfsobjekte
        this.tempVecA = new THREE.Vector3();
        this.tempVecB = new THREE.Vector3();

        // Hinweis: init() wird normalerweise von main.js nach der Instanziierung aufgerufen
    }

    /**
     * Initialisiert den Manager, erstellt z.B. das Standardmaterial.
     */
    init() {
        // Standardmaterial für neue Linien
        this.defaultLineMaterial = new LineMaterial({
            color: 0x00ff00, // Helles Grün als Standard
            linewidth: 3,    // Liniendicke in Pixeln
            vertexColors: false,
            dashed: false,
            alphaToCoverage: true, // Verbessert Kantenglättung
            worldUnits: false // Liniendicke in Screen-Space-Pixeln (true für World-Units)
        });
        // Wichtig: Die Auflösung des Renderers für korrekte Liniendicke setzen
        this.updateResolution(this.rendererSize.width, this.rendererSize.height);

        console.log("[ConnectorManager] Initialized.");
    }

    /**
     * Aktualisiert die Auflösung für alle Linienmaterialien.
     * Muss vom AppManager bei 'resize' aufgerufen werden!
     * @param {number} width - Neue Breite des Renderers.
     * @param {number} height - Neue Höhe des Renderers.
     */
    updateResolution(width, height) {
        this.rendererSize.width = width;
        this.rendererSize.height = height;
        // Aktualisiere Standardmaterial und alle existierenden Linien
        if (this.defaultLineMaterial) {
            this.defaultLineMaterial.resolution.set(width, height);
        }
        this.connectors.forEach(conn => {
            if (conn.lineMaterial) {
                 conn.lineMaterial.resolution.set(width, height);
            }
        });
        // console.log(`[ConnectorManager] Updated line material resolution to ${width}x${height}`);
    }

    /**
     * Fügt eine neue Verbindungslinie zwischen einem 3D-Objekt und einem CSS3D-Objekt hinzu.
     * @param {THREE.Object3D} object3D - Das 3D-Startobjekt.
     * @param {THREE.Object3D} css3DObject - Das CSS3D-Zielobjekt (ist auch ein THREE.Object3D).
     * @param {object} [options={}] - Optionale Einstellungen { color: hex, linewidth: number }.
     * @returns {string|null} Die ID des neuen Connectors oder null bei Fehler.
     */
    addConnector(object3D, css3DObject, options = {}) {
        // Grundlegende Prüfungen
        if (!object3D || typeof object3D.getWorldPosition !== 'function') {
            console.error("[ConnectorManager] Invalid object3D provided for connector.");
            return null;
        }
        if (!css3DObject || typeof css3DObject.getWorldPosition !== 'function') {
            console.error("[ConnectorManager] Invalid css3DObject provided for connector.");
            return null;
        }

        const id = THREE.MathUtils.generateUUID(); // Eindeutige ID für den Connector

        // Material für DIESE Linie erstellen (Klon vom Default oder spezifisch)
        const lineMaterial = this.defaultLineMaterial.clone();
        lineMaterial.color.setHex(options.color ?? this.defaultLineMaterial.color.getHex());
        lineMaterial.linewidth = options.linewidth ?? this.defaultLineMaterial.linewidth;
        // Auflösung nicht vergessen!
        lineMaterial.resolution.copy(this.defaultLineMaterial.resolution);

        // Leere Geometrie - die Punkte werden im Update gesetzt
        const lineGeometry = new LineGeometry();

        // Das Line2-Objekt (das sichtbare Mesh)
        const lineMesh = new Line2(lineGeometry, lineMaterial);
        lineMesh.name = `Connector_${object3D.name || 'Obj'}_${css3DObject.name || 'HTML'}_${id.substring(0,4)}`;
        lineMesh.computeLineDistances(); // Notwendig für das Material
        lineMesh.renderOrder = 900; // Optional: Render-Reihenfolge anpassen

        // Linie zur Haupt-WebGL-Szene hinzufügen
        this.scene.add(lineMesh);

        // Connector-Daten speichern
        const connectorData = {
            id: id,
            objA: object3D,      // Startobjekt (WebGL)
            objB: css3DObject,   // Endobjekt (CSS3D)
            lineMesh: lineMesh,
            lineMaterial: lineMaterial, // Material speichern für spätere Anpassung (lil-gui)
            lineGeometry: lineGeometry
        };
        this.connectors.push(connectorData);

        console.log(`[ConnectorManager] Added connector ${id} between '${object3D.name || object3D.uuid}' and '${css3DObject.name || css3DObject.uuid}'`);

        // Linie initial positionieren
        this.updateConnectorLine(connectorData);

        return id; // Gib ID zurück
    }

    /**
     * Aktualisiert die Punkte (Vertices) einer einzelnen Verbindungslinie.
     * @param {object} connectorData - Das interne Datenobjekt des Connectors.
     */
    updateConnectorLine(connectorData) {
        if (!connectorData || !connectorData.objA || !connectorData.objB || !connectorData.lineGeometry) {
            console.warn("[ConnectorManager] Invalid connectorData for update.");
            return;
        }

        try {
            // Aktuelle Weltpositionen der verbundenen Objekte holen
            connectorData.objA.getWorldPosition(this.tempVecA);
            connectorData.objB.getWorldPosition(this.tempVecB);

            // Array der Positionen für LineGeometry erstellen [x1, y1, z1, x2, y2, z2]
            const positions = [
                this.tempVecA.x, this.tempVecA.y, this.tempVecA.z,
                this.tempVecB.x, this.tempVecB.y, this.tempVecB.z
            ];

            // Positionen in der Geometrie setzen
            connectorData.lineGeometry.setPositions(positions);
            // Wichtig für das Rendering des LineMaterials
            connectorData.lineMesh.computeLineDistances();
            // Optional: Bounding Sphere neu berechnen, falls nötig
            // connectorData.lineMesh.geometry.computeBoundingSphere();

        } catch (error) {
            console.error(`[ConnectorManager] Error updating line for connector ${connectorData.id}:`, error);
            // TODO: Fehlerhaften Connector ggf. entfernen?
            // this.removeConnector(connectorData.id);
        }
    }

    /**
     * Update-Methode, wird vom AppManager in jedem Frame aufgerufen.
     */
    update() {
        // Aktualisiere die Position aller Linien
        if (this.connectors.length > 0) {
            this.connectors.forEach(conn => {
                // Nur updaten, wenn beide Objekte noch gültig sind (haben einen Parent)
                if (conn.objA?.parent && conn.objB?.parent) {
                     this.updateConnectorLine(conn);
                }
                // Optional: Entferne Connectoren, deren Objekte nicht mehr gültig sind
                // else { this.removeConnector(conn.id); } // Vorsicht bei Iteration während Löschung! Besser merken und danach löschen.
            });
        }
    }

    /**
     * Entfernt einen Connector anhand seiner ID.
     * @param {string} connectorId - Die ID des zu entfernenden Connectors.
     */
    removeConnector(connectorId) {
         const index = this.connectors.findIndex(conn => conn.id === connectorId);
         if (index > -1) {
             const connector = this.connectors[index];
             // 1. Linie aus der Szene entfernen
             this.scene.remove(connector.lineMesh);
             // 2. Geometrie und Material freigeben (wichtig!)
             connector.lineGeometry.dispose();
             connector.lineMaterial.dispose();
             // 3. Aus dem Verwaltungs-Array entfernen
             this.connectors.splice(index, 1);
             console.log(`[ConnectorManager] Removed connector ${connectorId}`);
         } else {
             console.warn(`[ConnectorManager] Connector with ID ${connectorId} not found for removal.`);
         }
    }

    /**
     * Entfernt alle Connectoren, die mit einem bestimmten Objekt verbunden sind.
     * @param {THREE.Object3D} object - Das 3D- oder CSS3D-Objekt.
     */
    removeConnectorsForObject(object) {
        if (!object) return;
        const connectorsToRemove = this.connectors.filter(conn => conn.objA === object || conn.objB === object);
        connectorsToRemove.forEach(conn => this.removeConnector(conn.id));
        if (connectorsToRemove.length > 0) {
             console.log(`[ConnectorManager] Removed ${connectorsToRemove.length} connectors associated with object ${object.name || object.uuid}`);
        }
    }

    // --- Methoden für lil-gui Interaktion (Beispiele) ---

    /** Gibt alle Connector-Daten zurück. */
    getConnectors() {
        return this.connectors;
    }

    /** Gibt einen Connector anhand seiner ID zurück. */
    getConnectorById(id) {
        return this.connectors.find(conn => conn.id === id);
    }

    /**
     * Aktualisiert die Eigenschaften einer Connector-Linie.
     * @param {string} connectorId - Die ID des Connectors.
     * @param {object} properties - Objekt mit Eigenschaften, z.B. { color: 0xff0000, linewidth: 5 }.
     */
    updateConnectorProperties(connectorId, properties) {
        const connector = this.getConnectorById(connectorId);
        if (connector && connector.lineMaterial) {
            if (properties.color !== undefined) {
                connector.lineMaterial.color.setHex(properties.color);
            }
            if (properties.linewidth !== undefined) {
                // Linewidth muss >= 1 sein und eine Zahl
                const lw = Math.max(1, Number(properties.linewidth) || 1);
                connector.lineMaterial.linewidth = lw;
            }
            // ... weitere Eigenschaften wie dashed, dashScale etc. ...
            // connector.lineMaterial.needsUpdate = true; // Nicht nötig für LineMaterial
            console.log(`[ConnectorManager] Updated properties for connector ${connectorId}`);
        }
    }

} // Ende class ConnectorManager

export default ConnectorManager;