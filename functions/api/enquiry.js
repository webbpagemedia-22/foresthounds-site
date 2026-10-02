// Saves each enquiry from the contact form to the D1 database and emails David.
// Needs, in Cloudflare Pages > Settings: a D1 binding called DB, and the
// secret RESEND_API_KEY. NOTIFY_EMAIL and NOTIFY_FROM are optional.
const FIELDS = {
  name: 100, phone: 40, email: 200, town: 60,
  dog: 100, breed: 100, service: 60, notes: 3000
};
const REQUIRED = ["name", "email", "town", "dog"];

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "Could not read the form.");
  }

  // Hidden field that people never see; bots tend to fill it in.
  if ((form.get("website") || "").toString().trim()) return reply(200, "Thanks");

  const e = {};
  for (const [key, max] of Object.entries(FIELDS)) {
    e[key] = (form.get(key) || "").toString().trim().slice(0, max);
  }
  if (REQUIRED.some((k) => !e[k]) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email)) {
    return reply(400, "Please fill in your name, email, town and dog's name.");
  }

  if (!env.DB) return reply(503, "Enquiries database is not connected.");

  const saved = await env.DB.prepare(
    `INSERT INTO enquiries (name, phone, email, town, dog, breed, service, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(e.name, e.phone, e.email, e.town, e.dog, e.breed, e.service, e.notes).first();

  // Send the email alert after replying, so the visitor isn't kept waiting.
  context.waitUntil(notify(env, e, saved.id));

  return reply(200, "Thanks");
}

async function notify(env, e, id) {
  if (!env.RESEND_API_KEY) return;
  const text = [
    `Name: ${e.name}`,
    `Phone: ${e.phone}`,
    `Email: ${e.email}`,
    `Town: ${e.town}`,
    `Dog's name: ${e.dog}`,
    `Breed and age: ${e.breed}`,
    `Interested in: ${e.service}`,
    "",
    e.notes,
    "",
    `Saved as enquiry ${id}.`
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || "Forest Hounds website <enquiries@foresthounds.co.uk>",
      to: env.NOTIFY_EMAIL || "hello@foresthounds.co.uk",
      reply_to: e.email,
      subject: `Meet and greet enquiry: ${e.dog}`,
      text
    })
  });
  if (res.ok) {
    await env.DB.prepare("UPDATE enquiries SET emailed = 1 WHERE id = ?").bind(id).run();
  } else {
    console.log("Enquiry email failed", res.status, await res.text());
  }
}

function reply(status, message) {
  return Response.json({ ok: status === 200, message }, { status });
}
