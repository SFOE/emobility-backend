/**
 * Central, language-keyed translations for the user-facing GeoJSON popup text.
 */

export const GEOJSON_LANGUAGES = ['de', 'fr', 'it', 'en'] as const;
export type Language = (typeof GEOJSON_LANGUAGES)[number];

export interface Translations {
  socketPrefix: string; // e.g. "Steckdose"
  yes: string;
  no: string;
  priceUnavailable: string;
  notSpecified: string; // "Keine Angabe" (facilities / opening hours / energy)
  infoUnavailable: string; // "Information nicht verfügbar" (vehicle types / accessible count / operator)
  clockSuffix: string; // appended after time ranges, e.g. "Uhr" (empty when the language has none)
  additionallyOpen: string; // exceptional openings prefix
  exceptionallyClosed: string; // exceptional closings prefix
  renewableSuffix: string; // rendered as `<pct>% <renewableSuffix>`
  units: {
    charge: string; // FLAT price component unit
    minute: string; // TIME / PARKING_TIME price component unit
  };
  labels: {
    network: string;
    location: string;
    price: string;
    adHocPrice: string;
    payment: string;
    openingHours: string;
    vehicleType: string;
    accessibleEvseCount: string;
    infrastructure: string;
    energySource: string;
    feedbackQuestion: string;
    feedbackLink: string;
    coordinates: string;
  };
  // EVSE status category -> display label.
  status: Record<string, string>;
  // ISO weekday number (1 = Monday .. 7 = Sunday) -> short label.
  weekdays: Record<number, string>;
  facilities: Record<string, string>;
  vehicleTypes: Record<string, string>;
}

const de: Translations = {
  socketPrefix: 'Steckdose',
  yes: 'Ja',
  no: 'Nein',
  priceUnavailable: 'Preisinformationen nicht verfügbar',
  notSpecified: 'Keine Angabe',
  infoUnavailable: 'Information nicht verfügbar',
  clockSuffix: 'Uhr',
  additionallyOpen: 'Zusätzlich geöffnet:',
  exceptionallyClosed: 'Ausnahmsweise geschlossen:',
  renewableSuffix: 'erneuerbar',
  units: { charge: 'Ladung', minute: 'Min' },
  labels: {
    network: 'Ladenetzwerk',
    location: 'Standort',
    price: 'Preis',
    adHocPrice: 'Ad-hoc Preis je Ladepunkt',
    payment: 'Bezahlmöglichkeit Kredit-/Debitkarte',
    openingHours: 'Öffnungszeiten',
    vehicleType: 'Fahrzeugtyp',
    accessibleEvseCount: 'Anzahl Ladepunkte für Menschen mit Beeinträchtigung',
    infrastructure: 'Infrastruktur',
    energySource: 'Energiequelle',
    feedbackQuestion: 'Fehlerhafte Angaben?',
    feedbackLink: 'Rückmeldung senden',
    coordinates: 'Geokoordinaten',
  },
  status: {
    AVAILABLE: 'Verfügbar',
    CHARGING: 'Besetzt',
    RESERVED: 'Reserviert',
    UNKNOWN: 'Verfügbarkeit unbekannt',
    OUTOFORDER: 'Ausser Betrieb',
  },
  weekdays: { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 7: 'So' },
  facilities: {
    HOTEL: 'Hotel',
    RESTAURANT: 'Restaurant',
    CAFE: 'Café',
    MALL: 'Einkaufszentrum',
    SUPERMARKET: 'Supermarkt',
    SPORT: 'Sportanlage',
    RECREATION_AREA: 'Erholungsgebiet',
    NATURE: 'Naturgebiet',
    MUSEUM: 'Museum',
    BIKE_SHARING: 'Bike-Sharing',
    BUS_STOP: 'Bushaltestelle',
    TAXI_STAND: 'Taxistand',
    TRAM_STOP: 'Tramhaltestelle',
    METRO_STATION: 'Metrostation',
    TRAIN_STATION: 'Bahnhof',
    AIRPORT: 'Flughafen',
    PARKING_LOT: 'Parkplatz',
    CARPOOL_PARKING: 'Fahrgemeinschaftsparkplatz',
    FUEL_STATION: 'Tankstelle',
    WIFI: 'WLAN',
  },
  vehicleTypes: {
    MOTORCYCLE: 'Motorrad',
    PERSONAL_VEHICLE: 'Personenwagen',
    PERSONAL_VEHICLE_WITH_TRAILER: 'Personenwagen mit Anhänger',
    VAN: 'Lieferwagen',
    SEMI_TRACTOR: 'Sattelschlepper',
    RIGID: 'Lastwagen (Solo)',
    TRUCK_WITH_TRAILER: 'Lastwagen mit Anhänger',
    BUS: 'Bus',
    DISABLED: 'Behindertenparkplatz',
  },
};

