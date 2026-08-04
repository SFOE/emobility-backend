/**
 * Pure GeoJSON/HTML rendering – plain objects in, plain objects out, no AWS/network I/O.
 */

import {
  CONNECTOR_STANDARD_LABELS,
  PRICE_COMPONENT_UNITS,
  PRICE_FALLBACK_TEXT,
  STATUS_CLASS_LABELS,
  UNRESOLVED,
} from './lookups';
import type {
  ConnectorProperties,
  EvseProperties,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GoldConnector,
  GoldEvse,
  GoldLocation,
  GoldTariff,
  GoldTariffPriceComponent,
} from './types';

const PRICE_INFO_URL =
  'https://opendata.swiss/de/dataset/ladepreiskarte-swiss-emobility/' +
  'resource/0e645dcd-d792-4e0e-b06e-d2c719606a09';
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

function renderPriceLine(tariffs: GoldTariff[]): string {
  for (const tariff of tariffs) {
    const price = formatTariffPrice(tariff);
    if (price !== null) return price;
  }
  return PRICE_FALLBACK_TEXT;
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

function parseJsonField(rawJson: string | undefined | null): unknown {
  return rawJson == null ? null : JSON.parse(rawJson);
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

function renderEvseBlock(evse: GoldEvse): string {
  const [cssClass, label] = STATUS_CLASS_LABELS[evse.status] ?? STATUS_CLASS_LABELS['UNKNOWN']!;
  const connectorRows = evse.connectors
    .map((c) => {
      const standardLabel = CONNECTOR_STANDARD_LABELS[c.standard] ?? c.standard;
      return `<tr><td>Steckdose ${standardLabel}<br/>${(c.max_electric_power / 1000).toFixed(1)}kW</td></tr>`;
    })
    .join('');
  return (
    `<table class="evse-overview status-${cssClass}">` +
    `<tr><th>${label}</th></tr>` +
    connectorRows +
    `</table>`
  );
}

// TODO: define real default value for Authentifizierung and Zugang fields
export function renderDescription(location: GoldLocation): string {
  const evseBlocks = location.evses.map(renderEvseBlock).join('');
  const priceLine = renderPriceLine(location.tariffs);
  const feedbackIds = location.evse_ids.join(',');
  const operatorUrl = location.operator_url ?? 'Information not available';
  const operatorName = location.operator_name ?? 'Information not available';
  const networkLink = `<a href="${operatorUrl}" target="_blank">${operatorName}</a>`;

  return (
    `<div class="evse-data">${evseBlocks}</div>` +
    `<div class="station-data"><table><tbody>` +
    `<tr><td class="cell-left">Ladenetzwerk</td><td>${networkLink}</td></tr>` +
    `<tr><td class="cell-left">Standort</td><td>${location.address_display}</td></tr>` +
    `<tr><td class="cell-left">Authentifizierung</td><td>${UNRESOLVED}</td></tr>` +
    `<tr><td class="cell-left"><a href="${PRICE_INFO_URL}" target="_blank">Preis</a></td>` +
    `<td>${priceLine}</td></tr>` +
    `<tr><td class="cell-left">Zugang</td><td>${UNRESOLVED}</td></tr>` +
    `<tr><td class="cell-left">Fehlerhafte Angaben?</td>` +
    `<td><a href="${FEEDBACK_URL}?stationids=${feedbackIds}" target="_blank">Rückmeldung senden</a></td></tr>` +
    `</tbody></table></div>`
  );
}

export function buildFeature(location: GoldLocation): GeoJsonFeature {
  const availability = computeAvailability(location.evses);
  const tariffsByIdMap = indexTariffsById(location.tariffs);
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
      operator: {
        name: location.operator_name,
        url: location.operator_url,
      },
      address: location.address_display,
      credit_card_payable: location.credit_card_payable ?? false,
      debit_card_payable: location.debit_card_payable ?? false,
      opening_hours: parseJsonField(location.opening_hours_json),
      facilities: location.facilities ?? [],
      energy_mix: parseJsonField(location.energy_mix_json),
      tariffs: location.tariffs,
      evses: location.evses.map((evse) => buildEvseProperties(evse, tariffsByIdMap)),
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
