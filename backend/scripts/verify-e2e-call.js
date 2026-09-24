import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";
import { connectToSocket } from "../dist/controllers/socketManager.js";
import logger from "../dist/utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bundlePath = join(__dirname, "bundle.js");
const bundleContent = readFileSync(bundlePath, "utf-8");

const htmlContent = `<!DOCTYPE html>
<html>
<head><title>SFU E2E Test</title></head>
<body>
  <h1>SFU Browser Test Tab</h1>
  <script src="/bundle.js"></script>
</body>
</html>`;

async function run() {
    console.log("=== Starting Mediasoup SFU Multi-Tab Browser E2E Test ===");

    // 1. Start test HTTP & Socket.IO server
    const server = createServer((req, res) => {
        if (req.url === "/bundle.js") {
            res.writeHead(200, { "Content-Type": "application/javascript" });
            res.end(bundleContent);
        } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(htmlContent);
        }
    });

    connectToSocket(server);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const serverUrl = `http://127.0.0.1:${port}`;
    console.log(`[Server] Live on ${serverUrl}`);

    // 2. Launch headless Chrome with fake media devices
    console.log("[Browser] Launching Headless Chrome with fake media devices...");
    const browser = await puppeteer.launch({
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: "new",
        args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-web-security",
            "--allow-file-access-from-files",
        ],
    });

    const room = `e2e-room-${Date.now()}`;

    try {
        // Tab A: Alice
        console.log("\n--- [Test 1] Alice joins room ---");
        const pageAlice = await browser.newPage();
        pageAlice.on("console", (msg) => console.log(`[Alice Console] ${msg.text()}`));
        pageAlice.on("pageerror", (err) => console.error(`[Alice Error] ${err.message}`));
        await pageAlice.goto(serverUrl);
        await pageAlice.evaluate(
            (url, r) => window.initCall(url, r, "Alice"),
            serverUrl,
            room
        );

        // Wait for Alice producers
        await pageAlice.waitForFunction(
            () => window.callState?.producers?.mic && window.callState?.producers?.webcam,
            { timeout: 15000 }
        );
        const aliceProducers = await pageAlice.evaluate(() => window.callState.producers);
        console.log(`✓ Alice produced mic (${aliceProducers.mic}) and webcam (${aliceProducers.webcam})`);

        // Tab B: Bob
        console.log("\n--- [Test 2] Bob joins room & media flows both ways ---");
        const pageBob = await browser.newPage();
        pageBob.on("console", (msg) => console.log(`[Bob Console] ${msg.text()}`));
        pageBob.on("pageerror", (err) => console.error(`[Bob Error] ${err.message}`));
        await pageBob.goto(serverUrl);
        await pageBob.evaluate(
            (url, r) => window.initCall(url, r, "Bob"),
            serverUrl,
            room
        );

        // Wait for Bob producers
        await pageBob.waitForFunction(
            () => window.callState?.producers?.mic && window.callState?.producers?.webcam,
            { timeout: 15000 }
        );
        const bobProducers = await pageBob.evaluate(() => window.callState.producers);
        console.log(`✓ Bob produced mic (${bobProducers.mic}) and webcam (${bobProducers.webcam})`);

        // Assert Bob consumes Alice's 2 streams
        await pageBob.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length >= 2,
            { timeout: 15000 }
        );
        console.log("✓ Bob is consuming Alice's mic and webcam streams");

        // Assert Alice consumes Bob's 2 streams
        await pageAlice.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length >= 2,
            { timeout: 15000 }
        );
        console.log("✓ Alice is consuming Bob's mic and webcam streams");

        // --- Test 3: Camera replacement / background blur simulation ---
        console.log("\n--- [Test 3] Video track replacement (Camera swap / background blur) ---");
        const replaced = await pageAlice.evaluate(() => window.replaceVideoTrack());
        if (!replaced) throw new Error("replaceVideoTrack failed");
        console.log("✓ Alice successfully replaced video track on send transport without renegotiation");

        // --- Test 4: Screen Share start & stop ---
        console.log("\n--- [Test 4] Screen Share publish and teardown ---");
        const screenProducerId = await pageAlice.evaluate(() => window.startScreenShare());
        console.log(`Alice started screen share (Producer ID: ${screenProducerId})`);

        // Bob should consume the screen producer -> 3 consumers
        await pageBob.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length === 3,
            { timeout: 15000 }
        );
        console.log("✓ Bob consumed Alice's screen share stream (3 active consumers)");

        // Alice stops screen share
        await pageAlice.evaluate(() => window.stopScreenShare());
        console.log("Alice stopped screen share");

        // Bob should receive producer-closed and clean up -> 2 consumers
        await pageBob.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length === 2,
            { timeout: 15000 }
        );
        console.log("✓ Bob handled producer-closed event and cleaned up consumer (2 active consumers)");

        // --- Test 5: 3+ Participant Star Topology ---
        console.log("\n--- [Test 5] Third participant (Charlie) joins - 3-party star topology ---");
        const pageCharlie = await browser.newPage();
        await pageCharlie.goto(serverUrl);
        await pageCharlie.evaluate(
            (url, r) => window.initCall(url, r, "Charlie"),
            serverUrl,
            room
        );

        await pageCharlie.waitForFunction(
            () => window.callState?.producers?.mic && window.callState?.producers?.webcam,
            { timeout: 15000 }
        );
        console.log("✓ Charlie produced mic and webcam");

        // Charlie should consume Alice (2) + Bob (2) = 4 consumers
        await pageCharlie.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length === 4,
            { timeout: 15000 }
        );
        console.log("✓ Charlie is consuming both Alice and Bob (4 active consumers)");

        // Alice and Bob should now each have 4 consumers (2 from each other + 2 from Charlie)
        await pageAlice.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length === 4,
            { timeout: 15000 }
        );
        await pageBob.waitForFunction(
            () => Object.keys(window.callState?.consumers || {}).length === 4,
            { timeout: 15000 }
        );
        console.log("✓ Alice and Bob are both consuming Charlie (4 active consumers each)");

        // --- Test 6: Collaborative Whiteboard Sync ---
        console.log("\n--- [Test 6] Real-time Collaborative Whiteboard sync ---");
        await pageAlice.evaluate(() => {
            window.drawWhiteboard({
                type: "draw",
                prevX: 10,
                prevY: 10,
                currX: 50,
                currY: 50,
                color: "#1976d2",
                width: 3,
                isEraser: false,
            });
        });
        await pageBob.waitForFunction(
            () => (window.callState?.wbActions || []).length > 0,
            { timeout: 10000 }
        );
        console.log("✓ Bob received Alice's whiteboard drawing stroke in real-time");

        await pageAlice.evaluate(() => window.clearWhiteboard());
        await pageBob.waitForFunction(
            () => window.callState?.wbCleared === true,
            { timeout: 10000 }
        );
        console.log("✓ Bob received whiteboard clear event");

        // --- Test 7: In-Call Live Polls ---
        console.log("\n--- [Test 7] In-Call Live Polls (Creation & Voting) ---");
        const pollRes = await pageAlice.evaluate(() => {
            return window.createPoll("What is your favorite feature?", ["SFU", "Whiteboard", "Polls"]);
        });
        if (!pollRes || !pollRes.poll) throw new Error("createPoll failed");
        const pollId = pollRes.poll.id;
        console.log(`Alice created poll "${pollRes.poll.question}" (ID: ${pollId})`);

        await pageBob.waitForFunction(
            (id) => (window.callState?.polls || []).some((p) => p.id === id),
            { timeout: 10000 },
            pollId
        );
        console.log("✓ Bob received the new poll broadcast");

        // Bob votes for option 1
        await pageBob.evaluate((id) => window.votePoll(id, 1), pollId);
        // Charlie votes for option 2
        await pageCharlie.evaluate((id) => window.votePoll(id, 2), pollId);

        // Verify votes updated across all participants
        await pageAlice.waitForFunction(
            (id) => {
                const poll = (window.callState?.polls || []).find((p) => p.id === id);
                return poll && poll.options[0].votes === 1 && poll.options[1].votes === 1;
            },
            { timeout: 10000 },
            pollId
        );
        console.log("✓ Alice observed Bob and Charlie's live votes updated in real-time");

        // Alice ends the poll
        await pageAlice.evaluate((id) => window.endPoll(id), pollId);
        await pageBob.waitForFunction(
            (id) => {
                const poll = (window.callState?.polls || []).find((p) => p.id === id);
                return poll && poll.active === false;
            },
            { timeout: 10000 },
            pollId
        );
        console.log("✓ Poll successfully ended and finalized across all participants");

        // --- Test 8: Active Speaker & Audio Level Detection ---
        console.log("\n--- [Test 8] Active Speaker Detection via Mediasoup AudioLevelObserver ---");
        await pageBob.waitForFunction(
            () => (window.callState?.activeSpeakers || []).length > 0,
            { timeout: 10000 }
        );
        const speakerEvent = await pageBob.evaluate(() => window.callState.activeSpeakers[0]);
        console.log(`✓ Active speaker detected by mediasoup SFU observer (Socket: ${speakerEvent.socketId}, Volume: ${speakerEvent.volume ?? 'detected'})`);

        console.log("\n=======================================================");
        console.log("🎉 ALL REAL-BROWSER MULTI-TAB E2E TESTS PASSED SUCCESSFULLY! 🎉");
        console.log("=======================================================\n");

    } catch (err) {
        console.error("❌ E2E Test Execution Error:", err);
        throw err;
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

run().then(() => {
    process.exit(0);
}).catch((err) => {
    process.exit(1);
});
