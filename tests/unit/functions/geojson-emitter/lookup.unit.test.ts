import {
    AD_HOC_PAYMENT_TARIFF_TYPE,
    PRICE_COMPONENT_ORDER,
    PRICE_COMPONENT_UNITS,
    RENEWABLE_ENERGY_SOURCE_CATEGORIES,
    STATUS_CATEGORY_MAP,
    STATUS_CLASS_LABELS,
    WEEKDAY_LABELS,
} from '../../../../src/functions/geojson-emitter/lookups';

describe('STATUS_CATEGORY_MAP / STATUS_CLASS_LABELS consistency', () => {
    it('maps every category to one of the five display classes', () => {
        const displayClasses = new Set(Object.keys(STATUS_CLASS_LABELS));
        for (const category of Object.values(STATUS_CATEGORY_MAP)) {
            expect(displayClasses.has(category)).toBe(true);
        }
    });

    it('collapses non-core statuses into OUTOFORDER', () => {
        expect(STATUS_CATEGORY_MAP['PLANNED']).toBe('OUTOFORDER');
        expect(STATUS_CATEGORY_MAP['BLOCKED']).toBe('OUTOFORDER');
        expect(STATUS_CATEGORY_MAP['INOPERATIVE']).toBe('OUTOFORDER');
        expect(STATUS_CATEGORY_MAP['REMOVED']).toBe('OUTOFORDER');
    });

    it('keeps the four core statuses as their own category', () => {
        expect(STATUS_CATEGORY_MAP['AVAILABLE']).toBe('AVAILABLE');
        expect(STATUS_CATEGORY_MAP['CHARGING']).toBe('CHARGING');
        expect(STATUS_CATEGORY_MAP['RESERVED']).toBe('RESERVED');
        expect(STATUS_CATEGORY_MAP['UNKNOWN']).toBe('UNKNOWN');
    });

    it('provides a [cssClass, label] pair for each display class', () => {
        for (const [cssClass, label] of Object.values(STATUS_CLASS_LABELS)) {
            expect(typeof cssClass).toBe('string');
            expect(cssClass.length).toBeGreaterThan(0);
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
        }
    });
});

describe('price component tables', () => {
    it('has a unit for every ordered price component type', () => {
        for (const componentType of PRICE_COMPONENT_ORDER) {
            expect(PRICE_COMPONENT_UNITS[componentType]).toBeDefined();
        }
    });

    it('exposes AD_HOC_PAYMENT as the ad-hoc tariff type', () => {
        expect(AD_HOC_PAYMENT_TARIFF_TYPE).toBe('AD_HOC_PAYMENT');
    });
});

describe('WEEKDAY_LABELS', () => {
    it('maps ISO weekdays 1..7 to German abbreviations', () => {
        expect(Object.keys(WEEKDAY_LABELS)).toHaveLength(7);
        expect(WEEKDAY_LABELS[1]).toBe('Mo');
        expect(WEEKDAY_LABELS[7]).toBe('So');
    });
});

describe('RENEWABLE_ENERGY_SOURCE_CATEGORIES', () => {
    it('contains the renewable source categories', () => {
        expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('SOLAR')).toBe(true);
        expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('WIND')).toBe(true);
        expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('WATER')).toBe(true);
        expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('GENERAL_GREEN')).toBe(true);
    });

    it('does not treat non-renewable sources as renewable', () => {
        expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('COAL')).toBe(false);
        expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('NUCLEAR')).toBe(false);
    });
});