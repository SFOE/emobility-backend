/**
 * Pure EVSE status overlay – plain objects in, plain objects out, no AWS/network I/O.
 *
 * The DynamoDB partition key ("pk") holds LOCATION#country_code#party_id#location_id
 * and the sort key ("sk") holds EVSE#evse_uid. overlayStatus rebuilds that same
 * composite string per EVSE to look up its live status.
 */

import type { GoldEvse, GoldLocation, StatusByKey, StatusItem } from './types';

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

export function overlayStatus(locations: GoldLocation[], statusByKey: StatusByKey): GoldLocation[] {
  return locations.map((location) => ({
    ...location,
    evses: location.evses.map((evse) => {
      const liveStatus = statusByKey[evseKey(location, evse)];
      return liveStatus !== undefined ? { ...evse, status: liveStatus.status } : evse;
    }),
  }));
}