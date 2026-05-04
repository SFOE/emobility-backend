import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './ocpi-tarrifs-delete';
import { buildDeleteEvent } from '../../../../test/fixtures/ocpi-tarrifs.fixture';

// Parses the JSON body from a handler result.
function parseBody(result: APIGatewayProxyResult) {
  return JSON.parse(result.body);
}

describe('ocpi-tarrifs-delete handler', () => {
  // Bootstrap tokens are single-use for the credentials handshake — not for tariff operations.
  describe('bootstrap token guard', () => {
    it('rejects with 405 and OCPI 2000 when a bootstrap token is used', async () => {
      const result = await handler(buildDeleteEvent({ authContext: { isBootstrap: true, partnerId: 'CPO-XYZ-DE', role: 'CPO' } }));

      expect(result.statusCode).toBe(405);
      expect(parseBody(result).status_code).toBe(2000);
    });
  });

  // Only CPOs are data owners of tariffs per OCPI spec.
  describe('role guard', () => {
    it('rejects with 405 and OCPI 2000 when a non-CPO role deletes a tariff', async () => {
      const result = await handler(buildDeleteEvent({ authContext: { isBootstrap: false, partnerId: 'EMSP-XYZ-DE', role: 'EMSP' } }));

      expect(result.statusCode).toBe(405);
      expect(parseBody(result).status_code).toBe(2000);
    });
  });

  // Client Owned Objects: authenticated party must own the namespace in the path.
  describe('ownership guard', () => {
    it('rejects with 400 and OCPI 2001 when authenticated country_code does not match path', async () => {
      const result = await handler(buildDeleteEvent({ country_code: 'CH' }));

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });

    it('rejects with 400 and OCPI 2001 when authenticated party_id does not match path', async () => {
      const result = await handler(buildDeleteEvent({ party_id: 'AAA' }));

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });
  });

  // Full success flow — all guards pass.
  describe('happy path', () => {
    it('returns 200 with OCPI status 1000', async () => {
      const result = await handler(buildDeleteEvent());

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).status_code).toBe(1000);
    });

    it('returns data: null per OCPI DELETE convention', async () => {
      const result = await handler(buildDeleteEvent());

      expect(parseBody(result).data).toBeNull();
    });
  });
});