const fr: Translations = {
  socketPrefix: 'Prise',
  yes: 'Oui',
  no: 'Non',
  priceUnavailable: 'Informations tarifaires non disponibles',
  notSpecified: 'Non renseigné',
  infoUnavailable: 'Information non disponible',
  clockSuffix: '',
  additionallyOpen: 'Ouvert en plus :',
  exceptionallyClosed: 'Exceptionnellement fermé :',
  renewableSuffix: 'renouvelable',
  units: { charge: 'charge', minute: 'min' },
  labels: {
    network: 'Réseau de recharge',
    location: 'Emplacement',
    price: 'Prix',
    adHocPrice: 'Prix ad hoc par point de recharge',
    payment: 'Paiement par carte de crédit/débit',
    openingHours: "Heures d'ouverture",
    vehicleType: 'Type de véhicule',
    accessibleEvseCount:
      'Nombre de points de recharge pour personnes en situation de handicap',
    infrastructure: 'Infrastructure',
    energySource: "Source d'énergie",
    feedbackQuestion: 'Informations erronées ?',
    feedbackLink: 'Envoyer un commentaire',
    coordinates: 'Coordonnées géographiques',
  },
  status: {
    AVAILABLE: 'Disponible',
    CHARGING: 'Occupé',
    RESERVED: 'Réservé',
    UNKNOWN: 'Disponibilité inconnue',
    OUTOFORDER: 'Hors service',
  },
  weekdays: { 1: 'Lu', 2: 'Ma', 3: 'Me', 4: 'Je', 5: 'Ve', 6: 'Sa', 7: 'Di' },
  facilities: {
    HOTEL: 'Hôtel',
    RESTAURANT: 'Restaurant',
    CAFE: 'Café',
    MALL: 'Centre commercial',
    SUPERMARKET: 'Supermarché',
    SPORT: 'Installation sportive',
    RECREATION_AREA: 'Zone de loisirs',
    NATURE: 'Espace naturel',
    MUSEUM: 'Musée',
    BIKE_SHARING: 'Vélos en libre-service',
    BUS_STOP: 'Arrêt de bus',
    TAXI_STAND: 'Station de taxi',
    TRAM_STOP: 'Arrêt de tram',
    METRO_STATION: 'Station de métro',
    TRAIN_STATION: 'Gare',
    AIRPORT: 'Aéroport',
    PARKING_LOT: 'Parking',
    CARPOOL_PARKING: 'Parking pour covoiturage',
    FUEL_STATION: 'Station-service',
    WIFI: 'Wi-Fi',
  },
  vehicleTypes: {
    MOTORCYCLE: 'Moto',
    PERSONAL_VEHICLE: 'Voiture',
    PERSONAL_VEHICLE_WITH_TRAILER: 'Voiture avec remorque',
    VAN: 'Camionnette',
    SEMI_TRACTOR: 'Semi-remorque',
    RIGID: 'Camion (porteur)',
    TRUCK_WITH_TRAILER: 'Camion avec remorque',
    BUS: 'Bus',
    DISABLED: 'Place handicapé',
  },
};

