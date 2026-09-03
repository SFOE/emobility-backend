/**
 * Pure GeoJSON/HTML rendering – plain objects in, plain objects out, no AWS/network I/O.
 */

import {
  ACCESSIBLE_EVSE_COUNT_FALLBACK_TEXT,
  AD_HOC_PAYMENT_TARIFF_TYPE,
  ENERGY_MIX_FALLBACK_TEXT,
  FACILITIES_FALLBACK_TEXT,
  FACILITY_LABELS,
  OPENING_HOURS_FALLBACK_TEXT,
  PRICE_COMPONENT_ORDER,
  PRICE_COMPONENT_UNITS,
  PRICE_CURRENCY_FALLBACK,
  PRICE_FALLBACK_TEXT,
  RENEWABLE_ENERGY_SOURCE_CATEGORIES,
  STATUS_CATEGORY_MAP,
  STATUS_CLASS_LABELS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPES_FALLBACK_TEXT,
  WEEKDAY_LABELS,
} from './lookups';
import type {
  EnergyMix,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GoldConnector,
  GoldEvse,
  GoldLocation,
  GoldTariff,
  GoldTariffPriceComponent,
  OpeningHours,
} from './types';

const FAST_CHARGE_THRESHOLD_W = 50_000;
const FEEDBACK_URL = 'https://www.uvek-gis.admin.ch/BFE/diemo/feedback/';
const AVAILABILITY_PRIORITY = [
  'AVAILABLE',
  'CHARGING',
  'RESERVED',
  'OUTOFORDER',
  'UNKNOWN',
];

function statusCategory(status: string | undefined): string {
  return (status !== undefined && STATUS_CATEGORY_MAP[status]) || 'UNKNOWN';
}

