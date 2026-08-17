import { overlayStatus, parseStatusItems } from '../../../../src/functions/geojson-emitter/overlay';
import type { GoldLocation, StatusItem } from '../../../../src/functions/geojson-emitter/types';

function makeLocation(overrides: Partial<GoldLocation> = {}): GoldLocation {
    return {
        country_code: 'CH',
        party_id: 'TIA',
        id: 'LOC002',
        full_location_id: 'CH*TIA*LOC002',
        latitude: 47.1,
        longitude: 8.2,
        address_display: 'Teststrasse 1',
        tariffs: [],
        evses: [{ evse_uid: 'EVSE001', status: 'AVAILABLE', connectors: [] }],
        evse_ids: ['CH*TIA*EVSE001'],
        ...overrides,
    };
}

function makeStatusItem(overrides: Partial<StatusItem> = {}): StatusItem {
    return {
        pk: 'LOCATION#CH#TIA#LOC002',
        sk: 'EVSE#EVSE001',
        status: 'CHARGING',
        last_updated: '2026-08-03T10:00:00Z',
        ...overrides,
    };
}

describe('parseStatusItems', () => {
    it('keys each item by its composite "pk#sk"', () => {
        const result = parseStatusItems([makeStatusItem()]);

        expect(result).toEqual({
            'LOCATION#CH#TIA#LOC002#EVSE#EVSE001': {
                status: 'CHARGING',
                last_updated: '2026-08-03T10:00:00Z',
            },
        });
    });

    it('returns an empty object for no items', () => {
        expect(parseStatusItems([])).toEqual({});
    });

    it('parses multiple items into distinct keys', () => {
        const result = parseStatusItems([
            makeStatusItem(),
            makeStatusItem({ sk: 'EVSE#EVSE002', status: 'RESERVED' }),
        ]);

        expect(Object.keys(result)).toEqual([
            'LOCATION#CH#TIA#LOC002#EVSE#EVSE001',
            'LOCATION#CH#TIA#LOC002#EVSE#EVSE002',
        ]);
        expect(result['LOCATION#CH#TIA#LOC002#EVSE#EVSE002']!.status).toBe('RESERVED');
    });
});

describe('overlayStatus', () => {
    it('overlays the live status onto a matching EVSE', () => {
        const locations = [makeLocation()];
        const statusByKey = parseStatusItems([makeStatusItem({ status: 'CHARGING' })]);

        const result = overlayStatus(locations, statusByKey);

        expect(result.locations[0]!.evses[0]!.status).toBe('CHARGING');
        expect(result.appliedCount).toBe(1);
    });

    it('keeps the export baked-in status when no live status matches', () => {
        const locations = [makeLocation()];

        const result = overlayStatus(locations, {});

        expect(result.locations[0]!.evses[0]!.status).toBe('AVAILABLE');
        expect(result.appliedCount).toBe(0);
    });

    it('does not mutate the input locations', () => {
        const locations = [makeLocation()];
        const statusByKey = parseStatusItems([makeStatusItem({ status: 'CHARGING' })]);

        overlayStatus(locations, statusByKey);

        expect(locations[0]!.evses[0]!.status).toBe('AVAILABLE');
    });

    it('overlays only the matching EVSE within a location', () => {
        const locations = [
            makeLocation({
                evses: [
                    { evse_uid: 'EVSE001', status: 'AVAILABLE', connectors: [] },
                    { evse_uid: 'EVSE002', status: 'AVAILABLE', connectors: [] },
                ],
            }),
        ];
        const statusByKey = parseStatusItems([makeStatusItem({ sk: 'EVSE#EVSE002', status: 'RESERVED' })]);

        const result = overlayStatus(locations, statusByKey);

        expect(result.locations[0]!.evses[0]!.status).toBe('AVAILABLE');
        expect(result.locations[0]!.evses[1]!.status).toBe('RESERVED');
        expect(result.appliedCount).toBe(1);
    });

    it('returns an empty result for no locations', () => {
        expect(overlayStatus([], {})).toEqual({ locations: [], appliedCount: 0 });
    });
});