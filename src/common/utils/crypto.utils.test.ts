import {generateToken, hashToken} from "./crypto.utils";

describe("generateToken", () => {
    it("returns a 64-char hex string by default (32 bytes)", () => {
        const token = generateToken();
        console.log("token:", token);
        expect(token).toHaveLength(64);
        expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("returns a hex string of the correct length for a custom byte size", () => {
        const token = generateToken(16);
        expect(token).toHaveLength(32);
    });

    it("generates unique tokens on each call", () => {
        const token1 = generateToken();
        const token2 = generateToken();
        expect(token1).not.toBe(token2);
    });
});

describe("hashToken", () => {
    it("returns a 64-char hex SHA-256 hash", () => {
        const hash = hashToken("some-token");
        console.log("hash:", hash);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("returns the same hash for the same input", () => {
        const token = "deterministic-token";
        expect(hashToken(token)).toBe(hashToken(token));
    });

    it("returns different hashes for different inputs", () => {
        expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
    });
});
