/**
 * Pure EVSE status overlay – plain objects in, plain objects out, no AWS/network I/O.
 *
 * The DynamoDB partition key ("pk") holds LOCATION#country_code#party_id#location_id
 * and the sort key ("sk") holds EVSE#evse_uid. overlayStatus rebuilds that same
 * composite string per EVSE to look up its live status.
 */

import type {
  GoldEvse,
  GoldLocation,
  OverlayResult,
  StatusByKey,
  StatusItem,
} from './types';

export function parseStatusItems(items: StatusItem[]): StatusByKey {
  return Object.fromEntries(
    items.map((item) => [
      `${item.pk}#${item.sk}`,
      { status: item.status, last_updated: item.last_updated },
    ]),
  );
}

function evseKey(location: GoldLocation, evse: GoldEvse): string {
  return `LOCATION#${location.country_code}#${location.party_id}#${location.id}#EVSE#${evse.evse_uid}`;
}

/**
 * Returns the overlaid locations plus `appliedCount` – the number of EVSEs whose
 * status was actually replaced by a live DynamoDB entry. Comparing that count to
 * the number of scanned status entries surfaces stale/orphaned DynamoDB rows that
 * match no EVSE in the Gold export.
 */
export function overlayStatus(
  locations: GoldLocation[],
  statusByKey: StatusByKey,
): OverlayResult {
  let appliedCount = 0;

  const overlaidLocations = locations.map((location) => ({
    ...location,
    evses: location.evses.map((evse) => {
      const liveStatus = statusByKey[evseKey(location, evse)];
      if (liveStatus === undefined) {
        return evse;
      }
      appliedCount++;
      return { ...evse, status: liveStatus.status };
    }),
  }));

  return { locations: overlaidLocations, appliedCount };
}
