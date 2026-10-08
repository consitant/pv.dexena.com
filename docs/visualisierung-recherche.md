# Visualisierung im PV-Kundenportal – Recherche Marktführer

Stand: Oktober 2026

## Einleitung

Untersucht wurde, wie die großen Hersteller-Portale (SMA, Fronius, SolarEdge, Enphase, Huawei, Kostal) ihren Anlagenbetreibern Daten zeigen. Grundlage sind Produktseiten, Hilfe- und Handbuchseiten sowie Drittartikel (Installateur-Wissensdatenbanken, Vergleichstests). Eigene Screenshots wurden nicht ausgewertet, und es wurden keine fremden Assets übernommen. Beschrieben werden nur **Muster**.

Unser Rahmen: SolarMax-Wechselrichter, ausschließlich **Erzeugungsdaten** (AC-Leistung im 5-Minuten-Raster, Tagesertrag, Gesamtzähler, Gerätetemperatur, PV-String-Werte U/I/P). Es gibt **keinen Verbrauchszähler und keinen Speicher**. Eigenverbrauch lässt sich nur über eine konfigurierte Quote **schätzen**.

Wichtigste Beobachtung: Bei fast allen Anbietern steht das Energiefluss-Diagramm (PV → Haus/Netz/Batterie) im Mittelpunkt. Dieses Diagramm setzt aber einen Verbrauchszähler voraus. Alle Anbieter haben jedoch dieselbe **erzeugungsseitige Grundausstattung**: Zeitraum-Umschalter, Kennzahlen-Kacheln, Perioden- und Jahresvergleich, Soll/Ist bzw. Prognose, Umweltbilanz, Status/Alarme und Portfolio-Liste. Diese Ausstattung können wir vollständig abbilden.

---

## Anbieter im Überblick

### SMA – Sunny Portal powered by ennexOS
- Das Dashboard besteht aus **Widgets**, die sich nach der Anlagenkonfiguration richten: Live-Status, Energiefluss, Gerätestatus, PV-Leistung/Ertrag sowie Sensor-Widgets (Einstrahlung, Temperatur), die sich ein- und ausschalten lassen. Ein eigenes Anlagenbild kann hochgeladen werden. Quelle: https://www.sma-america.com/products/apps-software/sunny-portal
- **Jahresvergleich**: alle Jahre seit Inbetriebnahme in einer Ansicht. Dazu ein **Wechselrichter-Vergleich**, der Geräte außerhalb einer Toleranz hervorhebt, und eine Statusliste mit „spezifischem Ertrag gestern“ (kWh/kWp). Quelle: ebd.
- Ein **konfigurierbarer Erwartungsertrag**, eine Performance-Ratio-Berechnung mit Schwellwert-Alarm und satellitengestützte Wetterdaten zur Bewertung. Quelle: https://manuals.sma.de/Business-Systeme-PL/en-US/15213608971.html
- Die **Portfolio-Navigation** führt über die Ebenen Portfolio → Anlagengruppe → Anlage → Gerät. Dazu kommen ein **anlagenspezifischer CO₂-Faktor** sowie Tages-/Monatsberichte per E-Mail. „Sunny Places“ bietet einen anonymisierten Ertragsvergleich mit Anlagen in der Region. Quellen: https://www.sma-america.com/products/apps-software/sunny-portal, https://www.photovoltaik.info/anlagen-monitoring-app-vergleich/