function formatG(value: number): string {
  return parseFloat(value.toPrecision(6)).toString();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function computeAvailability(evses: GoldEvse[]): string {
  const categories = new Set(evses.map((evse) => statusCategory(evse.status)));
  for (const candidate of AVAILABILITY_PRIORITY) {
    if (categories.has(candidate)) {
      return (
        candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase()
      );
    }
  }
  return 'Unknown';
}

export function computeSymbology(
  availability: string,
  evses: GoldEvse[],
): string {
  const hasFastCharger = evses.some((evse) =>
    (evse.connectors ?? []).some(
      (connector) =>
        (connector.max_electric_power || 0) >= FAST_CHARGE_THRESHOLD_W,
    ),
  );
  return `${availability}_${hasFastCharger ? 'True' : 'False'}`;
}

function tariffPriceComponents(tariff: GoldTariff): GoldTariffPriceComponent[] {
  return tariff.elements.flatMap((element) => element.price_components);
}

function sumPriceComponentsByType(
  components: GoldTariffPriceComponent[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const component of components) {
    totals[component.type] = (totals[component.type] ?? 0) + component.price;
  }
  return totals;
}

function formatTariffPrice(tariff: GoldTariff): string | null {
  const totals = sumPriceComponentsByType(tariffPriceComponents(tariff));
  if (Object.keys(totals).length === 0) {
    return null;
  }
  const currency = tariff.currency || PRICE_CURRENCY_FALLBACK;
  return PRICE_COMPONENT_ORDER.filter((type) => type in totals)
    .map(
      (type) =>
        `${formatG(totals[type]!)} ${currency}/${PRICE_COMPONENT_UNITS[type]}`,
    )
    .join(' + ');
}

function indexTariffsById(tariffs: GoldTariff[]): Record<string, GoldTariff> {
  return Object.fromEntries(
    tariffs
      .filter((t) => t.id !== undefined && t.id !== null)
      .map((t) => [t.id, t]),
  );
}

function connectorPrice(
  connector: GoldConnector,
  tariffsByIdMap: Record<string, GoldTariff>,
): string {
  for (const tariffId of connector.tariff_ids ?? []) {
    const tariff = tariffsByIdMap[tariffId];
    if (tariff !== undefined && tariff.type === AD_HOC_PAYMENT_TARIFF_TYPE) {
      const price = formatTariffPrice(tariff);
      if (price !== null) {
        return price;
      }
    }
  }
  return PRICE_FALLBACK_TEXT;
}

function parseJsonField<T>(rawJson: string | undefined | null): T | null {
  return rawJson == null ? null : (JSON.parse(rawJson) as T);
}

interface WeekdayGroup {
  start_day: number;
  end_day: number;
  period_begin: string;
  period_end: string;
}

function groupWeekdayRanges(
  regularHours: Array<{
    weekday: number;
    period_begin: string;
    period_end: string;
  }>,
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

function formatExceptionalPeriod(period: {
  period_begin: string;
  period_end: string;
}): string {
  const begin = formatExceptionalDatetime(period.period_begin);
  const end = formatExceptionalDatetime(period.period_end);
  return `${begin}-${end} Uhr`;
}

function renderExceptionalPeriods(openingHours: OpeningHours): string[] {
  const notes: string[] = [];
  const openings = openingHours.exceptional_openings ?? [];
  if (openings.length > 0) {
    notes.push(
      'Zusätzlich geöffnet: ' +
        openings.map(formatExceptionalPeriod).join(', '),
    );
  }
  const closings = openingHours.exceptional_closings ?? [];
  if (closings.length > 0) {
    notes.push(
      'Ausnahmsweise geschlossen: ' +
        closings.map(formatExceptionalPeriod).join(', '),
    );
  }
  return notes;
}

function renderOpeningHours(openingHours: OpeningHours | null): string {
  if (!openingHours) {
    return OPENING_HOURS_FALLBACK_TEXT;
  }
  let base: string;
  if (openingHours.twentyfourseven) {
    base = 'Mo-So, 0:00-24:00 Uhr';
  } else {
    const regularHours = openingHours.regular_hours ?? [];
    if (regularHours.length === 0) {
      base = OPENING_HOURS_FALLBACK_TEXT;
    } else {
      const parts = groupWeekdayRanges(regularHours).map((group) => {
        const startLabel =
          WEEKDAY_LABELS[group.start_day] ?? String(group.start_day);
        const endLabel = WEEKDAY_LABELS[group.end_day] ?? String(group.end_day);
        const dayRange =
          group.start_day === group.end_day
            ? startLabel
            : `${startLabel}-${endLabel}`;
        return `${dayRange}, ${group.period_begin}-${group.period_end} Uhr`;
      });
      base = parts.join(', ');
    }
  }
  return [base, ...renderExceptionalPeriods(openingHours)].join('; ');
}

function renderPayment(location: GoldLocation): string {
  return location.credit_card_payable || location.debit_card_payable
    ? 'Ja'
    : 'Nein';
}

function renderEnergyMix(energyMix: EnergyMix | null): string {
  if (!energyMix) {
    return ENERGY_MIX_FALLBACK_TEXT;
  }
  const sources = energyMix.energy_sources ?? [];
  if (sources.length === 0) {
    return ENERGY_MIX_FALLBACK_TEXT;
  }
  const renewablePercentage = sources
    .filter((s) => RENEWABLE_ENERGY_SOURCE_CATEGORIES.has(s.source))
    .reduce((sum, s) => sum + s.percentage, 0);
  return `${formatG(renewablePercentage)}% erneuerbar`;
}

function renderFacilities(facilities: string[] | undefined): string {
  if (!facilities || facilities.length === 0) {
    return FACILITIES_FALLBACK_TEXT;
  }
  return facilities.map((f) => FACILITY_LABELS[f] ?? f).join(', ');
}

function renderVehicleTypes(vehicleTypes: string[] | undefined): string {
  if (!vehicleTypes || vehicleTypes.length === 0) {
    return VEHICLE_TYPES_FALLBACK_TEXT;
  }
  return vehicleTypes.map((v) => VEHICLE_TYPE_LABELS[v] ?? v).join(', ');
}

function renderAccessibleEvseCount(
  accessibleEvseCount: string | undefined,
): string {
  if (!accessibleEvseCount || accessibleEvseCount.endsWith('/0')) {
    return ACCESSIBLE_EVSE_COUNT_FALLBACK_TEXT;
  }
  return accessibleEvseCount;
}

function renderCoordinates(location: GoldLocation): string {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

function renderEvseBlock(
  evse: GoldEvse,
  tariffsByIdMap: Record<string, GoldTariff>,
): string {
  const category = statusCategory(evse.status);
  const [cssClass, label] = STATUS_CLASS_LABELS[category]!;
  const connectorRows = evse.connectors
    .map(
      (connector) =>
        `<tr><td>Steckdose ${escapeHtml(connector.standard)}` +
        `<br/>${(connector.max_electric_power / 1000).toFixed(1)}kW` +
        `<br/>${escapeHtml(connectorPrice(connector, tariffsByIdMap))}</td></tr>`,
    )
    .join('');
  return (
    `<table class="evse-overview status-${cssClass}">` +
    `<tr><th>${label}</th></tr>` +
    connectorRows +
    `</table>`
  );
}

function renderNetwork(location: GoldLocation): string {
  const operatorName = escapeHtml(
    location.operator_name ?? 'Information not available',
  );
  if (!location.operator_url) {
    return operatorName;
  }
  return `<a href="${escapeHtml(location.operator_url)}" target="_blank">${operatorName}</a>`;
}

export function renderDescription(location: GoldLocation): string {
  const tariffsByIdMap = indexTariffsById(location.tariffs);
  const evseBlocks = location.evses
    .map((evse) => renderEvseBlock(evse, tariffsByIdMap))
    .join('');
  const feedbackIds = escapeHtml(location.evse_ids.join(','));
  const networkLink = renderNetwork(location);
  const openingHoursLine = renderOpeningHours(
    parseJsonField<OpeningHours>(location.opening_hours_json),
  );
  const paymentLine = renderPayment(location);
  const facilitiesLine = renderFacilities(location.facilities);
  const energyMixLine = renderEnergyMix(
    parseJsonField<EnergyMix>(location.energy_mix_json),
  );
  const vehicleTypesLine = renderVehicleTypes(location.vehicle_types);
  const accessibleEvseCountLine = renderAccessibleEvseCount(
    location.accessible_evse_count,
  );
  const coordinatesLine = renderCoordinates(location);

  return (
    `<div class="evse-data">${evseBlocks}</div>` +
    `<div class="station-data"><table><tbody>` +
    `<tr><td class="cell-left">Ladenetzwerk</td><td>${networkLink}</td></tr>` +
    `<tr><td class="cell-left">Standort</td>` +
    `<td>${escapeHtml(location.address_display)}</td></tr>` +
    `<tr><td class="cell-left">Bezahlmöglichkeit Kredit-/Debitkarte</td><td>${paymentLine}</td></tr>` +
    `<tr><td class="cell-left">Öffnungszeiten</td><td>${escapeHtml(openingHoursLine)}</td></tr>` +
    `<tr><td class="cell-left">Fahrzeugtyp</td><td>${escapeHtml(vehicleTypesLine)}</td></tr>` +
    `<tr><td class="cell-left">Anzahl Ladepunkte für Menschen mit Beeinträchtigung</td>` +
    `<td>${escapeHtml(accessibleEvseCountLine)}</td></tr>` +
    `<tr><td class="cell-left">Infrastruktur</td><td>${escapeHtml(facilitiesLine)}</td></tr>` +
    `<tr><td class="cell-left">Energiequelle</td><td>${energyMixLine}</td></tr>` +
    `<tr><td class="cell-left">Fehlerhafte Angaben?</td>` +
    `<td><a href="${FEEDBACK_URL}?stationids=${feedbackIds}" ` +
    `target="_blank">Rückmeldung senden</a></td></tr>` +
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
      symbology: computeSymbology(availability, location.evses),
      description: renderDescription(location),
    },
  };
}

export function buildFeatureCollection(
  locations: GoldLocation[],
  generatedAt: string,
): GeoJsonFeatureCollection {
  // Per-location isolation: a single malformed Gold location (e.g. null latitude
  // or invalid opening_hours_json) must not abort the entire national publish.
  // Skip and log the offending location; still emit the rest.
  const features: GeoJsonFeature[] = [];
  let skipped = 0;
  for (const location of locations) {
    try {
      features.push(buildFeature(location));
    } catch (err) {
      skipped++;
      console.error(
        `[geojson-emitter] Skipped location ${location?.full_location_id ?? '<unknown>'} — feature build failed: ${err}`,
      );
    }
  }
  if (skipped > 0) {
    console.warn(
      `[geojson-emitter] Built ${features.length} features, skipped ${skipped} of ${locations.length} locations`,
    );
  }
  return {
    type: 'FeatureCollection',
    name: 'Charging points for electric cars',
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    generated_at: generatedAt,
    features,
  };
}
