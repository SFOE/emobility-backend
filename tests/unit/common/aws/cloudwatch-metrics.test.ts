import { emitMetric } from '/opt/nodejs/aws/cloudwatch-metrics';

describe('emitMetric (EMF)', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const parseEmitted = (): Record<string, unknown> => {
    expect(logSpy).toHaveBeenCalledTimes(1);
    return JSON.parse(logSpy.mock.calls[0][0] as string);
  };

  it('emits a single EMF line with the declared namespace, metric and dimension sets', () => {
    emitMetric({
      namespace: 'OCPI/Ingestion',
      metricName: 'ObjectsIngested',
      value: 1,
      unit: 'Count',
      dimensionSets: [['type'], ['country_code', 'party_id', 'type']],
      dimensions: { type: 'locations', country_code: 'CH', party_id: 'ABC' },
    });

    const emf = parseEmitted() as {
      _aws: {
        Timestamp: number;
        CloudWatchMetrics: Array<{
          Namespace: string;
          Dimensions: string[][];
          Metrics: Array<{ Name: string; Unit: string }>;
        }>;
      };
    } & Record<string, unknown>;

    expect(emf._aws.CloudWatchMetrics[0].Namespace).toBe('OCPI/Ingestion');
    expect(emf._aws.CloudWatchMetrics[0].Dimensions).toEqual([
      ['type'],
      ['country_code', 'party_id', 'type'],
    ]);
    expect(emf._aws.CloudWatchMetrics[0].Metrics).toEqual([
      { Name: 'ObjectsIngested', Unit: 'Count' },
    ]);
    expect(typeof emf._aws.Timestamp).toBe('number');
  });

  it('places the metric value and every dimension value at the top level', () => {
    emitMetric({
      namespace: 'OCPI/Ingestion',
      metricName: 'ObjectsIngested',
      value: 5,
      dimensionSets: [['type']],
      dimensions: { type: 'tariffs', party_id: 'XYZ' },
      properties: { object_id: 'TARIFF001' },
    });

    const emf = parseEmitted();

    expect(emf.ObjectsIngested).toBe(5);
    expect(emf.type).toBe('tariffs');
    expect(emf.party_id).toBe('XYZ');
    expect(emf.object_id).toBe('TARIFF001');
  });

  it('defaults the unit to Count when none is provided', () => {
    emitMetric({
      namespace: 'OCPI/Ingestion',
      metricName: 'ObjectsIngested',
      value: 1,
      dimensionSets: [['type']],
      dimensions: { type: 'evse' },
    });

    const emf = parseEmitted() as {
      _aws: { CloudWatchMetrics: Array<{ Metrics: Array<{ Unit: string }> }> };
    };

    expect(emf._aws.CloudWatchMetrics[0].Metrics[0].Unit).toBe('Count');
  });

  it('never throws and warns instead when serialization fails', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      emitMetric({
        namespace: 'OCPI/Ingestion',
        metricName: 'ObjectsIngested',
        value: 1,
        dimensionSets: [['type']],
        dimensions: { type: 'locations' },
        properties: circular as Record<string, string | number>,
      }),
    ).not.toThrow();

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
