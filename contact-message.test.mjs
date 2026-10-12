import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const contact = require("./contact-message.js");

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "sb_publishable_example_key_value",
};

const validFields = {
  name: "有ゆうな",
  email: "fan@example.com",
  subject: "appearance",
  message: "こんにちは。\n出演の相談です。",
  company: "",
};

function jsonResponse(body, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

function createHarness(initial = {}) {
  function field(id, extra = {}) {
    const element = {
      id,
      value: extra.value ?? "",
      disabled: false,
      hidden: extra.hidden ?? false,
      className: extra.className || "",
      textContent: extra.textContent || "",
      focused: false,
      attributes: { ...(extra.attributes || {}) },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      focus() {
        this.focused = true;
      },
    };
    Object.defineProperty(element, "innerHTML", {
      configurable: true,
      get() {
        return "";
      },
      set() {
        throw new Error("innerHTML is not allowed");
      },
    });
    return element;
  }

  const defaults = {
    name: initial.name || "",
    email: initial.email || "",
    subject: initial.subject || "",
    message: initial.message || "",
    company: initial.company || "",
  };
  const fields = {
    name: field("contact-name", { value: defaults.name }),
    email: field("contact-email", { value: defaults.email }),
    subject: field("contact-subject", { value: defaults.subject }),
    message: field("contact-message", { value: defaults.message }),
    company: field("contactCompany", { value: defaults.company }),
    nameError: field("contact-name-error", { hidden: true }),
    emailError: field("contact-email-error", { hidden: true }),
    subjectError: field("contact-subject-error", { hidden: true }),
    messageError: field("contact-message-error", { hidden: true }),
    status: field("contact-status", {
      hidden: true,
      className: "contact-status",
      attributes: { role: "status" },
    }),
    button: field("", { className: "submit-btn", textContent: "送信" }),
  };
  const selectors = {
    "#contact-name": fields.name,
    "#contact-email": fields.email,
    "#contact-subject": fields.subject,
    "#contact-message": fields.message,
    "#contact-name-error": fields.nameError,
    "#contact-email-error": fields.emailError,
    "#contact-subject-error": fields.subjectError,
    "#contact-message-error": fields.messageError,
    "#contact-status": fields.status,
    ".submit-btn": fields.button,
    "#contactCompany": fields.company,
  };
  const listeners = [];
  const form = {
    id: "contactForm",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    addEventListener(type, fn) {
      listeners.push({ type, fn });
    },
    querySelector(selector) {
      return selectors[selector] || null;
    },
    reset() {
      fields.name.value = defaults.name;
      fields.email.value = defaults.email;
      fields.subject.value = defaults.subject;
      fields.message.value = defaults.message;
      fields.company.value = defaults.company;
    },
    dispatch(event) {
      for (const listener of listeners) {
        if (listener.type === event.type) listener.fn(event);
      }
      return event;
    },
  };
  const documentStub = {
    getElementById(id) {
      return id === "contactForm" ? form : null;
    },
  };
  return { form, fields, document: documentStub };
}

function fill(fields, values = validFields) {
  fields.name.value = values.name;
  fields.email.value = values.email;
  fields.subject.value = values.subject;
  fields.message.value = values.message;
  fields.company.value = values.company || "";
}

function start(harness, fetchImpl, extra = {}) {
  return contact.startContactForm({
    document: harness.document,
    config,
    fetchImpl,
    timeoutMs: extra.timeoutMs,
    ...extra,
  });
}

function submitEvent() {
  const event = {
    type: "submit",
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  return event;
}

async function withConsole(fn) {
  const logs = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  const stringify = (value) => {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  for (const key of Object.keys(original)) {
    console[key] = (...args) => {
      logs.push(args.map(stringify).join(" "));
    };
  }
  try {
    await fn(logs);
  } finally {
    Object.assign(console, original);
  }
}

function readProjectFiles() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const found = [];
  const textExt = new Set([".html", ".js", ".mjs", ".css", ".json", ".md", ".txt", ".svg"]);
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".git" || entry === ".DS_Store") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(entry);
      if (textExt.has(ext) || (entry.startsWith(".") && ext === "")) found.push(full);
    }
  };
  walk(root);
  return found;
}

function contactHtml() {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const startAt = html.indexOf('id="contact"');
  const endAt = html.indexOf("<footer", startAt);
  return { html, contact: html.slice(startAt, endAt) };
}

function contactFormMarkup() {
  const { contact: section } = contactHtml();
  const startAt = section.indexOf("<form");
  const endAt = section.indexOf("</form>");
  return section.slice(startAt, endAt);
}

function namedControls(formMarkup) {
  return [...formMarkup.matchAll(/<(input|select|textarea|button)\b[^>]*>/gi)]
    .map((match) => attributes(match[0]))
    .filter((attrs) => Object.hasOwn(attrs, "name"));
}

function nativeGetQuery(formMarkup, valuesById) {
  const params = new URLSearchParams();
  for (const attrs of namedControls(formMarkup)) {
    if (Object.hasOwn(attrs, "disabled")) continue;
    const value = Object.hasOwn(valuesById, attrs.id) ? valuesById[attrs.id] : attrs.value || "";
    params.append(attrs.name, value);
  }
  return params.toString();
}

