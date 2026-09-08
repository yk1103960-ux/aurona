import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual hook with isolated state/effect scheduling and deferred
// role responses. This is a lifecycle regression test, not browser/session QA.
const source = ts.transpileModule(readFileSync(new URL("./useAdmin.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture() {
  let auth = { user: null, loading: false };
  const states = [];
  const effects = [];
  const requests = [];
  let cursor = 0;
  let changed = false;
  let pending = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value) => {
          states[index] = value;
          changed = true;
        },
      ];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const old = effects[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        pending.push(() => {
          old?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const supabase = {
    from(table) {
      assert.equal(table, "user_roles");
      let userId;
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          if (key === "user_id") userId = value;
          return query;
        },
        maybeSingle() {
          return new Promise((resolve, reject) => requests.push({ userId, resolve, reject }));
        },
      };
      return query;
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "./useAuth") return { useAuth: () => auth };
      if (name === "@/integrations/supabase/client") return { supabase };
      if (name === "@/lib/admin-realtime") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    changed = false;
    pending = [];
    const result = exports.useAdmin();
    pending.forEach((run) => run());
    return result;
  };
  return {
    requests,
    render,
    signIn(id) {
      auth = { user: { id }, loading: false };
      return render();
    },
    signOut() {
      auth = { user: null, loading: false };
      return render();
    },
    async answer(index, allowed, error = null) {
      requests[index].resolve({ data: allowed ? { role: "admin" } : null, error });
      await new Promise((resolve) => setImmediate(resolve));
      let result = render();
      while (changed) result = render();
      return result;
    },
    async reject(index) {
      requests[index].reject(new Error("Role request failed"));
      await new Promise((resolve) => setImmediate(resolve));
      return render();
    },
  };
}

test("same-user session refresh rechecks access without unmounting the editor", async () => {
  const app = fixture();
  assert.equal(app.signIn("admin-a").loading, true);
  assert.equal((await app.answer(0, true)).isAdmin, true);
  for (let i = 1; i <= 3; i++) {
    const refreshing = app.signIn("admin-a"); // Fresh auth User object, same ID.
    assert.equal(refreshing.loading, false);
    assert.equal(refreshing.isAdmin, true);
    assert.equal(app.requests[i].userId, "admin-a", "role checks still run");
    assert.equal((await app.answer(i, true)).loading, false);
  }
});

test("a different account cannot inherit the previous admin decision", async () => {
  const app = fixture();
  app.signIn("admin-a");
  await app.answer(0, true);
  const switched = app.signIn("user-b");
  assert.equal(switched.loading, true);
  assert.equal(switched.isAdmin, null, "block on the render before effects run");
  assert.equal((await app.answer(1, false)).isAdmin, false);
});

test("stale verification responses cannot overwrite the current account", async () => {
  const app = fixture();
  app.signIn("admin-a");
  app.signIn("user-b");
  assert.equal((await app.answer(1, false)).isAdmin, false);
  assert.equal((await app.answer(0, true)).isAdmin, false);
});

test("sign-out clears verification and the same account must verify again", async () => {
  const app = fixture();
  app.signIn("admin-a");
  await app.answer(0, true);
  app.signIn("admin-a");
  assert.equal(app.signOut().isAdmin, false);
  assert.equal((await app.answer(1, true)).isAdmin, false);
  assert.equal(app.signIn("admin-a").loading, true);
});

test("role removal and query failures still revoke access", async () => {
  const app = fixture();
  app.signIn("admin-a");
  await app.answer(0, true);
  app.signIn("admin-a");
  assert.equal((await app.answer(1, false)).isAdmin, false);
  app.signIn("admin-a");
  assert.equal((await app.answer(2, true, { message: "Denied" })).isAdmin, false);
  app.signIn("admin-a");
  const rejected = await app.reject(3);
  assert.equal(rejected.isAdmin, false);
  assert.equal(rejected.loading, false);
});
