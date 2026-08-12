/**
 * CloudWatch Embedded Metric Format (EMF) emitter.
 *
 * Writes a single specially-formatted JSON line to stdout. The Lambda CloudWatch
 * Logs agent parses that line and extracts the declared metrics automatically —
 * there is no `PutMetricData` call and no CloudWatch SDK client involved, so this
 * stays cheap and free of extra network round-trips on the request path.
 *
 * Spec: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
 */

export type MetricUnit = 'Count' | 'Milliseconds' | 'Bytes' | 'None';

export interface EmfMetricInput {
  /** CloudWatch namespace, e.g. `OCPI/Ingestion`. */
  namespace: string;
  /** Metric name, e.g. `ObjectsIngested`. */
  metricName: string;
  /** Numeric value for this data point. */
  value: number;
  /** Metric unit; defaults to `Count`. */
  unit?: MetricUnit;
  /**
   * Each inner array is one dimension combination CloudWatch aggregates on
   * (the cross-product is NOT taken — every combination is listed explicitly).
   * Every key referenced here must be present in `dimensions`.
   */
  dimensionSets: string[][];
  /** Dimension values keyed by dimension name. */
  dimensions: Record<string, string>;
  /** Extra context fields logged alongside the metric but not aggregated on. */
  properties?: Record<string, string | number>;
}

/**
 * Emits one EMF metric line. Never throws: observability must not be able to
 * break the request path, so serialization failures are swallowed with a warning.
 */
export const emitMetric = (input: EmfMetricInput): void => {
  try {
    const {
      namespace,
      metricName,
      value,
      unit = 'Count',
      dimensionSets,
      dimensions,
      properties,
    } = input;

    const emf = {
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: namespace,
            Dimensions: dimensionSets,
            Metrics: [{ Name: metricName, Unit: unit }],
          },
        ],
      },
      ...dimensions,
      ...(properties ?? {}),
      [metricName]: value,
    };

    console.log(JSON.stringify(emf));
  } catch (err) {
    console.warn('[metrics] Failed to emit EMF metric', err);
  }
};