function openingTag(source, id) {
  const match = source.match(new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`, "i"));
  assert.ok(match, id);
  return match[0];
}

function attributes(tag) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g;
  let match;
  while ((match = re.exec(tag))) {
    if (match[1].startsWith("<")) continue;
    attrs[match[1]] = match[2] ?? "";
  }
  return attrs;
}

describe("contact form markup", () => {
  it("keeps the contact section, sns links, and audition line", () => {
    const { html, contact: section } = contactHtml();
    assert.match(section, /<h2 class="section-title">SNS\/Contact<\/h2>/);
    assert.match(section, /class="contact-content"/);
    assert.match(section, /class="contact-info"/);
    assert.match(section, /class="contact-form"/);
    assert.match(section, /id="contactForm"/);
    const links = [
      "https://twitter.com/arcanacharm",
      "https://instagram.com/arcanacharm",
      "https://youtube.com/@arcanacharm",
      "https://tiktok.com/@arcanacharm",
    ];
    let previous = -1;
    for (const link of links) {
      const index = section.indexOf(link);
      assert.ok(index > previous, link);
      previous = index;
    }
    assert.equal(html.includes("https://lin.ee/plBi8krp"), true);
    assert.equal(section.includes("lin.ee"), false);
  });

  it("associates visible labels and keeps the required fields", () => {
    const { contact: section } = contactHtml();
    assert.match(section, /<label for="contact-name">お名前<\/label>/);
    assert.match(section, /<label for="contact-email">メールアドレス<\/label>/);
    assert.match(section, /<label for="contact-subject">お問い合わせ内容<\/label>/);
    assert.match(section, /<label for="contact-message">メッセージ<\/label>/);

    const name = attributes(openingTag(section, "contact-name"));
    assert.equal(Object.hasOwn(name, "name"), false);
    assert.equal(name.type, "text");
    assert.equal(name.maxlength, "100");
    assert.equal(name.autocomplete, "name");
    assert.equal(name.required, "");
    assert.equal(name["aria-describedby"], "contact-name-error");

    const email = attributes(openingTag(section, "contact-email"));
    assert.equal(Object.hasOwn(email, "name"), false);
    assert.equal(email.type, "email");
    assert.equal(email.maxlength, "254");
    assert.equal(email.autocomplete, "email");
    assert.equal(email.inputmode, "email");
    assert.equal(email.required, "");

    const subject = attributes(openingTag(section, "contact-subject"));
    assert.equal(Object.hasOwn(subject, "name"), false);
    assert.equal(subject.required, "");
    assert.match(section, /<option value="" disabled selected>お問い合わせ内容を選択してください<\/option>/);
    assert.match(section, /<option value="appearance">出演依頼<\/option>/);
    assert.match(section, /<option value="business">お仕事のご相談<\/option>/);
    assert.match(section, /<option value="fan">ファンレター・応援<\/option>/);
    assert.match(section, /<option value="other">その他<\/option>/);

    const message = attributes(openingTag(section, "contact-message"));
    assert.equal(Object.hasOwn(message, "name"), false);
    assert.equal(message.maxlength, "5000");
    assert.equal(message.required, "");
    assert.equal(message.rows, "5");
  });

  it("adds an offscreen honeypot and a noscript explanation", () => {
    const { contact: section } = contactHtml();
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const company = attributes(openingTag(section, "contactCompany"));
    assert.equal(company.type, "text");
    assert.equal(company.id, "contactCompany");
    assert.equal(Object.hasOwn(company, "name"), false);
    assert.equal(company.tabindex, "-1");
    assert.equal(company.autocomplete, "off");
    assert.equal(company["aria-hidden"], "true");
    assert.equal(section.includes('for="contact-company"'), false);
    assert.equal(section.includes('for="contactCompany"'), false);
    assert.match(section, /class="contact-honeypot"/);
    assert.match(section, /お問い合わせフォームの送信にはJavaScriptが必要です。SNSからもお問い合わせいただけます。/);
    assert.match(styles, /\.contact-honeypot\s*\{[^}]*position:\s*absolute/);
    assert.match(styles, /\.contact-honeypot\s*\{[^}]*left:\s*-10000px/);
    assert.match(styles, /\.contact-honeypot\s*\{[^}]*width:\s*1px/);
    assert.match(styles, /\.contact-honeypot\s*\{[^}]*height:\s*1px/);
    assert.match(styles, /\.contact-honeypot\s*\{[^}]*overflow:\s*hidden/);
    assert.match(styles, /\.contact-form select:focus/);
    assert.match(styles, /\.contact-content\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
    assert.match(styles, /max-width:\s*768px[\s\S]*?\.contact-content\s*\{[^}]*grid-template-columns:\s*1fr\s*;/);
  });

  it("loads the contact module after the public config", () => {
    const { html } = contactHtml();
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
    assert.ok(scripts.indexOf("members-public-config.js") < scripts.indexOf("contact-message.js"));
    assert.ok(scripts.includes("script.js"));
    assert.ok(scripts.includes("members-cms.js"));
    assert.ok(scripts.includes("gallery-cms.js"));
    assert.ok(scripts.includes("about-cms.js"));
  });
});

describe("native form safety", () => {
  it("does not expose serializable names for personal fields", () => {
    const form = contactFormMarkup();
    for (const id of ["contact-name", "contact-email", "contact-subject", "contact-message", "contactCompany"]) {
      const attrs = attributes(openingTag(form, id));
      assert.equal(Object.hasOwn(attrs, "name"), false, id);
    }
    assert.equal(namedControls(form).length, 0);
    assert.equal(/<form\b[^>]*\baction\s*=/i.test(form), false);
    assert.equal(form.toLowerCase().includes("formspree"), false);
    const source = readFileSync(new URL("./contact-message.js", import.meta.url), "utf8");
    assert.equal(/new\s+FormData\s*\(\s*[A-Za-z_$]/.test(source), false);
    assert.equal(source.includes("new FormData()"), true);
    assert.equal(source.includes("#contactCompany"), true);
  });

  it("keeps personal values out of a native query string", () => {
    const values = {
      "contact-name": "山田花子",
      "contact-email": "hanako@example.com",
      "contact-subject": "business",
      "contact-message": "これは秘密の本文です",
      contactCompany: "Bot Inc",
    };
    const query = nativeGetQuery(contactFormMarkup(), values);
    assert.equal(query, "");
    for (const value of Object.values(values)) {
      assert.equal(query.includes(value), false, value);
      assert.equal(query.includes(encodeURIComponent(value)), false, value);
    }
  });
});

describe("contact validation", () => {
  it("accepts a trimmed multiline message and the fixed subject codes", () => {
    const result = contact.validateContactFields({
      name: "  有ゆうな  ",
      email: " fan@example.com ",
      subject: "fan",
      message: "  1行目\n2行目  ",
    });
    assert.equal(result.ok, true);
    assert.equal(result.firstInvalid, null);
    assert.equal(result.fields.name, "有ゆうな");
    assert.equal(result.fields.email, "fan@example.com");
    assert.equal(result.fields.subject, "fan");
    assert.equal(result.fields.message, "1行目\n2行目");
    for (const code of ["appearance", "business", "fan", "other"]) {
      assert.equal(contact.validateContactFields({ ...validFields, subject: code }).ok, true, code);
    }
  });

  it("rejects blank, oversized, malformed, and unsupported values", () => {
    const cases = [
      [{ ...validFields, name: "   " }, "name", contact.ERROR_TEXT.nameRequired],
      [{ ...validFields, name: "あ".repeat(101) }, "name", contact.ERROR_TEXT.nameLength],
      [{ ...validFields, email: "   " }, "email", contact.ERROR_TEXT.email],
      [{ ...validFields, email: "not-an-email" }, "email", contact.ERROR_TEXT.email],
      [{ ...validFields, email: `${"a".repeat(250)}@example.com` }, "email", contact.ERROR_TEXT.email],
      [{ ...validFields, subject: "" }, "subject", contact.ERROR_TEXT.subject],
      [{ ...validFields, subject: "出演依頼" }, "subject", contact.ERROR_TEXT.subject],
      [{ ...validFields, subject: "spam" }, "subject", contact.ERROR_TEXT.subject],
      [{ ...validFields, message: " \n " }, "message", contact.ERROR_TEXT.messageRequired],
      [{ ...validFields, message: "あ".repeat(5001) }, "message", contact.ERROR_TEXT.messageLength],
    ];
    for (const [fields, key, message] of cases) {
      const result = contact.validateContactFields(fields);
      assert.equal(result.ok, false, key);
      assert.equal(result.errors[key], message);
    }
    assert.equal(contact.validateContactFields({ ...validFields, name: "あ".repeat(100) }).ok, true);
    assert.equal(contact.validateContactFields({ ...validFields, message: "あ".repeat(5000) }).ok, true);
  });

  it("focuses the first invalid visible field and skips the request", async () => {
    const harness = createHarness();
    let calls = 0;
    start(harness, async () => {
      calls += 1;
      return jsonResponse(true);
    });
    harness.fields.email.value = "bad";
    harness.fields.subject.value = "";
    harness.fields.message.value = "";
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(result.reason, "validation");
    assert.equal(result.firstInvalid, "name");
    assert.equal(harness.fields.name.focused, true);
    assert.equal(harness.fields.email.focused, false);
    assert.equal(harness.fields.name.getAttribute("aria-invalid"), "true");
    assert.equal(harness.fields.nameError.hidden, false);
    assert.equal(harness.fields.nameError.textContent, contact.ERROR_TEXT.nameRequired);
    assert.equal(harness.fields.emailError.textContent, contact.ERROR_TEXT.email);
    assert.equal(harness.fields.subjectError.textContent, contact.ERROR_TEXT.subject);
    assert.equal(calls, 0);
    assert.equal(harness.fields.status.hidden, true);
    assert.equal(harness.fields.button.disabled, false);
    assert.equal(harness.fields.button.textContent, "送信");
  });

  it("moves focus to the next invalid field after the previous one is fixed", async () => {
    const harness = createHarness();
    start(harness, async () => jsonResponse(true));
    fill(harness.fields, { ...validFields, email: "missing-at.example" });
    const event = submitEvent();
    harness.form.dispatch(event);
    await event.contactTask;
    assert.equal(harness.fields.email.focused, true);
    assert.equal(harness.fields.name.getAttribute("aria-invalid"), null);
    assert.equal(harness.fields.emailError.textContent, contact.ERROR_TEXT.email);
  });
});

describe("contact rpc", () => {
  it("posts only the public rpc payload with the publishable key", async () => {
    const harness = createHarness();
    const calls = [];
    start(harness, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse("stored");
    });
    fill(harness.fields, { ...validFields, company: "  Bot Co  " });
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(result.ok, true);
    assert.equal(result.status, "stored");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/submit_contact_message_v2");
    assert.equal(calls[1].url, contact.FORMSPREE_ENDPOINT);
    assert.equal(calls.some((call) => String(call.url).includes("submit_contact_message_v1")), false);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.apikey, config.supabasePublishableKey);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${config.supabasePublishableKey}`);
    assert.equal(calls[0].init.headers["Content-Type"], "application/json");
    assert.equal(calls[0].init.headers.Accept, "application/json");
    assert.deepEqual(Object.keys(calls[0].init.headers).sort(), ["Accept", "Authorization", "Content-Type", "apikey"]);
    const payload = JSON.parse(calls[0].init.body);
    assert.deepEqual(Object.keys(payload), ["p_name", "p_email", "p_subject", "p_message", "p_company"]);
    assert.equal(payload.p_subject, "appearance");
    assert.equal(payload.p_company, "  Bot Co  ");
    assert.equal(payload.p_message, validFields.message);
    assert.equal(calls[0].url.includes("contact_messages"), false);
    assert.equal(calls[0].url.includes(validFields.name), false);
    assert.equal(calls[0].url.includes(validFields.email), false);
    assert.equal(calls[0].url.includes("出演"), false);
  });

  it("still submits from the form submit event used by Enter", async () => {
    const harness = createHarness();
    const calls = [];
    start(harness, async (url, init) => {
      if (String(url).includes("/rpc/submit_contact_message_v2")) calls.push(JSON.parse(init.body));
      return jsonResponse("stored");
    });
    fill(harness.fields, { ...validFields, company: "Bot" });
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(event.defaultPrevented, true);
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [{
      p_name: validFields.name,
      p_email: validFields.email,
      p_subject: validFields.subject,
      p_message: validFields.message,
      p_company: "Bot",
    }]);
  });

  it("accepts only the stored and ignored strings", async () => {
    for (const body of ["stored", "ignored"]) {
      const harness = createHarness();
      let calls = 0;
      start(harness, async (url) => {
        calls += 1;
        assert.equal(String(url).includes("submit_contact_message_v1"), false);
        return jsonResponse(body);
      });
      fill(harness.fields);
      const event = submitEvent();
      harness.form.dispatch(event);
      const result = await event.contactTask;
      assert.equal(result.ok, true, body);
      assert.equal(result.status, body);
      assert.equal(harness.fields.status.textContent, contact.SUCCESS_MESSAGE);
      assert.equal(harness.fields.name.value, "");
      assert.equal(calls, body === "stored" ? 2 : 1, body);
    }
  });

  it("rejects an unexpected rpc response without notifying", async () => {
    for (const body of [true, false, null, "true", "stored\n", " stored", "STORED", "ignored ", { status: "stored" }, ["stored"], 1, ""]) {
      const harness = createHarness();
      const calls = [];
      start(harness, async (url) => {
        calls.push(String(url));
        return jsonResponse(body);
      });
      fill(harness.fields);
      const event = submitEvent();
      harness.form.dispatch(event);
      const result = await event.contactTask;
      assert.equal(result.ok, false, JSON.stringify(body));
      assert.equal(result.reason, "payload");
      assert.equal(harness.fields.status.textContent, contact.FAILURE_MESSAGE);
      assert.equal(harness.fields.name.value, validFields.name);
      assert.equal(calls.length, 1);
      assert.equal(calls.some((url) => url === contact.FORMSPREE_ENDPOINT), false);
    }
  });

  it("rejects a non-rpc or direct table endpoint before fetching", async () => {
    let calls = 0;
    const result = await contact.submitContactMessage(
      { ...config, supabaseUrl: "https://example.supabase.co/rest/v1/contact_messages" },
      validFields,
      {
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(true);
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
    assert.equal(contact.publicConfigIsSafe({ ...config, supabasePublishableKey: "sb_secret_not_a_browser_key" }), false);
    assert.equal(contact.publicConfigIsSafe({ ...config, supabasePublishableKey: "service_role_key_value_here" }), false);
  });
});