### Fronius – Solar.web
- Das Dashboard zeigt Ertrag (und Verbrauch) **in Echtzeit oder als Monats-/Saisonwerte**. Ergänzt wird es durch eine **Amortisationsanzeige**, die **kumulierte CO₂-Einsparung** und eine **48-h-Ertragsprognose** auf Basis der Wettervorhersage. Quelle: https://fronius.com/en/solar-energy/about-us/press/intelligent-energy-management-and-servicing-support-300720
- Die App bietet aktuelle Werte, **Tageskurven**, Ertrags- und CO₂-Auswertung sowie einen Dark Mode. Seit Version 1.6.0 (07/2024) gibt es eine **Leistungsprognose direkt im Verlaufs-Chart**. Quelle: https://apkmirror.com/apk/fronius-international-gmbh/solar-web/solar-web-1-6-0-release
- Die **Energiebilanz** lässt sich nach Tag/Monat/Jahr auswerten. Ein **automatischer Ertragsvergleich** ist über Wechselrichter oder Zeiträume möglich, ebenso ein Soll/Ist-Vergleich mit Sensordaten. Die Verbrauchskurven gibt es nur mit Smart Meter. Quellen: https://www.vpsolar.com/en/fronius-solar-web-portal-for-monitoring-photovoltaic-systems-and-more/, https://shop-mx.fronius.com/~/downloads/Solar%20Energy/Datasheets/SE_DS_Fronius_Solar_web_EN.pdf
- **Warnsignal zur CO₂-Kachel**: Nach einem Greenwashing-Check des VKI (2025) hat Fronius angekündigt, die CO₂-Anzeige zu entfernen. Grund: Der Faktor beruhte auf einem veralteten Vergleich (Gaskraftwerk, Stand 2010). Quelle: https://konsument.at/system/files/2025-10/Beantwortung%20VKI%20Greenwashing%20Check%20Fronius%20App%20Solarweb.pdf

### SolarEdge – Monitoring-Portal / mySolarEdge
- Das Dashboard enthält ein **Energiefluss-Diagramm**, dessen Farbe den Zustand codiert (grün = Haus läuft auf PV, orange = Netzbezug). Daneben stehen **Summen für Monat / Jahr / Lebensdauer**. Quelle: https://knowledge-base.solarhub.net.au/understanding-the-app-mysolaredge
- Zeiträume Tag/Woche/Monat/Jahr, auch passend zur **Abrechnungsperiode**. Produktion und Verbrauch können getrennt oder überlagert dargestellt werden, dazu kommt ein „**Comparative Production Breakdown**“. Quelle: ebd.
- „**Comparative Energy**“ ist ein Balkendiagramm mit den Tabs Monat/Quartal/Jahr. Auf der Monatsachse Jan–Dez werden die Jahre nebeneinander gestellt. Ergänzt wird es durch hochladbare **Simulationswerte** für einen Soll/Ist-Vergleich pro Monat. Quellen: https://www.puc.pa.gov/pcdocs/1815060.pdf, https://ressupply.com/documents/solaredge/Monitoring_Portal_User_Guide.pdf
- Ein Abschnitt „**Environmental Benefits**“ (CO₂ vermieden, Bäume-Äquivalent) und eine **Layout-Ansicht** mit Tagesertrag je Modul. Die Werte sind kumuliert und nicht live. Gleich ausgerichtete Module sollten abends ähnliche Summen zeigen. Quelle: https://knowledge-base.solarhub.net.au/understanding-the-app-mysolaredge

