import test from "node:test";
import assert from "node:assert/strict";
import { fetchOfficialPages } from "../server/ai/official-pages.mjs";

const firstUrl = "https://www.uscis.gov/example";
const htmlResponse = (text, options = {}) => new Response(text, {
  headers: { "content-type": "text/html; charset=utf-8" }, ...options
});
const page = "<html><head><title>Official &amp; useful</title></head><body><main><p>Readable reference &amp; more.</p></main></body></html>";

test("official pages contain fetched readable text and metadata, not active markup or chrome", async () => {
  let request;
  const results = await fetchOfficialPages([firstUrl], { fetchImpl: async (url, options) => {
    request = { url, options };
    return htmlResponse(page.replace("<main>", "<script>privateScript()</script><style>.secret{}</style><nav>Navigation</nav><div hidden>Hidden</div><main>"));
  } });
  assert.equal(results.length, 1);
  assert.equal(results[0].url, firstUrl);
  assert.equal(results[0].title, "Official & useful");
  assert.equal(results[0].text, "Readable reference & more.");
  assert.ok(Number.isFinite(Date.parse(results[0].checkedAt)));
  assert.equal(results[0].requestedUrl, undefined);
  assert.equal(request.options.redirect, "manual");
  assert.equal(request.options.credentials, "omit");
  assert.deepEqual(Object.keys(request.options.headers), ["Accept"]);
});

test("only HTTPS agency URLs without credentials, nonstandard ports, or spoofed hosts can be fetched", async () => {
  const invalid = [
    "http://www.uscis.gov/example", "https://uscis.gov.evil.example/", "https://eviluscis.gov/",
    "https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://user:secret@uscis.gov/",
    "https://uscis.gov:8443/", "file:///etc/passwd", "/relative", null, {}
  ];
  const calls = [];
  const pages = await fetchOfficialPages([...invalid, firstUrl, `${firstUrl}#anchor`], {
    fetchImpl: async url => { calls.push(url); return htmlResponse(page); }
  });
  assert.deepEqual(calls, [firstUrl]);
  assert.equal(pages.length, 1);
});

test("every redirect target is checked and actual final URL plus requested URL are preserved", async () => {
  const finalUrl = "https://travel.state.gov/verified";
  const calls = [];
  const pages = await fetchOfficialPages([firstUrl], { fetchImpl: async url => {
    calls.push(url);
    return url === firstUrl ? new Response(null, { status: 302, headers: { location: finalUrl } }) : htmlResponse(page);
  } });
  assert.deepEqual(calls, [firstUrl, finalUrl]);
  assert.equal(pages[0].url, finalUrl);
  assert.equal(pages[0].requestedUrl, firstUrl);
  for (const target of ["http://uscis.gov/", "https://example.com/", "https://127.0.0.1/", "https://uscis.gov:8443/"]) {
    let count = 0;
    assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl: async () => {
      count += 1;
      return new Response(null, { status: 301, headers: { location: target } });
    } }), []);
    assert.equal(count, 1);
  }
});

test("relative redirects work but redirect loops and more than three redirects stop", async () => {
  let calls = 0;
  const pages = await fetchOfficialPages([firstUrl], { fetchImpl: async url => {
    calls += 1;
    return url.endsWith("/final") ? htmlResponse(page) : new Response(null, { status: 307, headers: { location: "/final" } });
  } });
  assert.equal(calls, 2);
  assert.equal(pages[0].url, "https://www.uscis.gov/final");
  calls = 0;
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl: async () => {
    calls += 1;
    return new Response(null, { status: 308, headers: { location: `/redirect-${calls}` } });
  } }), []);
  assert.equal(calls, 4);
  calls = 0;
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl: async () => {
    calls += 1;
    return new Response(null, { status: 302, headers: { location: firstUrl } });
  } }), []);
  assert.equal(calls, 1);
});

