import { test } from "node:test";
import assert from "node:assert/strict";
import { isHiddenPath } from "../../functions/_middleware.js";

test("hides internal paths", () => {
  for (const p of ["/photo-library/a.jpeg", "/docs/x.md", "/automation/buffer.mjs", "/blog/walk.social.json"])
    assert.equal(isHiddenPath(p), true, p);
});

test("leaves site paths alone", () => {
  for (const p of ["/", "/blog/", "/blog/one-dog-at-a-time", "/images/lyra-moss.jpg", "/styles.css", "/documents"])
    assert.equal(isHiddenPath(p), false, p);
});