### Enphase – Enlighten / Enphase App
- Die Statusseite zeigt oben einen **Statusindikator („System Normal“)** und darunter den **kumulierten Tageswert seit Mitternacht** statt der Momentanleistung. Quellen: https://floridasolardesigngroup.com/?p=9898, https://knowledge-base.solarhub.net.au/understanding-the-app-enphase-enlighten
- **Performance Breakdown** in vier Kacheln: Netzabhängigkeit/Autarkie, **Geldwert** (Ersparnis bzw. Gewinn), **Umweltwirkung** (CO₂) und Netto-Einspeisung. Quelle: https://knowledge-base.solarhub.net.au/understanding-the-app-enphase-enlighten
- Das Energie-Chart nutzt eine **Nulllinie**: Quellen liegen oberhalb, Senken unterhalb. Die Farben sind fest codiert (Solar blau, Last orange, Netz schwarz, Batterie grün). Quelle: ebd.
- Zeitraum Tag/Woche/Monat/Jahr/**Lebensdauer** und benutzerdefiniert. Navigation per **Pfeilen und Kalender-Sprung**. Die Produktion gibt es wahlweise als **Raster (Tabelle) oder Grafik**. Quelle: https://floridasolardesigngroup.com/?p=9898

### Huawei – FusionSolar / SmartPVMS
- **KPI-Kopfzeile** über alle Anlagen: Gesamtertrag und Erlös, aktuelle Leistung, Tagesertrag und Tageserlös, installierte Leistung. Quelle: https://www.vpsolar.com/en/huawei-fusionsolar-softwares-app-and-smartpvms-portal/
- **Ertragsstatistik** nach Tag/Monat/Jahr/Lebensdauer. Eine **Anlagenliste** mit Status, Standort und Ertrag je Anlage führt per Klick in die Anlagen-Detailansicht. Quelle: ebd.
- **Alarme in vier Schweregraden** (Kritisch, Schwer, Gering, Warnung). Quelle: ebd.
- Die **Umweltbilanz** umfasst CO₂-Reduktion, eingesparte Kohle und gepflanzte Bäume. Huawei kennzeichnet die Werte selbst als Schätzung. Quellen: ebd., https://solar.huawei.cn/eu/HomeGreenPower

### Kostal – Solar Portal / Solar App
- Grafische Darstellung von Leistungs- und Ertragsdaten, Datenexport und E-Mail-Benachrichtigung bei Ereignissen. Quelle: https://www.kostal-solar-electric.com/fileadmin/downloadcenter/kse/BA_KOSTAL-Solar-Portal_DE.pdf
- Ein „modernes Dashboard“ mit **konfigurierbaren Ertrags- und Alarmmeldungen**, im Design an die Solar App angelehnt. Quelle: https://www.solarserver.de/2020/08/12/photovoltaik-anlagenmonitoring-neues-kostal-solar-portal/
- Viele technische Diagramme, darunter **Leistung je PV-String** und **Wechselrichter-Temperatur**, sowie eine Jahresübersicht der Energiebilanz. Quelle: https://www.photovoltaik.info/anlagen-monitoring-app-vergleich/

---

## Übernommene Muster

### 1. Kennzahlen-Kacheln mit Statusindikator (Hero-Zeile)
- **Beschreibung:** Oben eine Reihe von 4–6 Kacheln: aktuelle Leistung (kW, mit Zeitstempel der letzten Messung), Ertrag heute, Ertrag Monat, Ertrag Jahr, Gesamtzähler. Davor ein Status-Badge („Anlage arbeitet normal“ / „Keine Daten seit …“ / „Störung“). Vorbild sind Enphase (Status oben links, kumulierter Tageswert), Huawei (KPI-Kopfzeile) und SolarEdge (Monat/Jahr/Lebensdauer).
- **Warum:** Das ist die meistbesuchte Ansicht. Der Kunde will in zwei Sekunden wissen: „Läuft sie, und was hat sie heute gebracht?“
- **Umsetzung:** Alle Werte liegen direkt vor (AC-Leistung 5-min, Tagesertrag, Gesamtzähler). Monat und Jahr ergeben sich als Summe der Tageserträge. Zusätzlich gibt es den **spezifischen Ertrag in kWh/kWp** (wie SMA), damit unterschiedlich große Anlagen vergleichbar sind. Der Status leitet sich aus dem Alter des letzten Datenpunkts und den Fehler-/Statuscodes des Wechselrichters ab. Nachts zeigt das Badge „Nachtruhe“ statt „offline“.

### 2. Tageskurve mit Flächenfüllung und Erwartungsband
- **Beschreibung:** Ein Flächendiagramm der AC-Leistung über den Tag im 5-min-Raster mit Tagesnavigation (Pfeile ‹ ›, Kalender-Sprung, „Heute“). Dazu optional eine gestrichelte Vergleichslinie bzw. ein Band: die typische Kurve (z. B. Median der letzten 14 Tage oder des Vorjahresmonats). Vorbild: Fronius Tageskurve mit eingeblendeter Leistungsprognose, Enphase Pfeil- und Kalendernavigation.
- **Warum:** Die Tageskurve ist das „Gesicht“ jedes Portals. Wolkendurchgänge, Abschattung oder Abregelung (abgeschnittene Mittagsspitze) werden sofort sichtbar.
- **Umsetzung:** Die 5-min-AC-Leistung als gefüllte Fläche. Die Fläche entspricht optisch dem Tagesertrag, der als Zahl daneben steht. Die Vergleichslinie wird aus unserer eigenen Historie berechnet. Wird später eine Wetterprognose angebunden, kann sie zur echten Prognoselinie werden (wie bei Fronius). Bis dahin ist sie ausdrücklich als „**typischer Verlauf (Schätzung)**“ zu beschriften, nicht als Prognose.

### 3. Zeitraum-Umschalter Tag / Woche / Monat / Jahr / Gesamt mit passender Chartform
- **Beschreibung:** Ein einheitlicher Segment-Umschalter (wie bei allen Anbietern; Enphase und SolarEdge zusätzlich mit Lebensdauer). Bei „Tag“ erscheint eine Leistungskurve (kW), sonst Energiebalken (kWh): Woche/Monat → Tagesbalken, Jahr → Monatsbalken, Gesamt → Jahresbalken. Optional gibt es eine Tabellenansicht als Alternative zur Grafik (Enphase „Grid oder Graph“) und einen CSV-Export (Kostal, Fronius).
- **Warum:** Das kennen Nutzer aus jedem PV-Portal. Leistung und Energie werden sauber getrennt, was Laien sonst oft verwechseln.
- **Umsetzung:** Komplett aus Tagesertrag und 5-min-Leistung möglich. Die Navigation (‹ ›) gilt jeweils für die gewählte Periode. Für die Tabellenansicht und den Export dienen dieselben Aggregate.

### 4. Periodenvergleich: Vorjahr / Vormonat und Jahresvergleich
- **Beschreibung:** (a) Ein Delta-Badge an den Kacheln („+12 % ggü. Vorjahresmonat bis heute“). (b) Ein gruppiertes Balkendiagramm Jan–Dez, in dem die Jahre nebeneinander stehen. Vorbild sind SolarEdge „Comparative Energy“ und SMA Jahresvergleich (alle Jahre seit Inbetriebnahme). Das aktuelle Jahr erhält die Akzentfarbe, Vorjahre sind abgestuft grau.
- **Warum:** Absolute kWh sagen dem Kunden wenig. „Besser oder schlechter als letztes Jahr?“ ist die eigentliche Frage. Der Vergleich deckt außerdem schleichende Degradation oder Verschmutzung auf.
- **Umsetzung:** Aus der Tagesertrags-Historie. Wichtig ist ein **fairer Vergleich**: gleicher Zeitraum bis zum heutigen Tag (Vormonat oder Vorjahr bis Tag X), nicht der volle Vormonat. Fehlende Datentage müssen markiert werden, damit Lücken nicht als Minderertrag erscheinen.

### 5. Soll/Ist-Vergleich mit Erwartungswert je Monat
- **Beschreibung:** In der Jahresansicht stehen Monatsbalken (Ist) mit einer Markierung oder Linie für den Erwartungswert (Soll). Dazu eine Kachel „Jahresziel: 68 % erreicht“. Vorbild sind SMA (konfigurierbarer Erwartungsertrag, Performance Ratio) und SolarEdge (hochgeladene Simulationswerte je Monat).
- **Warum:** Das ist der verständlichste Gesundheitscheck für Laien und die Grundlage für Ertragsalarme („Monat liegt 25 % unter Erwartung“).
- **Umsetzung:** Der Erwartungswert entsteht aus kWp × spezifischem Jahresertrag des Standorts (z. B. PVGIS-Monatswerte oder Werte aus dem Angebot bzw. der Simulation, pro Anlage hinterlegbar). Er ist **immer als Schätzung/Erwartung zu kennzeichnen**, weil er wetterunabhängig ist. Eine echte Performance Ratio wäre ohne Einstrahlungssensor nicht seriös und wird daher nicht ausgewiesen.

### 6. Ersparnis in € und Umweltbilanz (CO₂) – transparent als Schätzung
- **Beschreibung:** Zwei Kacheln: „Ersparnis/Erlös“ (heute, Jahr, gesamt) und „Vermiedenes CO₂“ (optional mit Bäume-Äquivalent). Vorbild sind Enphase „Currency Equivalent / Environmental Impact“, Fronius Amortisation und CO₂, Huawei Umweltbilanz und SolarEdge Environmental Benefits.
- **Warum:** Das motiviert den Kunden und macht den Nutzen in Geld greifbar, mit hohem Wiedererkennungswert aus anderen Portalen.
- **Umsetzung:** Ersparnis = Ertrag × geschätzte Eigenverbrauchsquote × Strompreis + Ertrag × (1 − Quote) × Einspeisevergütung. Quote, Preis und Vergütung sind pro Anlage konfigurierbar. **Deutlich als Schätzung ausweisen** („geschätzt, Annahme: 30 % Eigenverbrauch“), mit einem Info-Icon, das die Annahmen zeigt. CO₂ entsteht als Ertrag × **aktueller, mit Quelle angegebener Emissionsfaktor** (z. B. UBA-Strommix des Vorjahres), pro Anlage konfigurierbar wie bei SMA. Die Lehre aus der Fronius/VKI-Kritik: keinen veralteten oder geschönten Faktor verwenden und Quelle sowie Jahr anzeigen. Das Bäume-Äquivalent ist optional und nur mit Quellenangabe zu zeigen.

### 7. Ertragskalender / Heatmap
- **Beschreibung:** Eine Kalender-Heatmap (Monatsraster mit 7 Spalten, oder Jahresübersicht mit 12 Monaten). Jede Zelle ist ein Tag, die Farbintensität entspricht dem Tagesertrag (bzw. kWh/kWp). Ein Klick springt zur Tageskurve. Datenlücken erscheinen als schraffierte Zellen. Das ist kein Kernmuster der Hersteller, ergänzt aber deren „Monatsbalken“ und die Saisonverteilung (SMA) um eine kompaktere Form.
- **Warum:** Sonnen- und Ausfalltage, Saisonverlauf und Datenlücken sind auf einen Blick erkennbar. Die Heatmap ist zugleich eine gute Navigation in die Historie.
- **Umsetzung:** Rein aus dem Tagesertrag. Die Farbskala ist sequenziell und wird pro Monat oder über das ganze Jahr normiert (umschaltbar).

### 8. Technik-Ansicht: PV-Strings und Temperatur, plus Ereignisliste und Portfolio
- **Beschreibung:**
  - (a) **String-Vergleich**: Leistung bzw. Strom je PV-String als Linien im Tagesverlauf. Strings gleicher Ausrichtung sollten deckungsgleich laufen. Abweichungen über einer Toleranz werden markiert. Vorbild sind SolarEdge/Enphase-Layout („gleiche Ausrichtung → ähnliche Summen“), Kostal (Leistung je String) und SMA (Wechselrichter-Vergleich mit Toleranz).
  - (b) Die **Temperaturkurve** des Wechselrichters erscheint als Nebenachse oder Mini-Chart (Kostal).
  - (c) Eine **Ereignis-/Statusliste** mit Schweregraden (Huawei: vier Stufen; bei uns z. B. Info/Warnung/Störung) und E-Mail-Benachrichtigung (Kostal, SMA).
  - (d) Eine **Portfolio-Übersicht** für Kunden mit mehreren Anlagen: Tabelle oder Karten mit Status, aktueller Leistung, Tagesertrag und spezifischem Ertrag gestern (SMA, Huawei), sortierbar, mit Klick in die Anlage.
- **Warum:** Die Technik-Ansicht verschafft Vertrauen und dient als Diagnosewerkzeug für Kunde und Betreuer. Das Portfolio ist für Vermieter, Gewerbe und Installateur-Accounts nötig.
- **Umsetzung:** Die String-Werte (U/I/P) und die Temperatur stammen direkt vom SolarMax. Die Toleranzprüfung vergleicht Strings untereinander als relative Abweichung zum Median. Ereignisse kommen aus Statuscodes und Kommunikationsausfällen, Ertragsabweichungen aus Muster 5. Die Portfolio-Liste ist die Aggregation der Kacheln aus Muster 1 über alle Anlagen. Den spezifischen Ertrag zeigen wir als Vergleichsgröße, damit unterschiedliche Anlagengrößen fair verglichen werden.

---

## Bewusst nicht übernommen

- **Energiefluss-Diagramm (PV → Haus / Netz / Batterie, animiert)**: Es ist bei SMA, Fronius, SolarEdge und Enphase das zentrale Element, braucht aber gemessenen Verbrauch und gemessene Einspeisung. Mit einer geschätzten Quote würden wir Live-Flüsse vortäuschen. Höchstens denkbar ist ein statischer, klar als „geschätzte Aufteilung“ gekennzeichneter Balken (Eigenverbrauch vs. Einspeisung) über einen Zeitraum, keine Echtzeit-Animation.
- **Verbrauchskurven, Produktion-vs.-Verbrauch-Chart, Nulllinien-Darstellung mit Netzbezug (Enphase)**: Ohne Verbrauchszähler gibt es keine Daten dafür.
- **Autarkiegrad / Netzabhängigkeit / Netto-Einspeisung als Messwert**: Diese Werte setzen Bezug und Einspeisung voraus. Die geschätzte Eigenverbrauchsquote nutzen wir nur innerhalb der €-Schätzung (Muster 6) und nicht als eigene „gemessene“ Kennzahl.
- **Batterie-Ladezustand, Speicher-Betriebsmodi, Backup-Reserve**: Wir haben keinen Speicher.
- **Lastmanagement, Gerätesteuerung, Verbraucherbilanz nach Lastarten (SMA Home Manager, SolarEdge Device Control)**: Dafür fehlen Aktoren und Messungen.
- **Performance Ratio und sensorbasierter Soll/Ist-Vergleich**: Ohne Einstrahlungssensor wäre die PR unseriös. Wir verwenden stattdessen den Erwartungswert auf Basis von PVGIS bzw. Simulation (Muster 5) und kennzeichnen ihn als Schätzung.
- **Modul-genaues Layout (SolarEdge/Enphase)**: Ohne Optimierer bzw. Mikrowechselrichter gibt es keine Moduldaten. Der String-Vergleich (Muster 8) ist unser Äquivalent.
- **Regionaler Anlagenvergleich (SMA Sunny Places)**: Dafür fehlt zunächst eine ausreichend große Vergleichsbasis. Er wäre später über den spezifischen Ertrag im eigenen Portfolio denkbar.
- **Wetterbasierte 48-h-Ertragsprognose (Fronius)**: Sie ist vorerst zurückgestellt, weil sie eine externe Wetter-API braucht. Muster 2 ist so angelegt, dass sie später nachrüstbar ist.
- **Fremde Markenelemente, Farben, Icons oder Screenshots**: Davon wird nichts übernommen. Wir übernehmen nur Interaktions- und Darstellungsmuster.

## Umsetzungsstand im Portal (Oktober 2026)

| Muster | Status |
|---|---|
| 1. Kennzahlen-Kacheln mit Status | umgesetzt (Hero-Karte „Aktuelle Leistung“, Kacheln Heute/Monat/Jahr/Gesamt/CO₂/spez. Ertrag, Status inkl. „Nachtruhe“) |
| 2. Tageskurve mit Flächenfüllung | umgesetzt (Summe als Fläche Lila→Orange, WR einzeln zuschaltbar); Erwartungsband offen |
| 3. Zeitraum-Umschalter | umgesetzt für Tag/Monat/Jahr/Gesamt inkl. Vor/Zurück, Datumsauswahl, „Heute“, Drill-down per Balken; Woche offen |
| 4. Periodenvergleich | umgesetzt (Vergleichsbalken Vormonat/Vorjahr, Delta absolut + %; laufende Zeiträume werden mit dem gleichen Zeitraum verglichen) |
| 5. Soll/Ist mit Erwartungswert | offen (benötigt PVGIS-/Simulationswerte je Anlage) |
| 6. Ersparnis in € und CO₂ | umgesetzt (Tarife je Anlage mit Gültigkeit, Eigenverbrauchsquote als Schätzung gekennzeichnet; CO₂ mit 0,38 kg/kWh als „ca.“) |
| 7. Ertragskalender | umgesetzt (Monat als Wochenraster, Jahr als Monat × Tag) |
| 8. Technik, Ereignisse, Portfolio | umgesetzt: PV-Strings, AC-Phasen, Temperatur, Statusverlauf, Portfolio-Karten mit Sparkline; Ereignisliste/E-Mail-Benachrichtigung offen |

Der zwischenzeitlich eingebaute vereinfachte Energiefluss (PV → Haus / Netz, Schätzung) wurde auf Nutzerwunsch wieder entfernt –
im Einklang mit der Empfehlung oben. An seiner Stelle zeigt eine Vergleichskarte den Zeitraum gegenüber Vormonat/Vorjahr.
