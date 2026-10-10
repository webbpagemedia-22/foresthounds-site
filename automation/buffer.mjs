// Sends a merged weekly headline post to the Buffer queue.
//
// Buffer API (GraphQL at https://api.buffer.com, confirmed 10 October 2026):
//   mutation createPost(input: CreatePostInput!): PostActionPayload!
//   CreatePostInput: channelId, text, schedulingType (automatic|notification),
//     mode (addToQueue|shareNow|shareNext|customScheduled),
//     assets: [{ image: { url, metadata: { altText } } }], metadata: { facebook: { type } }
//   PostActionPayload: PostActionSuccess { post { id } } or an error type with
//     a message (NotFoundError, UnauthorizedError, UnexpectedError,
//     LimitReachedError, InvalidInputError, RestProxyError).

const BUFFER_API = "https://api.buffer.com";
const SITE = "https://www.foresthounds.co.uk";
const MAX_LENGTH = { facebook: 500 };

const CREATE_POST = `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id } }
    ... on NotFoundError { message }
    ... on UnauthorizedError { message }
    ... on UnexpectedError { message }
    ... on LimitReachedError { message }
    ... on InvalidInputError { message }
  }
}`;

// Paths of blog/*.social.json files added (not edited) in `git diff --name-status` output.
export function addedSocialFiles(diffNameStatus) {
  return diffNameStatus
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([status, path]) => status === "A" && /^blog\/[^/]+\.social\.json$/.test(path))
    .map(([, path]) => path)
    .sort();
}

// Problems with a .social.json file; an empty list means it can be sent.
export function validateSocial(social, channels) {
  const problems = [];
  if (!social.url?.startsWith(`${SITE}/blog/`)) problems.push(`url must start ${SITE}/blog/`);
  if (!social.image?.startsWith(`${SITE}/images/`)) problems.push(`image must start ${SITE}/images/`);
  if (!social.image_alt?.trim()) problems.push("image_alt is missing");
  for (const { service } of channels) {
    const text = social.text?.[service];
    if (!text) {
      problems.push(`no ${service} text`);
      continue;
    }
    if (MAX_LENGTH[service] && text.length > MAX_LENGTH[service])
      problems.push(`${service} text is ${text.length} characters (max ${MAX_LENGTH[service]})`);
    if (social.url && !text.includes(social.url)) problems.push(`${service} text doesn't include the post link`);
  }
  return problems;
}

export function buildPostInput(social, channel) {
  return {
    channelId: channel.id,
    text: social.text[channel.service],
    schedulingType: "automatic",
    mode: "addToQueue",
    assets: [{ image: { url: social.image, metadata: { altText: social.image_alt } } }],
    metadata: { [channel.service]: { type: "post" } },
  };
}

// Resolves once every URL returns 200; rejects after timeoutMs naming the URLs still failing.
export async function waitForLive(urls, { fetch, sleep, intervalMs = 30000, timeoutMs = 900000 }) {
  for (let waited = 0; ; waited += intervalMs) {
    const failing = [];
    for (const u of urls) {
      const res = await fetch(u, { method: "GET", cache: "no-store" }).catch(() => ({ status: 0 }));
      if (res.status !== 200) failing.push(`${u} (${res.status})`);
    }
    if (failing.length === 0) return;
    if (waited >= timeoutMs) throw new Error(`Still not live after ${timeoutMs / 60000} minutes: ${failing.join(", ")}`);
    await sleep(intervalMs);
  }
}

// Adds one post to Buffer and returns its ID.
export async function sendPost(input, { apiKey, fetch }) {
  const res = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query: CREATE_POST, variables: { input } }),
  });
  if (!res.ok) throw new Error(`Buffer returned HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`Buffer error: ${body.errors[0].message}`);
  const result = body.data?.createPost;
  if (result?.__typename !== "PostActionSuccess")
    throw new Error(`Buffer ${result?.__typename ?? "error"}: ${result?.message ?? "no message"}`);
  return result.post.id;
}
