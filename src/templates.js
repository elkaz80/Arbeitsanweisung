// templates.js

const HTML_TEMPLATES = [
    // --- Deine bisherigen Templates ---
    {
        id: 'template-text',
        name: "Einfacher Text",
        // icon: ' T ', // Alt
        icon: '<span class="material-icons">article</span>', // Neu
        content: `<p>Hier Text einfügen...</p>`,
        defaultSize: { width: 150, height: 'auto' }
    },
    {
        id: 'template-heading-text',
        name: "Überschrift + Text",
        // icon: 'H+', // Alt
        icon: '<span class="material-icons">title</span>', // Neu
        content: `<h3>Überschrift</h3><p>Zusätzlicher Beschreibungstext hier.</p>`,
        defaultSize: { width: 220, height: 'auto' }
    },
    {
        id: 'template-notice',
        name: "Hinweisbox",
        // icon: '💡', // Alt
        icon: '<span class="material-icons" style="color: orange;">lightbulb</span>', // Neu (mit Farbe)
        content: `<div style='border-left: 4px solid orange; padding: 8px 12px; background: rgba(255, 230, 180, 0.8); color: #333;'>
                    <strong>Hinweis:</strong><p style='margin: 4px 0 0 0;'>Wichtige Information.</p>
                  </div>`,
        defaultSize: { width: 250, height: 'auto' }
    },
    // --- NEUE TEMPLATES ---
    {
        id: 'template-warning',
        name: "Warnhinweis",
        // icon: '⚠️', // Alt
        icon: '<span class="material-icons" style="color: red;">warning</span>', // Neu (mit Farbe)
        content: `<div style='border-left: 4px solid red; padding: 8px 12px; background: rgba(255, 200, 200, 0.8); color: #333;'>
                    <strong>WARNUNG:</strong><p style='margin: 4px 0 0 0;'>Wichtige Sicherheitsinformation oder kritischer Punkt.</p>
                  </div>`,
        defaultSize: { width: 250, height: 'auto' }
    },
    {
        id: 'template-image-url',
        name: "Bild (via URL)",
        // icon: '🖼️', // Alt
        icon: '<span class="material-icons">image</span>', // Neu
        content: `<div style='text-align: center;'>
                     <img data-src="images/placeholder.png" alt="Bild Platzhalter" style="max-width: 100%; height: auto; display: block; margin-bottom: 5px; border: 1px solid #ccc; min-height: 50px; background-color: #eee;">
                     <p style='font-size: 12px; color: #555; margin:0;'>Bildunterschrift (optional)</p>
                     <p style='font-size: 10px; color: #777; margin-top: 3px;'>Hinweis: Bild-URL im 'data-src'-Attribut des img-Tags ändern.</p>
                  </div>`,
        defaultSize: { width: 180, height: 'auto' }
    },
    {
        id: 'template-video-embed',
        name: "Video (Embed)",
        // icon: '▶️', // Alt
        icon: '<span class="material-icons">smart_display</span>', // Neu
        content: `<div style='position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background-color: #333;' title='Video Container'>
                    <iframe
                      style='position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 1px solid #ccc;'
                      data-src="https://www.youtube.com/embed/VIDEO_ID_HIER_EINSETZEN"
                      title="Video player"
                      frameborder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowfullscreen>
                    </iframe>
                  </div>
                  <p style='font-size: 10px; color: #777; margin-top: 3px;'>Hinweis: Video-URL im 'data-src'-Attribut des iframe-Tags ändern.</p>`,
        defaultSize: { width: 300, height: 'auto' }
    },
    {
        id: 'template-ordered-list',
        name: "Nummerierte Liste",
        // icon: '1.', // Alt
        icon: '<span class="material-icons">format_list_numbered</span>', // Neu
        content: `<h4>Anleitungsschritte</h4>
                  <ol style="margin-top: 5px; padding-left: 25px;">
                    <li>Erster Schritt...</li>
                    <li>Zweiter Schritt...</li>
                    <li>Dritter Schritt...</li>
                  </ol>`,
        defaultSize: { width: 230, height: 'auto' }
    },
    {
        id: 'template-unordered-list',
        name: "Aufzählung",
        // icon: '•', // Alt
        icon: '<span class="material-icons">format_list_bulleted</span>', // Neu
        content: `<h4>Wichtige Punkte</h4>
                  <ul style="margin-top: 5px; padding-left: 25px;">
                    <li>Punkt A</li>
                    <li>Punkt B</li>
                    <li>Punkt C</li>
                  </ul>`,
        defaultSize: { width: 200, height: 'auto' }
    },
    {
        id: 'template-link',
        name: "Link / Verweis",
        // icon: '🔗', // Alt
        icon: '<span class="material-icons">link</span>', // Neu
        content: `<a href="https://example.com" target="_blank" title="Link Ziel: https://example.com">Link-Text hier ändern</a>
                  <p style='font-size: 10px; color: #777; margin-top: 3px;'>Hinweis: Link-Ziel (href) und Text ändern.</p>`,
        defaultSize: { width: 'auto', height: 'auto' }
    },
    {
        id: 'template-map-embed',
        name: "Karte (Embed)",
        // icon: '🗺️', // Alt
        icon: '<span class="material-icons">map</span>', // Neu
        content: `<div style='position: relative; padding-bottom: 75%; height: 0; overflow: hidden; max-width: 100%; background-color: #eee;' title='Karten Container'>
                    <iframe
                      style='position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 1px solid #ccc;'
                      data-src="https://www.openstreetmap.org/export/embed.html?bbox=..."
                      title="Karte"
                      frameborder="0"
                      allowfullscreen>
                    </iframe>
                  </div>
                   <p style='font-size: 10px; color: #777; margin-top: 3px;'>Hinweis: Karten-URL im 'data-src'-Attribut des iframe-Tags ändern.</p>`,
        defaultSize: { width: 250, height: 'auto' }
    },
    {
        id: 'template-checklist',
        name: "Checkliste",
        // icon: '✓', // Alt
        icon: '<span class="material-icons">checklist</span>', // Neu
        content: `<h4>Checkliste</h4>
                  <ul style="list-style: none; padding-left: 5px; margin-top: 5px;">
                    <li style="margin-bottom: 4px;"><input type="checkbox" id="check1" style="margin-right: 5px;"><label for="check1">Aufgabe 1</label></li>
                    <li style="margin-bottom: 4px;"><input type="checkbox" id="check2" style="margin-right: 5px;"><label for="check2">Aufgabe 2</label></li>
                  </ul>`,
        defaultSize: { width: 200, height: 'auto' }
    },
];

// Optional: Mache es global verfügbar, wenn keine Module verwendet werden
window.HTML_TEMPLATES = HTML_TEMPLATES;
