import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";

// No browser, credentials, network, or real Supabase module is loaded. Execute
// production TSX with a small hook lifecycle double; this is not React DOM E2E.
const require = createRequire(import.meta.url);
const source = path => readFileSync(new URL(`../client/src/${path}`, import.meta.url), "utf8");
function compile(code, imports) {
  const { outputText } = ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  } });
  const exports = {};
  new Function("require", "exports", "window", "localStorage", outputText)(name => {
    assert.ok(name in imports, `Unexpected dependency: ${name}`);
    return imports[name];
  }, exports, new EventTarget(), { removeItem() {} });
  return exports;
}
const status = compile(source("utils/lectureStatus.ts"), {});
const date = compile(source("lib/date.ts"), {});
const app = ts.createSourceFile("App.tsx", source("App.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const gate = app.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "AuthGate");
assert.ok(gate);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let auth = { loading: false, session: null, user: null };
  let current;
  const requests = [], notifications = [], instances = [];
  const react = {
    ...React,
    useState(initial) {
      const instance = current, index = instance.cursor++;
      if (!(index in instance.slots)) instance.slots[index] = typeof initial === "function" ? initial() : initial;
      return [instance.slots[index], value => {
        instance.writes++;
        instance.slots[index] = typeof value === "function" ? value(instance.slots[index]) : value;
      }];
    },
    useRef(value) {
      const index = current.cursor++;
      return current.slots[index] ??= { current: value };
    },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) { effect(fn, deps); },
    useLayoutEffect(fn, deps) { effect(fn, deps); },
  };
  function effect(fn, deps) {
    const index = current.cursor++, previous = current.effects[index];
    if (!previous || deps.some((v, i) => !Object.is(v, previous.deps[i]))) {
      current.pending.push(() => {
        previous?.cleanup?.();
        current.effects[index] = { deps, cleanup: fn() };
      });
    }
  }
  const supabase = { from(table) {
    const request = { table, operation: "select", owner: null, trash: false, ...deferred() };
    const query = {};
    for (const method of ["select", "delete", "update", "eq", "is", "not", "lt", "in", "order", "maybeSingle"]) {
      query[method] = (...args) => {
        if (["delete", "update"].includes(method)) request.operation = method;
        if (method === "eq" && args[0] === "user_id") request.owner = args[1];
        if (method === "not" && args[0] === "deleted_at") request.trash = true;
        return query;
      };
    }
    query.then = (yes, no) => {
      if (!requests.includes(request)) requests.push(request);
      return request.promise.then(yes, no);
    };
    return query;
  } };
  const { SupabaseProvider } = compile(source("contexts/SupabaseContext.tsx"), {
    react, "../lib/supabase": { supabase }, "../lib/date": date,
    "./AuthContext": { useAuth: () => auth }, nanoid: require("nanoid"),
    sonner: { toast: Object.fromEntries(["error", "success", "warning", "info"].map(k => [k, (...args) => notifications.push([k, ...args])])) },
    "../services/naverRouteService": { getRouteInfo() { throw Error("External service forbidden"); } },
    "../utils/lectureStatus": status,
  });
  const AuthGate = new Function("React", "useAuth", "SupabaseProvider", "AuthenticatedApp", "LoginPage", "AuthLoadingScreen",
    ts.transpileModule(`${gate.getText(app)}\nreturn AuthGate;`, { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText
  )(React, () => auth, SupabaseProvider, () => null, () => null, () => null);
  function unmount() {
    if (current) for (const item of current.effects) item?.cleanup?.();
    current = null;
  }
  function render(owner, token = "first", loading = false) {
    auth = { loading, user: owner ? { id: owner } : null,
      session: owner ? { user: { id: owner }, access_token: token } : null };
    const element = AuthGate();
    if (element.type !== SupabaseProvider) { unmount(); return null; }
    if (!current || current.key !== element.key) {
      unmount();
      current = { key: element.key, slots: [], effects: [], pending: [], cursor: 0, writes: 0 };
      instances.push(current);
    }
    current.cursor = 0;
    // Capture the render BEFORE effects, so an effect-only reset cannot pass.
    const value = SupabaseProvider(element.props).props.value;
    for (const run of current.pending.splice(0)) run();
    return value;
  }
  function settle(owner, { past = false, error = null, reject = false, operation } = {}) {
    for (const r of requests.filter(r => r.owner === owner && !r.done && (!operation || r.operation === operation))) {
      r.done = true;
      if (reject) { r.reject(new Error("mock rejected request")); continue; }
      let data = [{ id: `${owner}-${r.table}`, user_id: owner }];
      if (r.table === "lectures") data = [{ id: `${owner}-${r.trash ? "trash" : "lectures"}`, user_id: owner,
        date: past ? "2000-01-01" : "2099-01-01", workflowStage: "before" }];
      if (r.table === "instructor_profile") data = { id: `${owner}-profile`, name: owner, user_id: owner };
      r.resolve({ data, error });
    }
  }
  return { render, settle, requests, notifications, instances, unmount };
}
const lists = ["lectures", "todos", "workTasks", "smsHistory", "contactLogs", "deletedLectures"];
function empty(value) {
  for (const field of lists) assert.deepEqual(value[field], [], field);
  assert.equal(value.profile, null);
  assert.equal(value.loading, true);
  assert.equal(value.error, null);
  assert.equal(value.trashLoading, false);
}
function owned(value, owner) {
  for (const field of lists.filter(k => k !== "deletedLectures")) {
    assert.equal(value[field].length, 1, field);
    // Production normalizers deliberately omit user_id from some view models.
    // Distinct fixture IDs remain present in every displayed collection.
    assert.ok(value[field][0].id.startsWith(`${owner}-`), field);
  }
  assert.equal(value.profile.user_id, owner);
  assert.equal(value.loading, false);
}

test("A → B → A: every account starts empty before effects, including previously loaded trash", async () => {
  const h = harness();
  for (const owner of ["A", "B", "A"]) {
    empty(h.render(owner));
    await flush(); h.settle(owner); await flush();
    const value = h.render(owner); owned(value, owner);
    const trash = value.refreshDeletedLectures();
    await flush(); h.settle(owner); await trash;
    assert.equal(h.render(owner).deletedLectures[0].id, `${owner}-trash`);
  }
  h.unmount();
});

test("late A success cannot update state/loading or start automatic UPDATE after B finishes", async () => {
  const h = harness(); h.render("A"); await flush();
  h.render("B"); await flush(); h.settle("B"); await flush();
  const writes = h.instances[0].writes;
  h.settle("A", { past: true }); await flush();
  owned(h.render("B"), "B");
  assert.equal(h.instances[0].writes, writes);
  assert.equal(h.requests.filter(r => r.owner === "A" && r.operation === "update").length, 0);
  assert.deepEqual(h.notifications, []); h.unmount();
});

for (const reject of [false, true]) test(`late A ${reject ? "rejection" : "read error"} stays silent while B loads`, async () => {
  const h = harness(); h.render("A"); await flush();
  empty(h.render("B")); await flush();
  const writes = h.instances[0].writes;
  h.settle("A", { error: { message: "mock error" }, reject }); await flush();
  empty(h.render("B")); assert.equal(h.instances[0].writes, writes);
  assert.deepEqual(h.notifications, []);
  h.settle("B"); await flush(); owned(h.render("B"), "B"); h.unmount();
});

test("logout hides loaded data immediately and invalidates pending initialization", async () => {
  const h = harness(); h.render("A"); await flush(); h.settle("A"); await flush();
  owned(h.render("A"), "A"); assert.equal(h.render(null), null);
  h.render("B"); await flush(); assert.equal(h.render(null), null);
  const writes = h.instances[1].writes;
  h.settle("B", { reject: true }); await flush();
  assert.equal(h.instances[1].writes, writes); assert.deepEqual(h.notifications, []);
  empty(h.render("A")); h.unmount();
});

test("same user token refresh preserves data and does not restart initialization", async () => {
  const h = harness(); h.render("A"); await flush(); h.settle("A"); await flush();
  const previous = h.render("A"), count = h.requests.length;
  const refreshed = h.render("A", "refreshed"); await flush();
  owned(refreshed, "A"); assert.equal(refreshed.lectures, previous.lectures);
  assert.equal(h.requests.length, count); assert.equal(h.instances.length, 1); h.unmount();
});

test("current account load error still reports failure; switching clears it", async () => {
  const h = harness(); h.render("A"); await flush();
  h.settle("A", { error: { message: "expected mock load error" } }); await flush();
  const failed = h.render("A"); assert.equal(failed.loading, false); assert.ok(failed.error);
  assert.equal(h.notifications.length, 1); empty(h.render("B")); h.unmount();
});

test("transition already sent before logout may finish, but cannot publish state", async () => {
  const h = harness(); h.render("A"); await flush(); h.settle("A", { past: true }); await flush();
  assert.equal(h.requests.filter(r => r.operation === "update").length, 1);
  assert.equal(h.render(null), null); const writes = h.instances[0].writes;
  h.settle("A", { operation: "update" }); await flush();
  assert.equal(h.instances[0].writes, writes); assert.deepEqual(h.notifications, []);
});

test("current account automatic transition behavior is preserved", async () => {
  const h = harness(); h.render("A"); await flush(); h.settle("A", { past: true }); await flush();
  h.settle("A", { operation: "update" }); await flush();
  assert.equal(h.render("A").lectures[0].workflowStage, "after"); h.unmount();
});

test("late trash response remains in the retired provider, never in the next account", async () => {
  const h = harness(); h.render("A"); await flush(); h.settle("A"); await flush();
  const trash = h.render("A").refreshDeletedLectures(); await flush();
  empty(h.render("B")); await flush(); h.settle("B"); await flush();
  h.settle("A"); await trash;
  const value = h.render("B"); owned(value, "B");
  assert.deepEqual(value.deletedLectures, []); assert.equal(value.trashLoading, false); h.unmount();
});

test("A → B → A: the first A request cannot publish into the new A lifetime", async () => {
  const h = harness(); h.render("A"); await flush();
  const oldA = [...h.requests];
  h.render("B"); await flush(); empty(h.render("A")); await flush();
  const writes = h.instances[0].writes;
  for (const r of oldA) { r.done = true; r.resolve({ data: null, error: { message: "old A" } }); }
  h.settle("B", { reject: true }); await flush();
  empty(h.render("A")); assert.equal(h.instances[0].writes, writes);
  assert.deepEqual(h.notifications, []);
  h.settle("A"); await flush(); owned(h.render("A"), "A"); h.unmount();
});
