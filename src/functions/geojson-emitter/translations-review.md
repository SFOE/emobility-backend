# GeoJSON-Popup — Übersetzungs-Review (DE → FR / IT / EN)

Quelle der Wahrheit: `translations.ts`. **DE** ist die bereits produktiv ausgelieferte Fassung.
**FR/IT/EN sind ein erster Übersetzungs-Pass und brauchen ein Review durch Muttersprachler / BFE.**
Korrekturen bitte direkt in `translations.ts` eintragen (gleiche Keys).

> Nicht übersetzt (Maschinen-/Styling-Werte, müssen stabil bleiben): `Availability`-Property,
> `symbology`, CSS-Klassen, Connector-Codes (Type 1/2, CCS, CHAdeMO, Tesla), Einheit `kWh`, Währung `CHF`.

## Tabellen-Labels (linke Spalte im Popup)

| Key | DE | FR | IT | EN |
|-----|----|----|----|----|
| network | Ladenetzwerk | Réseau de recharge | Rete di ricarica | Charging network |
| location | Standort | Emplacement | Posizione | Location |
| price | Preis | Prix | Prezzo | Price |
| adHocPrice (Wert) | Ad-hoc Preis je Ladepunkt | Prix ad hoc par point de recharge | Prezzo ad hoc per punto di ricarica | Ad hoc price per charging point |
| payment | Bezahlmöglichkeit Kredit-/Debitkarte | Paiement par carte de crédit/débit | Pagamento con carta di credito/debito | Payment by credit/debit card |
| openingHours | Öffnungszeiten | Heures d'ouverture | Orari di apertura | Opening hours |
| vehicleType | Fahrzeugtyp | Type de véhicule | Tipo di veicolo | Vehicle type |
| accessibleEvseCount | Anzahl Ladepunkte für Menschen mit Beeinträchtigung | Nombre de points de recharge pour personnes en situation de handicap | Numero di punti di ricarica per persone con disabilità | Number of charging points for people with disabilities |
| infrastructure | Infrastruktur | Infrastructure | Infrastruttura | Infrastructure |
| energySource | Energiequelle | Source d'énergie | Fonte di energia | Energy source |
| feedbackQuestion | Fehlerhafte Angaben? | Informations erronées ? | Informazioni errate? | Incorrect information? |
| feedbackLink | Rückmeldung senden | Envoyer un commentaire | Invia un feedback | Send feedback |
| coordinates | Geokoordinaten | Coordonnées géographiques | Coordinate geografiche | Geographic coordinates |

## Werte & Fallbacks

| Key | DE | FR | IT | EN |
|-----|----|----|----|----|
| yes | Ja | Oui | Sì | Yes |
| no | Nein | Non | No | No |
| socketPrefix | Steckdose | Prise | Presa | Socket |
| priceUnavailable | Preisinformationen nicht verfügbar | Informations tarifaires non disponibles | Informazioni sui prezzi non disponibili | Price information not available |
| notSpecified | Keine Angabe | Non renseigné | Nessuna indicazione | Not specified |
| infoUnavailable | Information nicht verfügbar | Information non disponible | Informazione non disponibile | Information not available |
| renewableSuffix (`<x>% …`) | erneuerbar | renouvelable | rinnovabile | renewable |
| additionallyOpen | Zusätzlich geöffnet: | Ouvert en plus : | Aperto in aggiunta: | Additionally open: |
| exceptionallyClosed | Ausnahmsweise geschlossen: | Exceptionnellement fermé : | Eccezionalmente chiuso: | Exceptionally closed: |
| clockSuffix (nach Zeitangaben) | Uhr | *(leer)* | *(leer)* | *(leer)* |

## Einheiten (Preis)

| Key | DE | FR | IT | EN |
|-----|----|----|----|----|
| units.charge (FLAT) | Ladung | charge | ricarica | charge |
| units.minute (TIME/PARKING_TIME) | Min | min | min | min |
| ENERGY (nicht übersetzt) | kWh | kWh | kWh | kWh |

## EVSE-Status

