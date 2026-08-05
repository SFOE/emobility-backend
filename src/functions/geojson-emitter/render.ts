/**
 * Pure GeoJSON/HTML rendering – plain objects in, plain objects out, no AWS/network I/O.
 */

import {
  CONNECTOR_STANDARD_LABELS,
  ENERGY_MIX_FALLBACK_TEXT,
  FACILITIES_FALLBACK_TEXT,
  FACILITY_LABELS,
  OPENING_HOURS_FALLBACK_TEXT,
  PAYMENT_FALLBACK_TEXT,
  PRICE_COMPONENT_UNITS,
  PRICE_FALLBACK_TEXT,
  RENEWABLE_ENERGY_SOURCE_CATEGORIES,
  STATUS_CLASS_LABELS,
  WEEKDAY_LABELS,
} from './lookups';
// NOTE: UNRESOLVED is intentionally not imported – the new render_description
// no longer contains placeholder rows (Authentifizierung, Zugang).
import type {
  ConnectorProperties,
  EnergyMix,
  EvseProperties,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GoldConnector,
  GoldEvse,
  GoldLocation,
  GoldTariff,
  GoldTariffPriceComponent,
  OpeningHours,
} from './types';

const FEEDBACK_URL = 'https://www.uvek-gis.admin.ch/BFE/diemo/feedback/';

const AVAILABILITY_PRIORITY = [
  'AVAILABLE',
  'CHARGING',
  'RESERVED',
  'PLANNED',
  'BLOCKED',
  'INOPERATIVE',
  'OUTOFORDER',
];

export function computeAvailability(evses: GoldEvse[]): string {
  const statuses = new Set(evses.map((evse) => evse.status));
  for (const candidate of AVAILABILITY_PRIORITY) {
    if (statuses.has(candidate)) {
      // title-case: first char upper, rest lower (matches Python str.title() for single words)
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }
  }
  return 'Unknown';
}

export function computeSymbology(availability: string): string {
  return `${availability}_UNCLEARWHATTODOHERE`;
}

function formatPriceComponent(component: GoldTariffPriceComponent, currency: string): string {
  const unit = PRICE_COMPONENT_UNITS[component.type] ?? component.type;
  return `${component.price} ${currency}/${unit}`;
}

function tariffPriceComponents(tariff: GoldTariff): GoldTariffPriceComponent[] {
  return tariff.elements.flatMap((element) => element.price_components);
}

function formatTariffPrice(tariff: GoldTariff): string | null {
  const components = tariffPriceComponents(tariff);
  if (components.length === 0) return null;
  return components.map((c) => formatPriceComponent(c, tariff.currency)).join(' + ');
}

function indexTariffsById(tariffs: GoldTariff[]): Record<string, GoldTariff> {
  return Object.fromEntries(
    tariffs
      .filter((t): t is GoldTariff & { id: string } => t.id !== undefined && t.id !== null)
      .map((t) => [t.id, t]),
  );
}

function connectorPrice(
  connector: GoldConnector,
  tariffsByIdMap: Record<string, GoldTariff>,
): string {
  for (const tariffId of connector.tariff_ids ?? []) {
    const tariff = tariffsByIdMap[tariffId];
    if (tariff !== undefined) {
      const price = formatTariffPrice(tariff);
      if (price !== null) return price;
    }
  }
  return PRICE_FALLBACK_TEXT;
}

