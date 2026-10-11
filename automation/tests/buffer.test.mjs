import { test } from "node:test";
import assert from "node:assert/strict";
import { addedSocialFiles, validateSocial, buildPostInput, waitForLive, sendPost } from "../buffer.mjs";

const channels = [{ id: "6ab95608ea19ca0bde0643f6", service: "facebook", name: "Forest Hounds" }];
const url = "https://www.foresthounds.co.uk/blog/conker-season";
const social = {
  url,
  image: "https://www.foresthounds.co.uk/images/library-IMG_0213.jpeg",
  image_alt: "A whippet among fallen leaves",
  text: { facebook: `Conkers are poisonous to dogs. Here's what to watch for. ${url}` },
};

const response = (status, body = {}) => ({ status, ok: status === 200, json: async () => body });

test("only added social files, sorted", () => {
  const diff = "A\tblog/b.social.json\nM\tblog/a.social.json\nA\tblog/a.social.json\nA\tblog/a.html\nA\tautomation/tests/fixtures/x.social.json";
  assert.deepEqual(addedSocialFiles(diff), ["blog/a.social.json", "blog/b.social.json"]);
});

test("edited social file sends nothing", () => {
  assert.deepEqual(addedSocialFiles("M\tblog/a.social.json\n"), []);
});

test("valid social passes", () => {
  assert.deepEqual(validateSocial(social, channels), []);
});

test("long or link-less facebook text fails", () => {
  const long = { ...social, text: { facebook: "x".repeat(501 - url.length - 1) + " " + url } };
  assert.equal(long.text.facebook.length, 501);
  assert.equal(validateSocial(long, channels).length, 1);
  const noLink = { ...social, text: { facebook: "No link here" } };
  assert.equal(validateSocial(noLink, channels).length, 1);
  const noText = { ...social, text: {} };
  assert.equal(validateSocial(noText, channels).length, 1);
  const badUrls = { ...social, url: "https://example.com/x", image: "http://x", image_alt: "" };
  assert.ok(validateSocial(badUrls, channels).length >= 3);
});

test("builds queue post with image and alt", () => {
  assert.deepEqual(buildPostInput(social, channels[0]), {
    channelId: "6ab95608ea19ca0bde0643f6",
    text: social.text.facebook,
    schedulingType: "automatic",
    mode: "addToQueue",
    assets: [{ image: { url: social.image, metadata: { altText: social.image_alt } } }],
    metadata: { facebook: { type: "post" } },
  });
});

test("waitForLive retries then resolves", async () => {
  const replies = [404, 404, 200, 200];
  let sleeps = 0;
  await waitForLive([url], {
    fetch: async () => response(replies.shift()),
    sleep: async () => { sleeps++; },
    intervalMs: 30000,
    timeoutMs: 900000,
  });
  assert.equal(sleeps, 2);
});

test("waitForLive times out naming the URL", async () => {
  await assert.rejects(
    waitForLive([url, social.image], {
      fetch: async (u) => response(u === url ? 200 : 404),
      sleep: async () => {},
      intervalMs: 30000,
      timeoutMs: 90000,
    }),
    /images\/library-IMG_0213\.jpeg/,
  );
});

test("sendPost returns id and sends bearer key", async () => {
  let seen;
  const fetch = async (u, init) => {
    seen = { u, init };
    return response(200, { data: { createPost: { __typename: "PostActionSuccess", post: { id: "p123" } } } });
  };
  const input = buildPostInput(social, channels[0]);
  assert.equal(await sendPost(input, { apiKey: "k", fetch }), "p123");
  assert.equal(seen.u, "https://api.buffer.com");
  assert.equal(seen.init.headers.Authorization, "Bearer k");
  assert.deepEqual(JSON.parse(seen.init.body).variables.input, input);
});

test("sendPost throws Buffer's error message", async () => {
  const gqlError = async () => response(200, { errors: [{ message: "Invalid token" }] });
  await assert.rejects(sendPost({}, { apiKey: "k", fetch: gqlError }), /Invalid token/);
  const limit = async () => response(200, { data: { createPost: { __typename: "LimitReachedError", message: "Queue is full" } } });
  await assert.rejects(sendPost({}, { apiKey: "k", fetch: limit }), /Queue is full/);
  const http = async () => response(500);
  await assert.rejects(sendPost({}, { apiKey: "k", fetch: http }), /500/);
});

import { sendHeadlines, rerunProblem } from "../buffer.mjs";

const quiet = { log() {}, error() {} };
const okFetch = (calls) => async (u, init) => {
  if (u === "https://api.buffer.com") {
    calls.push(JSON.parse(init.body).variables.input.text);
    return response(200, { data: { createPost: { __typename: "PostActionSuccess", post: { id: "p1" } } } });
  }
  return response(200);
};

test("text must end with its own post link", () => {
  const otherPost = { ...social, text: { facebook: `Read it: ${url}-2` } };
  assert.equal(validateSocial(otherPost, channels).length, 1);
  const linkMidway = { ...social, text: { facebook: `${url} is worth a read` } };
  assert.equal(validateSocial(linkMidway, channels).length, 1);
  assert.equal(validateSocial(social, channels, "conker-season").length, 0);
  assert.equal(validateSocial(social, channels, "some-older-post").length, 1);
});

test("closing other options failing doesn't stop the post", async () => {
  const calls = [];
  const result = await sendHeadlines([{ path: "blog/conker-season.social.json", social }], channels, {
    fetch: okFetch(calls), sleep: async () => {}, apiKey: "k", logger: quiet,
    closeOtherOptions: () => { throw new Error("gh: HTTP 502"); },
  });
  assert.deepEqual(calls, [social.text.facebook]);
  assert.equal(result.failed, true);
});

test("other options are closed only after the post is queued", async () => {
  const order = [];
  await sendHeadlines([{ path: "blog/conker-season.social.json", social }], channels, {
    fetch: async (u, init) => { if (u === "https://api.buffer.com") order.push("send"); return okFetch([])(u, init); },
    sleep: async () => {}, apiKey: "k", logger: quiet,
    closeOtherOptions: () => order.push("close"),
  });
  assert.deepEqual(order, ["send", "close"]);
});

test("re-running an automatic run is refused", () => {
  assert.match(rerunProblem({ GITHUB_RUN_ATTEMPT: "2" }, false), /Run workflow/);
  assert.equal(rerunProblem({ GITHUB_RUN_ATTEMPT: "1" }, false), null);
  assert.equal(rerunProblem({ GITHUB_RUN_ATTEMPT: "2" }, true), null);
  assert.equal(rerunProblem({}, false), null);
});
