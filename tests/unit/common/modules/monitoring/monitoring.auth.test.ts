import {
  groupsFromClaims,
  hasMonitoringAccess,
  monitoringRequiredGroup,
} from '../../../../../src/common/modules/monitoring/monitoring.auth';

const eventWithGroups = (groups: unknown) =>
  ({
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groups }, scopes: [] } },
    },
  }) as never;

describe('monitoring.auth', () => {
  const original = process.env.MONITORING_REQUIRED_GROUP;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.MONITORING_REQUIRED_GROUP;
    } else {
      process.env.MONITORING_REQUIRED_GROUP = original;
    }
  });

  describe('groupsFromClaims', () => {
    it('parses the bracketed string API Gateway passes for array claims', () => {
      expect(
        groupsFromClaims({ 'cognito:groups': '[bfe-all wasta-prod-admin]' }),
      ).toEqual(['bfe-all', 'wasta-prod-admin']);
    });

    it('accepts a real array and a single group', () => {
      expect(groupsFromClaims({ 'cognito:groups': ['bfe-all'] })).toEqual([
        'bfe-all',
      ]);
      expect(groupsFromClaims({ 'cognito:groups': 'bfe-all' })).toEqual([
        'bfe-all',
      ]);
    });

    it('returns no groups without the claim', () => {
      expect(groupsFromClaims(undefined)).toEqual([]);
      expect(groupsFromClaims({})).toEqual([]);
      expect(groupsFromClaims({ 'cognito:groups': '[]' })).toEqual([]);
    });
  });

  describe('hasMonitoringAccess', () => {
    it('allows everyone when no group is required', () => {
      expect(hasMonitoringAccess(undefined, '')).toBe(true);
    });

    it('requires the group in the token', () => {
      expect(hasMonitoringAccess(eventWithGroups('[bfe-all]'), 'bfe-all')).toBe(
        true,
      );
      expect(hasMonitoringAccess(eventWithGroups('[other]'), 'bfe-all')).toBe(
        false,
      );
      expect(hasMonitoringAccess({} as never, 'bfe-all')).toBe(false);
      expect(hasMonitoringAccess(undefined, 'bfe-all')).toBe(false);
    });

    it('reads the required group from MONITORING_REQUIRED_GROUP', () => {
      process.env.MONITORING_REQUIRED_GROUP = ' bfe-all ';
      expect(monitoringRequiredGroup()).toBe('bfe-all');
      expect(hasMonitoringAccess(eventWithGroups('[other]'))).toBe(false);
      delete process.env.MONITORING_REQUIRED_GROUP;
      expect(hasMonitoringAccess(eventWithGroups('[other]'))).toBe(true);
    });
  });
});