describe("contact submission state", () => {
  it("disables the button while running and ignores a second submit", async () => {
    const harness = createHarness();
    let calls = 0;
    let release;
    const pending = new Promise((resolve) => {
      release = () => resolve(jsonResponse("stored"));
    });
    start(harness, () => {
      calls += 1;
      return pending;
    });
    fill(harness.fields);
    const first = submitEvent();
    harness.form.dispatch(first);
    assert.equal(harness.fields.button.disabled, true);
    assert.equal(harness.fields.button.textContent, "送信中...");
    const second = submitEvent();
    harness.form.dispatch(second);
    const ignored = await second.contactTask;
    assert.equal(ignored.reason, "inflight");
    assert.equal(calls, 1);
    release();
    const result = await first.contactTask;
    assert.equal(result.ok, true);
    assert.equal(harness.fields.button.disabled, false);
    assert.equal(harness.fields.button.textContent, "送信");
  });

  it("resets the form and shows the fixed success copy", async () => {
    const harness = createHarness();
    start(harness, async () => jsonResponse("stored"));
    fill(harness.fields, { ...validFields, message: "画面に出てはいけない本文", company: "Bot Inc" });
    const event = submitEvent();
    harness.form.dispatch(event);
    await event.contactTask;
    assert.equal(harness.fields.status.hidden, false);
    assert.equal(harness.fields.status.textContent, contact.SUCCESS_MESSAGE);
    assert.equal(harness.fields.status.getAttribute("role"), "status");
    assert.equal(harness.fields.status.className, "contact-status is-success");
    assert.equal(harness.fields.status.focused, true);
    assert.equal(harness.fields.name.value, "");
    assert.equal(harness.fields.email.value, "");
    assert.equal(harness.fields.subject.value, "");
    assert.equal(harness.fields.message.value, "");
    assert.equal(harness.fields.company.value, "");
    assert.equal(harness.fields.status.textContent.includes("画面に出てはいけない本文"), false);
    assert.equal(harness.fields.status.textContent.includes("重複"), false);
  });

  it("preserves fields and re-enables submit after failure", async () => {
    const harness = createHarness();
    start(harness, async () => jsonResponse({ error: "rate limit 5 / 60" }, false));
    fill(harness.fields);
    const event = submitEvent();
    harness.form.dispatch(event);
    await event.contactTask;
    assert.equal(harness.fields.status.textContent, contact.FAILURE_MESSAGE);
    assert.equal(harness.fields.status.getAttribute("role"), "alert");
    assert.equal(harness.fields.name.value, validFields.name);
    assert.equal(harness.fields.email.value, validFields.email);
    assert.equal(harness.fields.subject.value, validFields.subject);
    assert.equal(harness.fields.message.value, validFields.message);
    assert.equal(harness.fields.button.disabled, false);
    assert.equal(harness.fields.button.textContent, "送信");
    assert.equal(/rate|limit|5件|60分|429|rejected/i.test(harness.fields.status.textContent), false);
  });

  it("uses the same generic failure for timeout and network errors", async () => {
    const timeoutHarness = createHarness();
    start(
      timeoutHarness,
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
      { timeoutMs: 20 },
    );
    fill(timeoutHarness.fields);
    const timeoutEvent = submitEvent();
    timeoutHarness.form.dispatch(timeoutEvent);
    const timeoutResult = await timeoutEvent.contactTask;
    assert.equal(timeoutResult.reason, "timeout");
    assert.equal(timeoutHarness.fields.status.textContent, contact.FAILURE_MESSAGE);
    assert.equal(timeoutHarness.fields.email.value, validFields.email);
    assert.equal(timeoutHarness.fields.button.disabled, false);

    const networkHarness = createHarness();
    start(networkHarness, async () => {
      throw new Error("offline");
    });
    fill(networkHarness.fields);
    const networkEvent = submitEvent();
    networkHarness.form.dispatch(networkEvent);
    const networkResult = await networkEvent.contactTask;
    assert.equal(networkResult.reason, "network");
    assert.equal(networkHarness.fields.status.textContent, contact.FAILURE_MESSAGE);
    assert.equal(networkHarness.fields.message.value, validFields.message);
    assert.equal(networkHarness.fields.button.textContent, "送信");
  });

  it("shows generic failure when public config is missing and does not throw", async () => {
    const harness = createHarness();
    let calls = 0;
    const started = contact.startContactForm({
      document: harness.document,
      config: undefined,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(true);
      },
    });
    assert.equal(started.started, true);
    fill(harness.fields);
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(result.ok, false);
    assert.equal(result.reason, "config");
    assert.equal(calls, 0);
    assert.equal(harness.fields.status.textContent, contact.FAILURE_MESSAGE);
    assert.equal(harness.fields.name.value, validFields.name);

    const missing = contact.startContactForm({
      document: { getElementById() { return null; } },
    });
    assert.equal(missing.started, false);
    const broken = contact.startContactForm({
      document: {
        getElementById() {
          throw new Error("boom");
        },
      },
    });
    assert.equal(broken.started, false);
  });

  it("binds the submit listener only once", async () => {
    const harness = createHarness();
    let calls = 0;
    const options = {
      document: harness.document,
      config,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse("stored");
      },
    };
    assert.equal(contact.startContactForm(options).started, true);
    assert.equal(contact.startContactForm(options).reason, "bound");
    fill(harness.fields);
    const event = submitEvent();
    harness.form.dispatch(event);
    await event.contactTask;
    assert.equal(calls, 2);
  });
});

