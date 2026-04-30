import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './ocpi-tarrifs-put';
import { buildEvent } from '../../../../test/fixtures/ocpi-tarrifs.fixture';

// Parses the JSON body from a handler result.
function parseBody(result: APIGatewayProxyResult) {
  return JSON.parse(result.body);
}

describe('ocpi-tarrifs-put handler', () => {
  // Bootstrap tokens are single-use for the credentials handshake — not for tariff pushes.
  describe('bootstrap token guard', () => {
    it('rejects with 405 and OCPI 2000 when a bootstrap token is used', async () => {
      const result = await handler(buildEvent({ authContext: { isBootstrap: true, partnerId: 'CPO-XYZ-DE' } }));

      expect(result.statusCode).toBe(405);
      expect(parseBody(result).status_code).toBe(2000);
    });
  });

  // Client Owned Objects: the CPO may only write to its own namespace.
  describe('ownership guard', () => {
    it('rejects with 400 and OCPI 2001 when country_code in body does not match path', async () => {
      const result = await handler(buildEvent({ country_code: 'CH' }));

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });

    it('rejects with 400 and OCPI 2001 when party_id in body does not match path', async () => {
      const result = await handler(buildEvent({ party_id: 'AAA' }));

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });

    it('rejects with 400 and OCPI 2001 when tariff_id in body does not match path', async () => {
      const result = await handler(buildEvent({ tariff_id: 'OTHER-999' }));

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });
  });

  // Full success flow — all guards pass.
  describe('happy path', () => {
    it('returns 200 with OCPI status 1000', async () => {
      const result = await handler(buildEvent());

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).status_code).toBe(1000);
    });

    it('returns data: null per OCPI PUT convention', async () => {
      const result = await handler(buildEvent());

      expect(parseBody(result).data).toBeNull();
    });
  });
});
