/**
 * Pure GeoJSON/HTML rendering – plain objects in, plain objects out, no AWS/network I/O.
 *
 * User-facing text is language-dependent: pass a `Translations` bundle (`t`).
 * The public entry points default to German so existing German callers/tests
 * keep working; the emitter passes each language explicitly.
 */

import {
  AD_HOC_PAYMENT_TARIFF_TYPE,
  CONNECTOR_STANDARD_LABELS,
  ENERGY_UNIT,
  PRICE_COMPONENT_ORDER,
  PRICE_CURRENCY_FALLBACK,
  RENEWABLE_ENERGY_SOURCE_CATEGORIES,
  STATUS_CATEGORY_MAP,
  STATUS_CSS_CLASS,
} from './lookups';
import { TRANSLATIONS, type Translations } from './translations';
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

// Time suffix appended after a time range (e.g. " Uhr"); empty for languages
// that don't use one.
function clockSuffix(t: Translations): string {
  return t.clockSuffix ? ` ${t.clockSuffix}` : '';
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

function priceComponentUnit(type: string, t: Translations): string {
  switch (type) {
    case 'ENERGY':
      return ENERGY_UNIT;
    case 'FLAT':
      return t.units.charge;
    case 'TIME':
    case 'PARKING_TIME':
      return t.units.minute;
    default:
      return type;
  }
}

function formatTariffPrice(tariff: GoldTariff, t: Translations): string | null {
  const totals = sumPriceComponentsByType(tariffPriceComponents(tariff));
  if (Object.keys(totals).length === 0) {
    return null;
  }
  const currency = tariff.currency || PRICE_CURRENCY_FALLBACK;
  return PRICE_COMPONENT_ORDER.filter((type) => type in totals)
    .map(
      (type) =>
        `${formatG(totals[type]!)} ${currency}/${priceComponentUnit(type, t)}`,
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
  t: Translations,
): string {
  for (const tariffId of connector.tariff_ids ?? []) {
    const tariff = tariffsByIdMap[tariffId];
    if (tariff !== undefined && tariff.type === AD_HOC_PAYMENT_TARIFF_TYPE) {
      const price = formatTariffPrice(tariff, t);
      if (price !== null) {
        return price;
      }
    }
  }
  return t.priceUnavailable;
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

function formatExceptionalPeriod(
  period: { period_begin: string; period_end: string },
  t: Translations,
): string {
  const begin = formatExceptionalDatetime(period.period_begin);
  const end = formatExceptionalDatetime(period.period_end);
  return `${begin}-${end}${clockSuffix(t)}`;
}

function renderExceptionalPeriods(
  openingHours: OpeningHours,
  t: Translations,
): string[] {
  const notes: string[] = [];
  const openings = openingHours.exceptional_openings ?? [];
  if (openings.length > 0) {
    notes.push(
      `${t.additionallyOpen} ` +
        openings.map((p) => formatExceptionalPeriod(p, t)).join(', '),
    );
  }
  const closings = openingHours.exceptional_closings ?? [];
  if (closings.length > 0) {
    notes.push(
      `${t.exceptionallyClosed} ` +
        closings.map((p) => formatExceptionalPeriod(p, t)).join(', '),
    );
  }
  return notes;
}

function renderOpeningHours(
  openingHours: OpeningHours | null,
  t: Translations,
): string {
  if (!openingHours) {
    return t.notSpecified;
  }
  const clock = clockSuffix(t);
  let base: string;
  if (openingHours.twentyfourseven) {
    base = `${t.weekdays[1]}-${t.weekdays[7]}, 0:00-24:00${clock}`;
  } else {
    const regularHours = openingHours.regular_hours ?? [];
    if (regularHours.length === 0) {
      base = t.notSpecified;
    } else {
      const parts = groupWeekdayRanges(regularHours).map((group) => {
        const startLabel =
          t.weekdays[group.start_day] ?? String(group.start_day);
        const endLabel = t.weekdays[group.end_day] ?? String(group.end_day);
        const dayRange =
          group.start_day === group.end_day
            ? startLabel
            : `${startLabel}-${endLabel}`;
        return `${dayRange}, ${group.period_begin}-${group.period_end}${clock}`;
      });
      base = parts.join(', ');
    }
  }
  return [base, ...renderExceptionalPeriods(openingHours, t)].join('; ');
}

function renderPayment(location: GoldLocation, t: Translations): string {
  return location.credit_card_payable || location.debit_card_payable
    ? t.yes
    : t.no;
}

function renderEnergyMix(energyMix: EnergyMix | null, t: Translations): string {
  if (!energyMix) {
    return t.notSpecified;
  }
  const sources = energyMix.energy_sources ?? [];
  if (sources.length === 0) {
    return t.notSpecified;
  }
  const renewablePercentage = sources
    .filter((s) => RENEWABLE_ENERGY_SOURCE_CATEGORIES.has(s.source))
    .reduce((sum, s) => sum + s.percentage, 0);
  return `${formatG(renewablePercentage)}% ${t.renewableSuffix}`;
}

function renderFacilities(
  facilities: string[] | undefined,
  t: Translations,
): string {
  if (!facilities || facilities.length === 0) {
    return t.notSpecified;
  }
  return facilities.map((f) => t.facilities[f] ?? f).join(', ');
}

function renderVehicleTypes(
  vehicleTypes: string[] | undefined,
  t: Translations,
): string {
  if (!vehicleTypes || vehicleTypes.length === 0) {
    return t.infoUnavailable;
  }
  return vehicleTypes.map((v) => t.vehicleTypes[v] ?? v).join(', ');
}

function renderAccessibleEvseCount(
  accessibleEvseCount: string | undefined,
  t: Translations,
): string {
  if (!accessibleEvseCount || accessibleEvseCount.endsWith('/0')) {
    return t.infoUnavailable;
  }
  return accessibleEvseCount;
}

function renderCoordinates(location: GoldLocation): string {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

// Maps the OCPI connector `standard` code to a human-readable label, falling
// back to the raw OCPI code for standards without a friendlier name.
function connectorStandardLabel(standard: string): string {
  return CONNECTOR_STANDARD_LABELS[standard] ?? standard;
}

function renderEvseBlock(
  evse: GoldEvse,
  tariffsByIdMap: Record<string, GoldTariff>,
  t: Translations,
): string {
  const category = statusCategory(evse.status);
  const cssClass = STATUS_CSS_CLASS[category] ?? 'unknown';
  const label = t.status[category] ?? category;
  const connectorRows = evse.connectors
    .map(
      (connector) =>
        `<tr><td>${t.socketPrefix} ${escapeHtml(connectorStandardLabel(connector.standard))}` +
        `<br/>${(connector.max_electric_power / 1000).toFixed(1)}kW` +
        `<br/>${escapeHtml(connectorPrice(connector, tariffsByIdMap, t))}</td></tr>`,
    )
    .join('');
  return (
    `<table class="evse-overview status-${cssClass}">` +
    `<tr><th>${label}</th></tr>` +
    connectorRows +
    `</table>`
  );
}

function renderNetwork(location: GoldLocation, t: Translations): string {
  const operatorName = escapeHtml(location.operator_name ?? t.infoUnavailable);
  if (!location.operator_url) {
    return operatorName;
  }
  return `<a href="${escapeHtml(location.operator_url)}" target="_blank">${operatorName}</a>`;
}

export function renderDescription(
  location: GoldLocation,
  t: Translations = TRANSLATIONS.de,
): string {
  const tariffsByIdMap = indexTariffsById(location.tariffs);
  const evseBlocks = location.evses
    .map((evse) => renderEvseBlock(evse, tariffsByIdMap, t))
    .join('');
  const feedbackIds = escapeHtml(location.evse_ids.join(','));
  const networkLink = renderNetwork(location, t);
  const openingHoursLine = renderOpeningHours(
    parseJsonField<OpeningHours>(location.opening_hours_json),
    t,
  );
  const paymentLine = renderPayment(location, t);
  const facilitiesLine = renderFacilities(location.facilities, t);
  const energyMixLine = renderEnergyMix(
    parseJsonField<EnergyMix>(location.energy_mix_json),
    t,
  );
  const vehicleTypesLine = renderVehicleTypes(location.vehicle_types, t);
  const accessibleEvseCountLine = renderAccessibleEvseCount(
    location.accessible_evse_count,
    t,
  );
  const coordinatesLine = renderCoordinates(location);
  const l = t.labels;

  return (
    `<div class="evse-data">${evseBlocks}</div>` +
    `<div class="station-data"><table><tbody>` +
    `<tr><td class="cell-left">${l.network}</td><td>${networkLink}</td></tr>` +
    `<tr><td class="cell-left">${l.location}</td>` +
    `<td>${escapeHtml(location.address_display)}</td></tr>` +
    `<tr><td class="cell-left">${l.price}</td><td>${l.adHocPrice}</td></tr>` +
    `<tr><td class="cell-left">${l.payment}</td><td>${paymentLine}</td></tr>` +
    `<tr><td class="cell-left">${l.openingHours}</td><td>${escapeHtml(openingHoursLine)}</td></tr>` +
    `<tr><td class="cell-left">${l.vehicleType}</td><td>${escapeHtml(vehicleTypesLine)}</td></tr>` +
    `<tr><td class="cell-left">${l.accessibleEvseCount}</td>` +
    `<td>${escapeHtml(accessibleEvseCountLine)}</td></tr>` +
    `<tr><td class="cell-left">${l.infrastructure}</td><td>${escapeHtml(facilitiesLine)}</td></tr>` +
    `<tr><td class="cell-left">${l.energySource}</td><td>${energyMixLine}</td></tr>` +
    `<tr><td class="cell-left">${l.feedbackQuestion}</td>` +
    `<td><a href="${FEEDBACK_URL}?stationids=${feedbackIds}" ` +
    `target="_blank">${l.feedbackLink}</a></td></tr>` +
    `<tr><td class="cell-left">${l.coordinates}</td><td>${coordinatesLine}</td></tr>` +
    `</tbody></table></div>`
  );
}

export function buildFeature(
  location: GoldLocation,
  t: Translations = TRANSLATIONS.de,
): GeoJsonFeature {
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
      description: renderDescription(location, t),
    },
  };
}

export function buildFeatureCollection(
  locations: GoldLocation[],
  generatedAt: string,
  t: Translations = TRANSLATIONS.de,
): GeoJsonFeatureCollection {
  // Per-location isolation: a single malformed Gold location (e.g. null latitude
  // or invalid opening_hours_json) must not abort the entire national publish.
  // Skip and log the offending location; still emit the rest.
  const features: GeoJsonFeature[] = [];
  let skipped = 0;
  for (const location of locations) {
    try {
      features.push(buildFeature(location, t));
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
