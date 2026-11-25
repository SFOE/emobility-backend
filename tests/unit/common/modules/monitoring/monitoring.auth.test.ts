import {
  emailFromClaims,
  groupsFromClaims,
  hasMonitoringAccess,
  monitoringAllowedEmails,
  monitoringRequiredGroup,
} from '../../../../../src/common/modules/monitoring/monitoring.auth';

const eventWithClaims = (claims: Record<string, unknown>) =>
  ({
    requestContext: { authorizer: { jwt: { claims, scopes: [] } } },
  }) as never;

const eventWithGroups = (groups: unknown) =>
  ({
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groups }, scopes: [] } },
    },
  }) as never;

describe('monitoring.auth', () => {
  const original = {
    MONITORING_REQUIRED_GROUP: process.env.MONITORING_REQUIRED_GROUP,
    MONITORING_ALLOWED_EMAILS: process.env.MONITORING_ALLOWED_EMAILS,
  };
  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe('emailFromClaims', () => {
    it('returns the trimmed, lower-cased email claim', () => {
      expect(emailFromClaims({ email: ' Pauli.Winkelmann@ti8m.ch ' })).toBe(
        'pauli.winkelmann@ti8m.ch',
      );
    });

    it('returns null without a usable claim', () => {
      expect(emailFromClaims(undefined)).toBeNull();
      expect(emailFromClaims({ email: '' })).toBeNull();
      expect(emailFromClaims({ email: 42 })).toBeNull();
    });
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

    it('allows an e-mail address from the list without the group', () => {
      const allowed = ['dev@example.ch'];
      expect(
        hasMonitoringAccess(
          eventWithClaims({
            'cognito:groups': '[other]',
            email: 'Dev@Example.ch',
          }),
          'bfe-all',
          allowed,
        ),
      ).toBe(true);
      expect(
        hasMonitoringAccess(
          eventWithClaims({ email: 'someone@example.ch' }),
          'bfe-all',
          allowed,
        ),
      ).toBe(false);
      expect(hasMonitoringAccess(eventWithClaims({}), 'bfe-all', allowed)).toBe(
        false,
      );
    });

    it('reads the allowed e-mail addresses from MONITORING_ALLOWED_EMAILS', () => {
      process.env.MONITORING_REQUIRED_GROUP = 'bfe-all';
      process.env.MONITORING_ALLOWED_EMAILS = ' A@Example.ch , b@example.ch ,';
      expect(monitoringAllowedEmails()).toEqual([
        'a@example.ch',
        'b@example.ch',
      ]);
      expect(
        hasMonitoringAccess(eventWithClaims({ email: 'a@example.ch' })),
      ).toBe(true);
      delete process.env.MONITORING_ALLOWED_EMAILS;
      expect(
        hasMonitoringAccess(eventWithClaims({ email: 'a@example.ch' })),
      ).toBe(false);
    });
  });
});