describe("contact privacy", () => {
  it("keeps submitted values out of the url, success ui, and logs", async () => {
    const secretName = "山田花子";
    const secretEmail = "hanako@example.com";
    const secretMessage = "これは秘密の本文です";
    const harness = createHarness();
    const calls = [];
    await withConsole(async (logs) => {
      start(harness, async (url, init) => {
        calls.push({ url, init });
        return jsonResponse("stored");
      });
      fill(harness.fields, {
        name: secretName,
        email: secretEmail,
        subject: "business",
        message: secretMessage,
      });
      const event = submitEvent();
      harness.form.dispatch(event);
      await event.contactTask;
      assert.deepEqual(logs, []);
    });
    assert.equal(calls[0].url.includes(secretName), false);
    assert.equal(calls[0].url.includes(secretEmail), false);
    assert.equal(calls[0].url.includes(secretMessage), false);
    assert.equal(calls[0].url.includes(encodeURIComponent(secretEmail)), false);
    assert.equal(harness.fields.status.textContent.includes(secretMessage), false);
    assert.equal(harness.fields.status.textContent.includes(secretEmail), false);
    assert.equal(/\b[0-9a-f]{8}-[0-9a-f]{4}-/.test(harness.fields.status.textContent), false);
  });

  it("logs only a generic failure string", async () => {
    const harness = createHarness();
    await withConsole(async (logs) => {
      start(harness, async () => {
        throw new Error("failed for hanako@example.com これは秘密の本文です");
      });
      fill(harness.fields, {
        ...validFields,
        email: "hanako@example.com",
        message: "これは秘密の本文です",
      });
      const event = submitEvent();
      harness.form.dispatch(event);
      await event.contactTask;
      assert.deepEqual(logs, ["Contact submission failed"]);
    });
    const source = readFileSync(new URL("./contact-message.js", import.meta.url), "utf8");
    assert.deepEqual(
      [...source.matchAll(/console\.(?:log|info|warn|error|debug)\(([^)\n]*)\)/g)].map((match) => match[1]),
      ['"Contact submission failed"', '"Contact notification failed"'],
    );
    assert.equal(source.includes("innerHTML"), false);
    assert.equal(source.includes("outerHTML"), false);
    assert.equal(source.includes("insertAdjacentHTML"), false);
    assert.equal(source.includes("zmhlzwjoczniqdxxvblw"), false);
    assert.equal(source.includes('startsWith("sb_secret_")'), true);
    assert.equal(/sb_secret_[A-Za-z0-9]/.test(source), false);
    assert.equal(source.includes("service_role"), true);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(/\/rest\/v1\/contact_messages/.test(source), false);
  });
});

