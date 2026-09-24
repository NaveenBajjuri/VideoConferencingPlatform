describe('environment.js server URL resolution', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('falls back to localhost:8000 when REACT_APP_SERVER_URL is not set', () => {
        delete process.env.REACT_APP_SERVER_URL;
        const server = require('./environment').default;
        expect(server).toBe('http://localhost:8000');
    });

    it('uses REACT_APP_SERVER_URL when it is set', () => {
        process.env.REACT_APP_SERVER_URL = 'https://api.example.com';
        const server = require('./environment').default;
        expect(server).toBe('https://api.example.com');
    });
});
