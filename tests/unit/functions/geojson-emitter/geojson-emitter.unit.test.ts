import { run } from '../../../../src/functions/geojson-emitter/geojson-emitter';
import type {
    GeoJsonFeatureCollection,
    GoldExport,
    StatusItem,
} from '../../../../src/functions/geojson-emitter/types';

const GENERATED_AT = '2026-08-13T00:00:00Z';

function makeExport(): GoldExport {
    return {
        locations: [
            {
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
            },
        ],
    };
}

function makeStatusItem(): StatusItem {
    return {
        pk: 'LOCATION#CH#TIA#LOC002',
        sk: 'EVSE#EVSE001',
        status: 'CHARGING',
        last_updated: '2026-08-03T10:00:00Z',
    };
}

describe('run — happy path', () => {
    it('writes a FeatureCollection built from the loaded export', async () => {
        const loadExport = jest.fn<Promise<GoldExport>, []>().mockResolvedValue(makeExport());
        const scanStatus = jest.fn<Promise<StatusItem[]>, []>().mockResolvedValue([]);
        const writeGeoJson = jest.fn<Promise<void>, [GeoJsonFeatureCollection]>().mockResolvedValue();

        await run(loadExport, scanStatus, writeGeoJson, GENERATED_AT);

        expect(writeGeoJson).toHaveBeenCalledTimes(1);
        const written = writeGeoJson.mock.calls[0]![0];
        expect(written.type).toBe('FeatureCollection');
        expect(written.generated_at).toBe(GENERATED_AT);
        expect(written.features).toHaveLength(1);
        expect(written.features[0]!.id).toBe('CH*TIA*LOC002');
    });

    it('overlays the live DynamoDB status onto the exported EVSE', async () => {
        const loadExport = jest.fn<Promise<GoldExport>, []>().mockResolvedValue(makeExport());
        const scanStatus = jest.fn<Promise<StatusItem[]>, []>().mockResolvedValue([makeStatusItem()]);
        const writeGeoJson = jest.fn<Promise<void>, [GeoJsonFeatureCollection]>().mockResolvedValue();

        await run(loadExport, scanStatus, writeGeoJson, GENERATED_AT);

        // CHARGING live status wins over the export's baked-in AVAILABLE
        const written = writeGeoJson.mock.calls[0]![0];
        expect(written.features[0]!.properties.Availability).toBe('Charging');
    });

    it('calls the steps in order: load, scan, then write', async () => {
        const calls: string[] = [];
        const loadExport = jest.fn(async () => {
            calls.push('load');
            return makeExport();
        });
        const scanStatus = jest.fn(async () => {
            calls.push('scan');
            return [] as StatusItem[];
        });
        const writeGeoJson = jest.fn(async () => {
            calls.push('write');
        });

        await run(loadExport, scanStatus, writeGeoJson, GENERATED_AT);

        expect(calls).toEqual(['load', 'scan', 'write']);
    });
});

describe('run — export failure aborts the run', () => {
    it('propagates the export error and never writes', async () => {
        const loadExport = jest
            .fn<Promise<GoldExport>, []>()
            .mockRejectedValue(new Error('S3 GetObject failed'));
        const scanStatus = jest.fn<Promise<StatusItem[]>, []>().mockResolvedValue([]);
        const writeGeoJson = jest.fn<Promise<void>, [GeoJsonFeatureCollection]>().mockResolvedValue();

        await expect(run(loadExport, scanStatus, writeGeoJson, GENERATED_AT)).rejects.toThrow(
            'S3 GetObject failed',
        );

        expect(writeGeoJson).not.toHaveBeenCalled();
    });
});

describe('run — status scan failure falls back to baked-in status', () => {
    it('still writes using the export baked-in status when the scan fails', async () => {
        const loadExport = jest.fn<Promise<GoldExport>, []>().mockResolvedValue(makeExport());
        const scanStatus = jest
            .fn<Promise<StatusItem[]>, []>()
            .mockRejectedValue(new Error('DynamoDB scan failed'));
        const writeGeoJson = jest.fn<Promise<void>, [GeoJsonFeatureCollection]>().mockResolvedValue();

        await run(loadExport, scanStatus, writeGeoJson, GENERATED_AT);

        expect(writeGeoJson).toHaveBeenCalledTimes(1);
        // With no live status, the export's baked-in AVAILABLE is used
        const written = writeGeoJson.mock.calls[0]![0];
        expect(written.features[0]!.properties.Availability).toBe('Available');
    });

    it('does not propagate the scan error', async () => {
        const loadExport = jest.fn<Promise<GoldExport>, []>().mockResolvedValue(makeExport());
        const scanStatus = jest
            .fn<Promise<StatusItem[]>, []>()
            .mockRejectedValue(new Error('DynamoDB scan failed'));
        const writeGeoJson = jest.fn<Promise<void>, [GeoJsonFeatureCollection]>().mockResolvedValue();

        await expect(run(loadExport, scanStatus, writeGeoJson, GENERATED_AT)).resolves.toBeUndefined();
    });
});