const it: Translations = {
  socketPrefix: 'Presa',
  yes: 'Sì',
  no: 'No',
  priceUnavailable: 'Informazioni sui prezzi non disponibili',
  notSpecified: 'Nessuna indicazione',
  infoUnavailable: 'Informazione non disponibile',
  clockSuffix: '',
  additionallyOpen: 'Aperto in aggiunta:',
  exceptionallyClosed: 'Eccezionalmente chiuso:',
  renewableSuffix: 'rinnovabile',
  units: { charge: 'ricarica', minute: 'min' },
  labels: {
    network: 'Rete di ricarica',
    location: 'Posizione',
    price: 'Prezzo',
    adHocPrice: 'Prezzo ad hoc per punto di ricarica',
    payment: 'Pagamento con carta di credito/debito',
    openingHours: 'Orari di apertura',
    vehicleType: 'Tipo di veicolo',
    accessibleEvseCount:
      'Numero di punti di ricarica per persone con disabilità',
    infrastructure: 'Infrastruttura',
    energySource: 'Fonte di energia',
    feedbackQuestion: 'Informazioni errate?',
    feedbackLink: 'Invia un feedback',
    coordinates: 'Coordinate geografiche',
  },
  status: {
    AVAILABLE: 'Disponibile',
    CHARGING: 'Occupato',
    RESERVED: 'Riservato',
    UNKNOWN: 'Disponibilità sconosciuta',
    OUTOFORDER: 'Fuori servizio',
  },
  weekdays: { 1: 'Lu', 2: 'Ma', 3: 'Me', 4: 'Gi', 5: 'Ve', 6: 'Sa', 7: 'Do' },
  facilities: {
    HOTEL: 'Hotel',
    RESTAURANT: 'Ristorante',
    CAFE: 'Caffè',
    MALL: 'Centro commerciale',
    SUPERMARKET: 'Supermercato',
    SPORT: 'Impianto sportivo',
    RECREATION_AREA: 'Area ricreativa',
    NATURE: 'Area naturale',
    MUSEUM: 'Museo',
    BIKE_SHARING: 'Bike sharing',
    BUS_STOP: "Fermata dell'autobus",
    TAXI_STAND: 'Posteggio dei taxi',
    TRAM_STOP: 'Fermata del tram',
    METRO_STATION: 'Stazione della metropolitana',
    TRAIN_STATION: 'Stazione ferroviaria',
    AIRPORT: 'Aeroporto',
    PARKING_LOT: 'Parcheggio',
    CARPOOL_PARKING: 'Parcheggio per car pooling',
    FUEL_STATION: 'Stazione di servizio',
    WIFI: 'Wi-Fi',
  },
  vehicleTypes: {
    MOTORCYCLE: 'Motocicletta',
    PERSONAL_VEHICLE: 'Automobile',
    PERSONAL_VEHICLE_WITH_TRAILER: 'Automobile con rimorchio',
    VAN: 'Furgone',
    SEMI_TRACTOR: 'Motrice per semirimorchio',
    RIGID: 'Autocarro (rigido)',
    TRUCK_WITH_TRAILER: 'Autocarro con rimorchio',
    BUS: 'Autobus',
    DISABLED: 'Parcheggio per disabili',
  },
};

const en: Translations = {
  socketPrefix: 'Socket',
  yes: 'Yes',
  no: 'No',
  priceUnavailable: 'Price information not available',
  notSpecified: 'Not specified',
  infoUnavailable: 'Information not available',
  clockSuffix: '',
  additionallyOpen: 'Additionally open:',
  exceptionallyClosed: 'Exceptionally closed:',
  renewableSuffix: 'renewable',
  units: { charge: 'charge', minute: 'min' },
  labels: {
    network: 'Charging network',
    location: 'Location',
    price: 'Price',
    adHocPrice: 'Ad hoc price per charging point',
    payment: 'Payment by credit/debit card',
    openingHours: 'Opening hours',
    vehicleType: 'Vehicle type',
    accessibleEvseCount:
      'Number of charging points for people with disabilities',
    infrastructure: 'Infrastructure',
    energySource: 'Energy source',
    feedbackQuestion: 'Incorrect information?',
    feedbackLink: 'Send feedback',
    coordinates: 'Geographic coordinates',
  },
  status: {
    AVAILABLE: 'Available',
    CHARGING: 'Busy',
    RESERVED: 'Reserved',
    UNKNOWN: 'Availability unknown',
    OUTOFORDER: 'Out of order',
  },
  weekdays: {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  },
  facilities: {
    HOTEL: 'Hotel',
    RESTAURANT: 'Restaurant',
    CAFE: 'Café',
    MALL: 'Shopping mall',
    SUPERMARKET: 'Supermarket',
    SPORT: 'Sports facility',
    RECREATION_AREA: 'Recreation area',
    NATURE: 'Nature area',
    MUSEUM: 'Museum',
    BIKE_SHARING: 'Bike sharing',
    BUS_STOP: 'Bus stop',
    TAXI_STAND: 'Taxi stand',
    TRAM_STOP: 'Tram stop',
    METRO_STATION: 'Metro station',
    TRAIN_STATION: 'Train station',
    AIRPORT: 'Airport',
    PARKING_LOT: 'Parking lot',
    CARPOOL_PARKING: 'Carpool parking',
    FUEL_STATION: 'Fuel station',
    WIFI: 'Wi-Fi',
  },
  vehicleTypes: {
    MOTORCYCLE: 'Motorcycle',
    PERSONAL_VEHICLE: 'Car',
    PERSONAL_VEHICLE_WITH_TRAILER: 'Car with trailer',
    VAN: 'Van',
    SEMI_TRACTOR: 'Semi-truck',
    RIGID: 'Rigid truck',
    TRUCK_WITH_TRAILER: 'Truck with trailer',
    BUS: 'Bus',
    DISABLED: 'Disabled parking',
  },
};

export const TRANSLATIONS: Record<Language, Translations> = { de, fr, it, en };