function classifyRequest(url) {
  const value = String(url);
  if (value.includes("/rpc/submit_contact_message_v2")) return "rpc";
  if (value === contact.FORMSPREE_ENDPOINT) return "formspree";
  if (value.includes("submit_contact_message_v1")) return "v1";
  return "other";
}

function trackFetch(behavior) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const kind = classifyRequest(url);
    calls.push({ kind, url: String(url), init });
    return behavior(kind, url, init, calls);
  };
  return { calls, fetchImpl };
}

function countKind(calls, kind) {
  return calls.filter((call) => call.kind === kind).length;
}

function notificationEntries(body) {
  assert.equal(typeof body?.entries, "function");
  return Object.fromEntries(body.entries());
}

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("condition was not met");
}

describe("contact dual delivery", () => {
  it("sends one notification after stored and resets the form", async () => {
    const harness = createHarness();
    const tracked = trackFetch(async (kind) => {
      if (kind === "rpc") return jsonResponse("stored");
      if (kind === "formspree") return jsonResponse({ ok: true });
      throw new Error(kind);
    });
    start(harness, tracked.fetchImpl);
    fill(harness.fields, { ...validFields, company: "Bot Inc" });
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(result.ok, true);
    assert.equal(result.status, "stored");
    assert.equal(result.notified, true);
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 1);
    assert.equal(countKind(tracked.calls, "v1"), 0);
    assert.equal(countKind(tracked.calls, "other"), 0);
    assert.equal(harness.fields.status.textContent, contact.SUCCESS_MESSAGE);
    assert.equal(harness.fields.name.value, "");
    assert.equal(harness.fields.email.value, "");
    assert.equal(harness.fields.message.value, "");
    assert.equal(harness.fields.company.value, "");
    assert.equal(harness.fields.button.disabled, false);
    assert.equal(harness.fields.button.textContent, "送信");
  });

  it("shows success and does not retry when notification fails after stored", async () => {
    const secretEmail = "hanako@example.com";
    const secretMessage = "これは秘密の本文です";
    const harness = createHarness();
    const tracked = trackFetch(async (kind) => {
      if (kind === "rpc") return jsonResponse("stored");
      if (kind === "formspree") {
        return jsonResponse({ error: `mailbox rejected ${secretEmail} ${secretMessage}` }, false);
      }
      throw new Error(kind);
    });
    await withConsole(async (logs) => {
      start(harness, tracked.fetchImpl);
      fill(harness.fields, {
        ...validFields,
        email: secretEmail,
        message: secretMessage,
        company: "Bot Inc",
      });
      const event = submitEvent();
      harness.form.dispatch(event);
      const result = await event.contactTask;
      assert.equal(result.ok, true);
      assert.equal(result.status, "stored");
      assert.equal(result.notified, false);
      assert.deepEqual(logs, ["Contact notification failed"]);
      assert.equal(logs.join("\n").includes(secretEmail), false);
      assert.equal(logs.join("\n").includes(secretMessage), false);
    });
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 1);
    assert.equal(harness.fields.status.textContent, contact.SUCCESS_MESSAGE);
    assert.equal(harness.fields.status.getAttribute("role"), "status");
    assert.equal(harness.fields.name.value, "");
    assert.equal(harness.fields.email.value, "");
    assert.equal(harness.fields.subject.value, "");
    assert.equal(harness.fields.message.value, "");
    assert.equal(harness.fields.button.disabled, false);
  });

  it("shows success without retry when the notification times out", async () => {
    const harness = createHarness();
    const tracked = trackFetch((kind, _url, init) => {
      if (kind === "rpc") return jsonResponse("stored");
      if (kind === "formspree") {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }
      throw new Error(kind);
    });
    start(harness, tracked.fetchImpl, { notificationTimeoutMs: 20 });
    fill(harness.fields);
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(result.ok, true);
    assert.equal(result.notified, false);
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 1);
    assert.equal(harness.fields.status.textContent, contact.SUCCESS_MESSAGE);
    assert.equal(harness.fields.email.value, "");
    assert.equal(harness.fields.button.disabled, false);
    assert.equal(harness.fields.button.textContent, "送信");
  });

  it("does not notify when the rpc result is ignored", async () => {
    const harness = createHarness();
    const tracked = trackFetch(async (kind) => {
      if (kind === "rpc") return jsonResponse("ignored");
      throw new Error(kind);
    });
    start(harness, tracked.fetchImpl);
    fill(harness.fields, { ...validFields, company: "Bot Inc" });
    const event = submitEvent();
    harness.form.dispatch(event);
    const result = await event.contactTask;
    assert.equal(result.ok, true);
    assert.equal(result.status, "ignored");
    assert.equal(result.notified, false);
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 0);
    const payload = JSON.parse(tracked.calls[0].init.body);
    assert.equal(payload.p_company, "Bot Inc");
    assert.equal(harness.fields.status.textContent, contact.SUCCESS_MESSAGE);
    assert.equal(harness.fields.status.textContent.includes("重複"), false);
    assert.equal(harness.fields.name.value, "");
    assert.equal(harness.fields.company.value, "");
  });

  it("does not notify when the rpc request fails", async () => {
    const harness = createHarness();
    const tracked = trackFetch(async (kind) => {
      if (kind === "rpc") return jsonResponse({ message: "submit rejected" }, false);
      throw new Error(kind);
    });
    await withConsole(async (logs) => {
      start(harness, tracked.fetchImpl);
      fill(harness.fields, { ...validFields, company: "Bot Inc" });
      const event = submitEvent();
      harness.form.dispatch(event);
      const result = await event.contactTask;
      assert.equal(result.ok, false);
      assert.equal(result.reason, "http");
      assert.deepEqual(logs, ["Contact submission failed"]);
    });
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 0);
    assert.equal(harness.fields.status.textContent, contact.FAILURE_MESSAGE);
    assert.equal(harness.fields.status.getAttribute("role"), "alert");
    assert.equal(harness.fields.name.value, validFields.name);
    assert.equal(harness.fields.email.value, validFields.email);
    assert.equal(harness.fields.subject.value, validFields.subject);
    assert.equal(harness.fields.message.value, validFields.message);
    assert.equal(harness.fields.company.value, "Bot Inc");
  });

  it("builds one historical notification payload and keeps the inbox subject code", async () => {
    const forbidden = ["id", "read_at", "archived_at", "company", "p_company", "honeypot", "status", "subject", "apikey", "p_name", "p_email", "p_subject", "p_message"];
    for (const subject of contact.SUBJECT_CODES) {
      const harness = createHarness();
      const tracked = trackFetch(async (kind) => {
        if (kind === "rpc") return jsonResponse("stored");
        if (kind === "formspree") return jsonResponse({ ok: true });
        throw new Error(kind);
      });
      start(harness, tracked.fetchImpl);
      fill(harness.fields, { ...validFields, subject, company: "Bot Inc" });
      const event = submitEvent();
      harness.form.dispatch(event);
      await event.contactTask;
      assert.equal(countKind(tracked.calls, "rpc"), 1);
      assert.equal(countKind(tracked.calls, "formspree"), 1);
      const rpc = tracked.calls.find((call) => call.kind === "rpc");
      const notice = tracked.calls.find((call) => call.kind === "formspree");
      assert.equal(JSON.parse(rpc.init.body).p_subject, subject);
      assert.equal(notice.url, "https://formspree.io/f/xblzygzb");
      assert.equal(notice.url.includes("?"), false);
      assert.equal(notice.init.method, "POST");
      assert.deepEqual(notice.init.headers, { Accept: "application/json" });
      assert.equal(Object.hasOwn(notice.init.headers, "Content-Type"), false);
      assert.equal(notice.init.headers.apikey, undefined);
      assert.equal(notice.init.headers.Authorization, undefined);
      const entries = notificationEntries(notice.init.body);
      assert.deepEqual(entries, {
        name: validFields.name,
        email: validFields.email,
        message: validFields.message,
        _subject: "【ArcanaCharm】Webお問い合わせ",
        お問い合わせ内容: contact.SUBJECT_LABELS[subject],
      });
      const serialized = JSON.stringify(entries);
      assert.equal(serialized.includes("Bot Inc"), false);
      assert.equal(serialized.includes(config.supabasePublishableKey), false);
      assert.equal(serialized.includes("service_role"), false);
      for (const key of forbidden) assert.equal(Object.hasOwn(entries, key), false, `${subject}:${key}`);
    }
  });

  it("holds the submit button until the single notification attempt finishes", async () => {
    const harness = createHarness();
    let release;
    const pending = new Promise((resolve) => {
      release = () => resolve(jsonResponse({ ok: true }));
    });
    const tracked = trackFetch((kind) => {
      if (kind === "rpc") return jsonResponse("stored");
      if (kind === "formspree") return pending;
      throw new Error(kind);
    });
    start(harness, tracked.fetchImpl);
    fill(harness.fields);
    const first = submitEvent();
    harness.form.dispatch(first);
    await waitUntil(() => countKind(tracked.calls, "formspree") === 1);
    assert.equal(harness.fields.button.disabled, true);
    assert.equal(harness.fields.button.textContent, "送信中...");
    const second = submitEvent();
    harness.form.dispatch(second);
    const ignored = await second.contactTask;
    assert.equal(ignored.reason, "inflight");
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 1);
    release();
    const result = await first.contactTask;
    assert.equal(result.ok, true);
    assert.equal(result.notified, true);
    assert.equal(countKind(tracked.calls, "rpc"), 1);
    assert.equal(countKind(tracked.calls, "formspree"), 1);
    assert.equal(harness.fields.button.disabled, false);
  });
});