test("a silently followed redirect cannot provide unchecked content", async () => {
  const response = htmlResponse(page);
  Object.defineProperty(response, "url", { value: "https://example.com/unexpected" });
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl: async () => response }), []);
});

test("unavailable, forbidden, PDF, JSON, and empty HTML pages are skipped without retries", async () => {
  const responses = [
    htmlResponse("Unavailable", { status: 503 }), htmlResponse("Forbidden", { status: 403 }),
    new Response("PDF", { headers: { "content-type": "application/pdf" } }),
    new Response('{"text":"Not a readable page"}', { headers: { "content-type": "application/json" } }),
    htmlResponse("<html><script>only code</script><nav>Only navigation</nav></html>")
  ];
  let calls = 0;
  const pages = await fetchOfficialPages(responses.map((_, index) => `${firstUrl}/${index}`), {
    fetchImpl: async () => responses[calls++]
  });
  assert.deepEqual(pages, []);
  assert.equal(calls, responses.length);
});

test("stream bytes and returned text are bounded independently", async () => {
  const oversized = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(128 * 1024).fill(65));
      controller.enqueue(new Uint8Array(128 * 1024 + 1).fill(65));
      controller.close();
    }
  }), { headers: { "content-type": "text/plain" } });
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl: async () => oversized }), []);
  const lengthRejected = htmlResponse(page, { headers: { "content-type": "text/html", "content-length": "999999" } });
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl: async () => lengthRejected }), []);
  const pages = await fetchOfficialPages([firstUrl], { fetchImpl: async () =>
    new Response("a".repeat(256 * 1024), { headers: { "content-type": "text/plain" } })
  });
  assert.equal(pages[0].text.length, 8000);
});

test("entity decoding is conservative and malformed Unicode cannot escape as an error", async () => {
  const pages = await fetchOfficialPages([firstUrl], { fetchImpl: async () =>
    htmlResponse("<p>&#x41; &#66; &unknown; &#x110000; &#xD800; &#0; &lt;b&gt; readable</p>")
  });
  assert.equal(pages[0].text, "A B &unknown; <b> readable");
});

test("at most six pages and three simultaneous requests are attempted in deterministic order", async () => {
  let active = 0;
  let maximum = 0;
  const calls = [];
  const urls = Array.from({ length: 10 }, (_, index) => `${firstUrl}/${index}`);
  const pages = await fetchOfficialPages(urls, { maxPages: 100, fetchImpl: async url => {
    calls.push(url);
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active -= 1;
    return htmlResponse(page);
  } });
  assert.equal(maximum, 3);
  assert.equal(calls.length, 6);
  assert.deepEqual(pages.map(item => item.url), urls.slice(0, 6));
});

test("one total deadline includes stalled fetches and body reads, preserving partial successes", async () => {
  let hangingSignal;
  const urls = [`${firstUrl}/ok`, `${firstUrl}/fetch-stall`, `${firstUrl}/body-stall`, `${firstUrl}/error`];
  const pages = await fetchOfficialPages(urls, { timeoutMs: 20, fetchImpl: async (url, options) => {
    if (url.endsWith("/ok")) return htmlResponse(page);
    if (url.endsWith("/error")) throw new Error("Network failed");
    if (url.endsWith("/fetch-stall")) {
      hangingSignal = options.signal;
      return new Promise(() => {}); // Also prove deadline holds for a bad injected fetch.
    }
    return new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "text/html" } });
  } });
  assert.deepEqual(pages.map(item => item.url), [urls[0]]);
  assert.equal(hangingSignal.aborted, true);
});

test("empty or disabled requests never call fetch", async () => {
  const fetchImpl = () => { throw new Error("Must not fetch"); };
  assert.deepEqual(await fetchOfficialPages(null, { fetchImpl }), []);
  assert.deepEqual(await fetchOfficialPages([], { fetchImpl }), []);
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl, maxPages: 0 }), []);
  assert.deepEqual(await fetchOfficialPages([firstUrl], { fetchImpl, timeoutMs: 0 }), []);
});