function parseJsonField<T>(rawJson: string | undefined | null): T | null {
  return rawJson == null ? null : (JSON.parse(rawJson) as T);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface WeekdayGroup {
  start_day: number;
  end_day: number;
  period_begin: string;
  period_end: string;
}

function groupWeekdayRanges(
  regularHours: OpeningHours['regular_hours'] & {},
): WeekdayGroup[] {
  const groups: WeekdayGroup[] = [];
  const sorted = [...regularHours].sort((a, b) => a.weekday - b.weekday);
  for (const hour of sorted) {
    const previous = groups.length > 0 ? groups[groups.length - 1]! : null;
    if (
      previous !== null &&
      previous.period_begin === hour.period_begin &&
      previous.period_end === hour.period_end &&
      previous.end_day === hour.weekday - 1
    ) {
      previous.end_day = hour.weekday;
    } else {
      groups.push({
        start_day: hour.weekday,
        end_day: hour.weekday,
        period_begin: hour.period_begin,
        period_end: hour.period_end,
      });
    }
  }
  return groups;
}

function formatExceptionalDatetime(value: string): string {
  const d = new Date(value);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function formatExceptionalPeriod(period: { period_begin: string; period_end: string }): string {
  const begin = formatExceptionalDatetime(period.period_begin);
  const end = formatExceptionalDatetime(period.period_end);
  return `${begin}-${end} Uhr`;
}

function renderExceptionalPeriods(openingHours: OpeningHours): string[] {
  const notes: string[] = [];
  const openings = openingHours.exceptional_openings ?? [];
  if (openings.length > 0) {
    notes.push('Zusätzlich geöffnet: ' + openings.map(formatExceptionalPeriod).join(', '));
  }
  const closings = openingHours.exceptional_closings ?? [];
  if (closings.length > 0) {
    notes.push('Ausnahmsweise geschlossen: ' + closings.map(formatExceptionalPeriod).join(', '));
  }
  return notes;
}

function renderOpeningHours(openingHours: OpeningHours | null): string {
  if (!openingHours) return OPENING_HOURS_FALLBACK_TEXT;
  let base: string;
  if (openingHours.twentyfourseven) {
    base = 'Mo-So, 0:00-24:00 Uhr';
  } else {
    const regularHours = openingHours.regular_hours ?? [];
    if (regularHours.length === 0) {
      base = OPENING_HOURS_FALLBACK_TEXT;
    } else {
      const parts = groupWeekdayRanges(regularHours).map((group) => {
        const startLabel = WEEKDAY_LABELS[group.start_day] ?? String(group.start_day);
        const endLabel = WEEKDAY_LABELS[group.end_day] ?? String(group.end_day);
        const dayRange =
          group.start_day === group.end_day ? startLabel : `${startLabel}-${endLabel}`;
        return `${dayRange}, ${group.period_begin}-${group.period_end} Uhr`;
      });
      base = parts.join(', ');
    }
  }
  return [base, ...renderExceptionalPeriods(openingHours)].join('; ');
}

function renderPayment(location: GoldLocation): string {
  const methods: string[] = [];
  if (location.credit_card_payable) methods.push('Kreditkarte');
  if (location.debit_card_payable) methods.push('Debitkarte');
  return methods.length > 0 ? methods.join(', ') : PAYMENT_FALLBACK_TEXT;
}

function renderEnergyMix(energyMix: EnergyMix | null): string {
  if (!energyMix) return ENERGY_MIX_FALLBACK_TEXT;
  const sources = energyMix.energy_sources ?? [];
  if (sources.length === 0) return ENERGY_MIX_FALLBACK_TEXT;
  const renewablePercentage = sources
    .filter((s) => RENEWABLE_ENERGY_SOURCE_CATEGORIES.has(s.source))
    .reduce((sum, s) => sum + s.percentage, 0);
  // Strip trailing zeros like Python's :g format specifier
  const formatted = parseFloat(renewablePercentage.toPrecision(6)).toString();
  return `${formatted}% erneuerbar`;
}

function renderFacilities(facilities: string[] | undefined): string {
  if (!facilities || facilities.length === 0) return FACILITIES_FALLBACK_TEXT;
  return facilities.map((f) => FACILITY_LABELS[f] ?? f).join(', ');
}

function renderCoordinates(location: GoldLocation): string {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

function renderNetwork(location: GoldLocation): string {
  const operatorName = escapeHtml(location.operator_name ?? 'Information not available');
  if (!location.operator_url) return operatorName;
  return `<a href="${escapeHtml(location.operator_url)}" target="_blank">${operatorName}</a>`;
}

export function buildConnectorProperties(
  connector: GoldConnector,
  tariffsByIdMap: Record<string, GoldTariff>,
): ConnectorProperties {
  return {
    connector_id: connector.connector_id,
    standard: connector.standard,
    standard_label: CONNECTOR_STANDARD_LABELS[connector.standard] ?? connector.standard,
    max_electric_power: connector.max_electric_power,
    price: connectorPrice(connector, tariffsByIdMap),
  };
}

export function buildEvseProperties(
  evse: GoldEvse,
  tariffsByIdMap: Record<string, GoldTariff>,
): EvseProperties {
  const status = evse.status ?? 'UNKNOWN';
  const [, statusLabel] = STATUS_CLASS_LABELS[status] ?? STATUS_CLASS_LABELS['UNKNOWN']!;
  return {
    evse_id: evse.evse_id,
    status,
    status_label: statusLabel,
    connectors: evse.connectors.map((c) => buildConnectorProperties(c, tariffsByIdMap)),
  };
}

function renderEvseBlock(evse: GoldEvse, tariffsByIdMap: Record<string, GoldTariff>): string {
  const status = evse.status ?? 'UNKNOWN';
  const [cssClass, label] = STATUS_CLASS_LABELS[status] ?? STATUS_CLASS_LABELS['UNKNOWN']!;
  const connectorRows = evse.connectors
    .map((c) => {
      const standardLabel = escapeHtml(CONNECTOR_STANDARD_LABELS[c.standard] ?? c.standard);
      const price = escapeHtml(connectorPrice(c, tariffsByIdMap));
      return (
        `<tr><td>Steckdose ${standardLabel}` +
        `<br/>${(c.max_electric_power / 1000).toFixed(1)}kW` +
        `<br/>${price}</td></tr>`
      );
    })
    .join('');
  return (
    `<table class="evse-overview status-${cssClass}">` +
    `<tr><th>${label}</th></tr>` +
    connectorRows +
    `</table>`
  );
}

export function renderDescription(location: GoldLocation): string {
  const tariffsByIdMap = indexTariffsById(location.tariffs);
  const evseBlocks = location.evses.map((evse) => renderEvseBlock(evse, tariffsByIdMap)).join('');
  const feedbackIds = escapeHtml(location.evse_ids.join(','));
  const networkLink = renderNetwork(location);
  const openingHoursLine = escapeHtml(
    renderOpeningHours(parseJsonField<OpeningHours>(location.opening_hours_json)),
  );
  const paymentLine = renderPayment(location);
  const facilitiesLine = escapeHtml(renderFacilities(location.facilities));
  const energyMixLine = renderEnergyMix(parseJsonField<EnergyMix>(location.energy_mix_json));
  const coordinatesLine = renderCoordinates(location);

  return (
    `<div class="evse-data">${evseBlocks}</div>` +
    `<div class="station-data"><table><tbody>` +
    `<tr><td class="cell-left">Ladenetzwerk</td><td>${networkLink}</td></tr>` +
    `<tr><td class="cell-left">Standort</td><td>${escapeHtml(location.address_display)}</td></tr>` +
    `<tr><td class="cell-left">Bezahlmöglichkeiten</td><td>${paymentLine}</td></tr>` +
    `<tr><td class="cell-left">Öffnungszeiten</td><td>${openingHoursLine}</td></tr>` +
    `<tr><td class="cell-left">Infrastruktur</td><td>${facilitiesLine}</td></tr>` +
    `<tr><td class="cell-left">Energiequelle</td><td>${energyMixLine}</td></tr>` +
    `<tr><td class="cell-left">Fehlerhafte Angaben?</td>` +
    `<td><a href="${FEEDBACK_URL}?stationids=${feedbackIds}" target="_blank">Rückmeldung senden</a></td></tr>` +
    `<tr><td class="cell-left">Geokoordinaten</td><td>${coordinatesLine}</td></tr>` +
    `</tbody></table></div>`
  );
}

export function buildFeature(location: GoldLocation): GeoJsonFeature {
  const availability = computeAvailability(location.evses);
  return {
    type: 'Feature',
    id: location.full_location_id,
    geometry: {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
    },
    properties: {
      location_id: location.full_location_id,
      Availability: availability,
      symbology: computeSymbology(availability),
      description: renderDescription(location),
    },
  };
}

export function buildFeatureCollection(
  locations: GoldLocation[],
  generatedAt: string,
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    generated_at: generatedAt,
    features: locations.map(buildFeature),
  };
}