describe("legacy contact provider removal and independence", () => {
  it("keeps the historical notification endpoint out of markup and other features", () => {
    const provider = "form" + "spree";
    const formId = "xblz" + "ygzb";
    const root = path.dirname(fileURLToPath(import.meta.url));
    const allowed = new Set([
      path.join(root, "contact-message.js"),
      path.join(root, "contact-message.test.mjs"),
    ]);
    for (const file of readProjectFiles()) {
      if (allowed.has(file)) continue;
      const source = readFileSync(file, "utf8");
      assert.equal(source.toLowerCase().includes(provider), false, file);
      assert.equal(source.includes(formId), false, file);
      assert.equal(source.includes('name="_subject"'), false, file);
      assert.equal(/<form\b[^>]*\baction\s*=/i.test(source), false, file);
    }
    const form = contactFormMarkup();
    assert.equal(/<form\b[^>]*\baction\s*=/i.test(form), false);
    assert.equal(form.toLowerCase().includes(provider), false);
    const submission = readFileSync(new URL("./contact-message.js", import.meta.url), "utf8");
    assert.equal(submission.includes(contact.FORMSPREE_ENDPOINT), true);
    assert.equal(submission.includes(`https://${provider}.io/f/${formId}`), true);
    assert.equal(submission.includes(contact.FORMSPREE_SUBJECT), true);
    assert.equal(contact.FORMSPREE_SUBJECT, "【ArcanaCharm】Webお問い合わせ");
    assert.equal(submission.includes("p_" + "subject"), true);
    assert.equal(submission.includes("submit_contact_message_v1"), false);
    assert.equal(submission.includes("/rest/v1/rpc/submit_contact_message_v2"), true);
    assert.equal(/<form\b[^>]*action\s*=/.test(submission), false);
    assert.equal(/new\s+FormData\s*\(\s*[A-Za-z_$]/.test(submission), false);
  });

  it("does not share initialization with members, gallery, about, or visual collection", () => {
    const source = readFileSync(new URL("./contact-message.js", import.meta.url), "utf8");
    assert.equal(source.includes("get_public_members_v1"), false);
    assert.equal(source.includes("get_public_gallery_v1"), false);
    assert.equal(source.includes("get_public_about_v1"), false);
    assert.equal(source.includes("startMembersCms"), false);
    assert.equal(source.includes("startGalleryCms"), false);
    assert.equal(source.includes("startAboutCms"), false);
    assert.equal(source.includes("submit_contact_message_v1"), false);
    assert.equal(source.includes("/rest/v1/rpc/submit_contact_message_v2"), true);
    for (const file of ["members-cms.js", "gallery-cms.js", "about-cms.js", "visual-collection-nav.js", "script.js"]) {
      const other = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      assert.equal(other.includes("submit_contact_message_v1"), false, file);
      assert.equal(other.includes("submit_contact_message_v2"), false, file);
      assert.equal(other.includes("contact-message"), false, file);
    }
    assert.equal(contact.FETCH_TIMEOUT_MS >= 10000 && contact.FETCH_TIMEOUT_MS <= 15000, true);
    assert.equal(contact.NOTIFICATION_TIMEOUT_MS >= 8000 && contact.NOTIFICATION_TIMEOUT_MS <= 10000, true);
  });
});
