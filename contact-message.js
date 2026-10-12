(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ArcanaContactMessage = api;
  if (root.document) {
    const boot = () => {
      try {
        api.startContactForm();
      } catch {
        /* Contact must not take down the rest of the page. */
      }
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FETCH_TIMEOUT_MS = 12000;
  const SUBJECT_CODES = ["appearance", "business", "fan", "other"];
  const SUCCESS_MESSAGE = "メッセージを送信しました。\nお問い合わせありがとうございます。";
  const FAILURE_MESSAGE = "送信できませんでした。\n時間をおいて、もう一度お試しください。";
  const ERROR_TEXT = {
    nameRequired: "お名前を入力してください。",
    nameLength: "お名前は100文字以内で入力してください。",
    email: "メールアドレスを確認してください。",
    subject: "お問い合わせ内容を選択してください。",
    messageRequired: "メッセージを入力してください。",
    messageLength: "メッセージは5000文字以内で入力してください。",
  };
  const FIELD_SELECTORS = {
    name: "#contact-name",
    email: "#contact-email",
    subject: "#contact-subject",
    message: "#contact-message",
  };
  const ERROR_SELECTORS = {
    name: "#contact-name-error",
    email: "#contact-email-error",
    subject: "#contact-subject-error",
    message: "#contact-message-error",
  };
  const RPC_PATH = "/rest/v1/rpc/submit_contact_message_v2";
  const NOTIFICATION_TIMEOUT_MS = 8000;
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/xblzygzb";
  const FORMSPREE_SUBJECT = "【ArcanaCharm】Webお問い合わせ";
  const SUBJECT_LABELS = {
    appearance: "出演依頼",
    business: "お仕事のご相談",
    fan: "ファンレター・応援",
    other: "その他",
  };

  function publicConfigIsSafe(config) {
    if (!config || typeof config !== "object") return false;
    if (typeof config.supabaseUrl !== "string" || typeof config.supabasePublishableKey !== "string") return false;
    const key = config.supabasePublishableKey;
    if (!config.supabaseUrl.startsWith("https://") || key.length < 20) return false;
    const lowered = key.toLowerCase();
    if (lowered.includes("service_role") || lowered.startsWith("sb_secret_")) return false;
    if (config.supabaseUrl.toLowerCase().includes("draft")) return false;
    try {
      const url = new URL(config.supabaseUrl);
      if (url.protocol !== "https:") return false;
      if (url.username || url.password) return false;
      if (url.search || url.hash) return false;
      if (url.pathname !== "/" && url.pathname !== "") return false;
    } catch {
      return false;
    }
    return true;
  }

  function isPracticalEmail(email) {
    if (typeof email !== "string" || email.length === 0 || email.length > 254) return false;
    if (/\s/.test(email)) return false;
    const at = email.indexOf("@");
    if (at <= 0 || at !== email.lastIndexOf("@")) return false;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!local || !domain || domain.includes("..")) return false;
    if (domain.startsWith(".") || domain.endsWith(".")) return false;
    const dot = domain.lastIndexOf(".");
    if (dot <= 0 || dot === domain.length - 1) return false;
    if (domain.slice(dot + 1).length < 2) return false;
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
    if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
    return true;
  }

  function normalizeContactFields(raw) {
    const source = raw || {};
    return {
      name: String(source.name ?? "").trim(),
      email: String(source.email ?? "").trim(),
      subject: String(source.subject ?? "").trim(),
      message: String(source.message ?? "").trim(),
      company: String(source.company ?? ""),
    };
  }

  function validateContactFields(raw) {
    const fields = normalizeContactFields(raw);
    const errors = { name: "", email: "", subject: "", message: "" };
    if (!fields.name) errors.name = ERROR_TEXT.nameRequired;
    else if (fields.name.length > 100) errors.name = ERROR_TEXT.nameLength;
    if (!isPracticalEmail(fields.email)) errors.email = ERROR_TEXT.email;
    if (!SUBJECT_CODES.includes(fields.subject)) errors.subject = ERROR_TEXT.subject;
    if (!fields.message) errors.message = ERROR_TEXT.messageRequired;
    else if (fields.message.length > 5000) errors.message = ERROR_TEXT.messageLength;
    const firstInvalid = ["name", "email", "subject", "message"].find((key) => errors[key]) || null;
    return {
      ok: firstInvalid === null,
      fields,
      errors,
      firstInvalid,
    };
  }

  function resolveConfig(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, "config")) return options.config;
    return globalThis.ARCANA_PUBLIC_CONFIG;
  }

  function warnFailure() {
    console.warn("Contact submission failed");
  }

  function warnNotification() {
    console.warn("Contact notification failed");
  }

  function rpcStatus(body) {
    if (body === "stored" || body === "ignored") return body;
    return null;
  }

  function buildNotificationBody(fields) {
    const body = new FormData();
    body.append("name", fields.name);
    body.append("email", fields.email);
    body.append("message", fields.message);
    body.append("_subject", FORMSPREE_SUBJECT);
    const label = SUBJECT_LABELS[fields.subject];
    if (typeof label === "string") body.append("お問い合わせ内容", label);
    return body;
  }

  async function submitContactMessage(config, fields, options = {}) {
    if (!publicConfigIsSafe(config)) return { ok: false, reason: "config" };
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== "function") return { ok: false, reason: "config" };
    const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}${RPC_PATH}`;
    if (!endpoint.endsWith(RPC_PATH) || endpoint.includes("contact_messages")) {
      return { ok: false, reason: "config" };
    }
    const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const payload = {
      p_name: fields.name,
      p_email: fields.email,
      p_subject: fields.subject,
      p_message: fields.message,
      p_company: fields.company,
    };
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          apikey: config.supabasePublishableKey,
          Authorization: `Bearer ${config.supabasePublishableKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response || response.ok !== true) return { ok: false, reason: "http" };
      let body;
      try {
        body = await response.json();
      } catch {
        return { ok: false, reason: "payload" };
      }
      const status = rpcStatus(body);
      if (!status) return { ok: false, reason: "payload" };
      return { ok: true, status };
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function notifyContactMessage(fields, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== "function") return { ok: false, reason: "config" };
    const timeoutMs = options.notificationTimeoutMs || NOTIFICATION_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: buildNotificationBody(fields),
        signal: controller.signal,
      });
      if (!response || response.ok !== true) return { ok: false, reason: "http" };
      return { ok: true };
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  function fieldElement(form, key) {
    if (!form || typeof form.querySelector !== "function") return null;
    return form.querySelector(FIELD_SELECTORS[key]);
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    if (typeof element.setAttribute === "function" && typeof element.removeAttribute === "function") {
      if (hidden) element.setAttribute("hidden", "");
      else element.removeAttribute("hidden");
    }
  }

  function hideStatus(form) {
    if (!form || typeof form.querySelector !== "function") return;
    const status = form.querySelector("#contact-status");
    if (!status) return;
    status.textContent = "";
    status.className = "contact-status";
    setHidden(status, true);
  }

  function clearFieldErrors(form) {
    for (const key of Object.keys(FIELD_SELECTORS)) {
      const input = fieldElement(form, key);
      const error = form && form.querySelector ? form.querySelector(ERROR_SELECTORS[key]) : null;
      if (input && typeof input.removeAttribute === "function") input.removeAttribute("aria-invalid");
      if (error) {
        error.textContent = "";
        setHidden(error, true);
      }
    }
  }

  function showFieldErrors(form, validation) {
    let focused = false;
    for (const key of ["name", "email", "subject", "message"]) {
      const input = fieldElement(form, key);
      const error = form.querySelector(ERROR_SELECTORS[key]);
      const message = validation.errors[key];
      if (message) {
        if (input && typeof input.setAttribute === "function") input.setAttribute("aria-invalid", "true");
        if (error) {
          error.textContent = message;
          setHidden(error, false);
        }
        if (!focused) {
          focused = true;
          if (input && typeof input.focus === "function") {
            try {
              input.focus();
            } catch {
              /* Ignore focus failures in non-browser tests. */
            }
          }
        }
      }
    }
  }

  function showStatus(form, kind, text) {
    const status = form.querySelector("#contact-status");
    if (!status) return;
    status.className = kind === "success" ? "contact-status is-success" : "contact-status is-error";
    status.textContent = text;
    if (typeof status.setAttribute === "function") {
      status.setAttribute("role", kind === "success" ? "status" : "alert");
    }
    setHidden(status, false);
    if (typeof status.focus === "function") {
      try {
        status.focus();
      } catch {
        /* Ignore focus failures in non-browser tests. */
      }
    }
  }

  function showSuccess(form) {
    clearFieldErrors(form);
    if (typeof form.reset === "function") form.reset();
    const company = form.querySelector("#contactCompany");
    if (company) company.value = "";
    showStatus(form, "success", SUCCESS_MESSAGE);
  }

  function showFailure(form) {
    showStatus(form, "failure", FAILURE_MESSAGE);
  }

  function setSubmittingUi(form, submitting) {
    const button = form.querySelector(".submit-btn");
    if (!button) return;
    button.disabled = Boolean(submitting);
    button.textContent = submitting ? "送信中..." : "送信";
  }

  function readContactFields(form) {
    const read = (selector) => {
      const element = form.querySelector(selector);
      return element && typeof element.value === "string" ? element.value : "";
    };
    return {
      name: read(FIELD_SELECTORS.name),
      email: read(FIELD_SELECTORS.email),
      subject: read(FIELD_SELECTORS.subject),
      message: read(FIELD_SELECTORS.message),
      company: read("#contactCompany"),
    };
  }

  async function handleContactSubmit(form, options = {}, guard) {
    const state = guard || { active: false };
    if (state.active) return { ok: false, reason: "inflight" };
    if (!form || typeof form.querySelector !== "function") return { ok: false, reason: "missing" };
    hideStatus(form);
    const normalized = normalizeContactFields(readContactFields(form));
    const validation = validateContactFields(normalized);
    clearFieldErrors(form);
    if (!validation.ok) {
      showFieldErrors(form, validation);
      return { ok: false, reason: "validation", firstInvalid: validation.firstInvalid };
    }
    state.active = true;
    setSubmittingUi(form, true);
    let acceptedStatus = null;
    try {
      const result = await submitContactMessage(resolveConfig(options), {
        name: validation.fields.name,
        email: validation.fields.email,
        subject: validation.fields.subject,
        message: validation.fields.message,
        company: normalized.company,
      }, options);
      if (!result.ok || !rpcStatus(result.status)) {
        warnFailure();
        showFailure(form);
        return { ok: false, reason: result.reason || "payload" };
      }
      acceptedStatus = result.status;
      let notified = false;
      if (result.status === "stored") {
        const notice = await notifyContactMessage({
          name: validation.fields.name,
          email: validation.fields.email,
          subject: validation.fields.subject,
          message: validation.fields.message,
        }, options);
        notified = notice.ok === true;
        if (!notified) warnNotification();
      }
      showSuccess(form);
      return { ok: true, status: result.status, notified };
    } catch {
      if (acceptedStatus) {
        if (acceptedStatus === "stored") warnNotification();
        showSuccess(form);
        return { ok: true, status: acceptedStatus, notified: false };
      }
      warnFailure();
      showFailure(form);
      return { ok: false, reason: "error" };
    } finally {
      state.active = false;
      setSubmittingUi(form, false);
    }
  }

  function startContactForm(options = {}) {
    try {
      const doc = Object.prototype.hasOwnProperty.call(options, "document")
        ? options.document
        : globalThis.document;
      if (!doc || typeof doc.getElementById !== "function") return { started: false, reason: "missing" };
      const form = doc.getElementById("contactForm");
      if (!form || typeof form.addEventListener !== "function") return { started: false, reason: "missing" };
      if (typeof form.getAttribute === "function" && form.getAttribute("data-contact-bound") === "true") {
        return { started: true, reason: "bound" };
      }
      if (typeof form.setAttribute === "function") form.setAttribute("data-contact-bound", "true");
      const guard = { active: false };
      form.addEventListener("submit", (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        const task = handleContactSubmit(form, options, guard);
        if (event && typeof event === "object") event.contactTask = task;
      });
      return { started: true, reason: "bound" };
    } catch {
      return { started: false, reason: "error" };
    }
  }

  return {
    FETCH_TIMEOUT_MS,
    NOTIFICATION_TIMEOUT_MS,
    FORMSPREE_ENDPOINT,
    FORMSPREE_SUBJECT,
    SUBJECT_LABELS,
    SUBJECT_CODES,
    SUCCESS_MESSAGE,
    FAILURE_MESSAGE,
    ERROR_TEXT,
    publicConfigIsSafe,
    normalizeContactFields,
    validateContactFields,
    submitContactMessage,
    handleContactSubmit,
    startContactForm,
  };
});
