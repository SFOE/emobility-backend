import {
  GEOJSON_LANGUAGES,
  TRANSLATIONS,
} from '../../../../src/functions/geojson-emitter/translations';

const STATUS_KEYS = [
  'AVAILABLE',
  'CHARGING',
  'RESERVED',
  'UNKNOWN',
  'OUTOFORDER',
];

describe('TRANSLATIONS', () => {
  it('defines a bundle for every supported language', () => {
    for (const language of GEOJSON_LANGUAGES) {
      expect(TRANSLATIONS[language]).toBeDefined();
    }
  });

  it('German is the authoritative baseline (unchanged wording)', () => {
    expect(TRANSLATIONS.de.labels.price).toBe('Preis');
    expect(TRANSLATIONS.de.labels.adHocPrice).toBe('Ad-hoc Preis je Ladepunkt');
    expect(TRANSLATIONS.de.priceUnavailable).toBe(
      'Preisinformationen nicht verfügbar',
    );
    expect(TRANSLATIONS.de.weekdays[1]).toBe('Mo');
    expect(TRANSLATIONS.de.socketPrefix).toBe('Steckdose');
  });

  it('every language covers weekdays 1..7 and all status categories', () => {
    for (const language of GEOJSON_LANGUAGES) {
      const t = TRANSLATIONS[language];
      expect(Object.keys(t.weekdays)).toHaveLength(7);
      for (const status of STATUS_KEYS) {
        expect(t.status[status]).toBeTruthy();
      }
    }
  });

  it('facility and vehicle-type keys match the German set in every language', () => {
    const facilityKeys = Object.keys(TRANSLATIONS.de.facilities).sort();
    const vehicleKeys = Object.keys(TRANSLATIONS.de.vehicleTypes).sort();
    for (const language of GEOJSON_LANGUAGES) {
      expect(Object.keys(TRANSLATIONS[language].facilities).sort()).toEqual(
        facilityKeys,
      );
      expect(Object.keys(TRANSLATIONS[language].vehicleTypes).sort()).toEqual(
        vehicleKeys,
      );
    }
  });

  it('translates weekdays per language', () => {
    expect(TRANSLATIONS.en.weekdays[1]).toBe('Mon');
    expect(TRANSLATIONS.fr.weekdays[1]).toBe('Lu');
    expect(TRANSLATIONS.it.weekdays[7]).toBe('Do');
  });
});