| Key | DE | FR | IT | EN |
|-----|----|----|----|----|
| AVAILABLE | Verfügbar | Disponible | Disponibile | Available |
| CHARGING | Besetzt | Occupé | Occupato | Busy |
| RESERVED | Reserviert | Réservé | Riservato | Reserved |
| UNKNOWN | Verfügbarkeit unbekannt | Disponibilité inconnue | Disponibilità sconosciuta | Availability unknown |
| OUTOFORDER | Ausser Betrieb | Hors service | Fuori servizio | Out of order |

## Wochentage (1 = Mo … 7 = So)

| # | DE | FR | IT | EN |
|---|----|----|----|----|
| 1 | Mo | Lu | Lu | Mon |
| 2 | Di | Ma | Ma | Tue |
| 3 | Mi | Me | Me | Wed |
| 4 | Do | Je | Gi | Thu |
| 5 | Fr | Ve | Ve | Fri |
| 6 | Sa | Sa | Sa | Sat |
| 7 | So | Di | Do | Sun |

## Infrastruktur (facilities)

| Key | DE | FR | IT | EN |
|-----|----|----|----|----|
| HOTEL | Hotel | Hôtel | Hotel | Hotel |
| RESTAURANT | Restaurant | Restaurant | Ristorante | Restaurant |
| CAFE | Café | Café | Caffè | Café |
| MALL | Einkaufszentrum | Centre commercial | Centro commerciale | Shopping mall |
| SUPERMARKET | Supermarkt | Supermarché | Supermercato | Supermarket |
| SPORT | Sportanlage | Installation sportive | Impianto sportivo | Sports facility |
| RECREATION_AREA | Erholungsgebiet | Zone de loisirs | Area ricreativa | Recreation area |
| NATURE | Naturgebiet | Espace naturel | Area naturale | Nature area |
| MUSEUM | Museum | Musée | Museo | Museum |
| BIKE_SHARING | Bike-Sharing | Vélos en libre-service | Bike sharing | Bike sharing |
| BUS_STOP | Bushaltestelle | Arrêt de bus | Fermata dell'autobus | Bus stop |
| TAXI_STAND | Taxistand | Station de taxi | Posteggio dei taxi | Taxi stand |
| TRAM_STOP | Tramhaltestelle | Arrêt de tram | Fermata del tram | Tram stop |
| METRO_STATION | Metrostation | Station de métro | Stazione della metropolitana | Metro station |
| TRAIN_STATION | Bahnhof | Gare | Stazione ferroviaria | Train station |
| AIRPORT | Flughafen | Aéroport | Aeroporto | Airport |
| PARKING_LOT | Parkplatz | Parking | Parcheggio | Parking lot |
| CARPOOL_PARKING | Fahrgemeinschaftsparkplatz | Parking pour covoiturage | Parcheggio per car pooling | Carpool parking |
| FUEL_STATION | Tankstelle | Station-service | Stazione di servizio | Fuel station |
| WIFI | WLAN | Wi-Fi | Wi-Fi | Wi-Fi |

## Fahrzeugtypen (vehicleTypes)

| Key | DE | FR | IT | EN |
|-----|----|----|----|----|
| MOTORCYCLE | Motorrad | Moto | Motocicletta | Motorcycle |
| PERSONAL_VEHICLE | Personenwagen | Voiture | Automobile | Car |
| PERSONAL_VEHICLE_WITH_TRAILER | Personenwagen mit Anhänger | Voiture avec remorque | Automobile con rimorchio | Car with trailer |
| VAN | Lieferwagen | Camionnette | Furgone | Van |
| SEMI_TRACTOR | Sattelschlepper | Semi-remorque | Motrice per semirimorchio | Semi-truck |
| RIGID | Lastwagen (Solo) | Camion (porteur) | Autocarro (rigido) | Rigid truck |
| TRUCK_WITH_TRAILER | Lastwagen mit Anhänger | Camion avec remorque | Autocarro con rimorchio | Truck with trailer |
| BUS | Bus | Bus | Autobus | Bus |
| DISABLED | Behindertenparkplatz | Place handicapé | Parcheggio per disabili | Disabled parking |
