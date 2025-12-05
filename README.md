# FitX Auslastung Widget (Scriptable)

Ein schlanker Scriptable-Widget, der die aktuelle und prognostizierte Auslastung eines FitX-Studios anzeigt – inklusive Logo, Status-Chip, Zeitstempel und kleinem Chart.

## Features
- Echtzeit-Auslastung (letzter Wert der aktuellen Tagesreihe)
- Prognoseverlauf (falls auf der FitX-Seite verfügbar)
- Kompakter Chart mit „Jetzt“-Marker und Legende
- Status-Emoji & Label („Wenig besucht“ … „Sehr voll“)
- Automatische Aktualisierung alle 30 Minuten, wenn als Widget eingebunden

## Voraussetzungen
- iOS/iPadOS mit der App **Scriptable** (kostenlos im App Store)
- Internetzugang (das Script ruft die öffentliche Studio-Seite von FitX ab)

## Schnellstart
1) Scriptable öffnen → neues Script anlegen.  
2) Inhalt aus `script.js` dieses Repos hineinkopieren.  
3) Im Script `STUDIO_URL` anpassen, z. B.  
   `https://www.fitx.de/fitnessstudios/karlsruhe-oststadt`  
   (im Browser auf die gewünschte Studio-Seite gehen und die URL übernehmen).  
4) Script speichern.  
5) Auf dem Homescreen ein **Medium Widget** von Scriptable hinzufügen und dieses Script auswählen.  
6) Optional: In Scriptable direkt ausführen (`Run`), um eine Vorschau zu sehen.

## Konfiguration & Anpassungen
- **Studio wechseln:** `STUDIO_URL` auf die Studio-Seite setzen. Die Studio-Bezeichnung wird automatisch aus der URL generiert.  
- **Farben & Layout:** Oben im Script (`FITX_ORANGE`, `FITX_DARK_BG`, `GRID_COLOR`, `CHIP_BG`, Padding) anpassen.  
- **Refresh-Intervall:** Standard sind 30 Minuten (`widget.refreshAfterDate`). Bei Bedarf ändern, um seltener/häufiger zu aktualisieren.  
- **Größe:** Das Layout ist für ein „Medium“-Widget optimiert. Auf iPad wird das Chart etwas breiter dargestellt.

## Wie es funktioniert
- Lädt die HTML-Seite des Studios und extrahiert die Serien aus den Attributen `data-current-day-data` (Echtzeit) und `data-visitordata` (Prognose).  
- Die Prognose greift auf den aktuellen Wochentag in `data-visitordata` zu; wenn keine Prognose vorhanden ist, wird nur die Echtzeitreihe verwendet.  
- Ein Canvas (DrawContext) baut ein minimalistisches Chart mit Grid, Fläche (Prognose) und Linie (Echtzeit, bis „jetzt“).

## Fehlersuche
- **„Keine Daten“ / „Fehler“**: Tritt auf, wenn die FitX-Seite keine Serien liefert oder das Markup geändert wurde. Prüfe die Studio-URL im Browser.  
- **Logo fehlt**: Netzwerkproblem oder Bildquelle nicht erreichbar – es wird dann „FITX“ als Fallback-Text gezeigt.  
- **Keine Aktualisierung**: Stelle sicher, dass das Widget aktiv ist und genügend Hintergrund-Refresh hat; ggf. Intervall anpassen.

## Haftungsausschluss
Keinerlei Verbindung zu FitX; es werden öffentlich zugängliche Seiten abgerufen. Struktur oder Verfügbarkeit der Daten kann sich ändern – bitte anpassen, falls das Markup auf fitx.de aktualisiert wird.

