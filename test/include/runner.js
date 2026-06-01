/* eslint-disable no-console, no-var, key-spacing, no-inner-declarations */
/**
 * Shared test runner for nodeunit-style test files.
 *
 * Wraps old nodeunit exports (module.exports = { 'name': fn(test) {...} })
 * into a Promise-based runner with a one-line summary, matching the output
 * style of test-bfcp, test-mixer, and test-rtcsession-mixer.
 */
const assert = require('assert');

/**
 * @param {string} label   Suite label, e.g. "SDK Classes"
 * @param {object} tests   nodeunit-style module.exports object
 * @returns {Promise<void>}
 */
function run(label, tests)
{
  const entries = Object.entries(tests);

  return new Promise(function(resolve, reject)
  {
    var passed = 0;
    var failed = 0;
    var failures = [];
    var remaining = entries.length;

    if (remaining === 0)
    {
      console.log(`  ${label} Tests: 0 passed, 0 failed, 0 total`);
      resolve();

      return;
    }

    function recordFailure(ctx, message)
    {
      if (ctx.doneCalled) return;
      failed++;
      failures.push({ name: ctx.name, error: new Error(message) });
      ctx.doneCalled = true;
      tick();
    }

    function tick()
    {
      remaining--;
      if (remaining === 0) printSummary();
    }

    function printSummary()
    {
      if (failures.length > 0)
      {
        console.log(`\n  ${label} Failures (${failed}):`);
        for (var i = 0; i < failures.length; i++)
        {
          console.log(`    ✗ ${failures[i].name}`);
          console.log(`      ${failures[i].error.message}`);
        }
      }
      console.log(`  ${label} Tests: ${passed} passed, ${failed} failed, ${entries.length} total`);

      if (failed > 0)
      {
        reject(new Error(`${failed} ${label} test(s) failed`));
      }
      else
      {
        resolve();
      }
    }

    function makeTestObj(ctx)
    {
      return {
        done: function()
        {
          if (ctx.doneCalled) return;
          ctx.doneCalled = true;
          passed++;
          tick();
        },

        strictEqual: function(actual, expected, msg)
        {
          assert.strictEqual(actual, expected, msg);
        },

        equal: function(actual, expected, msg)
        {
          assert.strictEqual(actual, expected, msg);
        },

        ok: function(value, msg)
        {
          assert.ok(value, msg);
        },

        deepEqual: function(actual, expected, msg)
        {
          assert.deepStrictEqual(actual, expected, msg);
        },

        throws: function(fnThrowing, expectedError, msg)
        {
          assert.throws(fnThrowing, expectedError, msg);
        }
      };
    }

    for (var j = 0; j < entries.length; j++)
    {
      var name = entries[j][0];
      var fn = entries[j][1];
      var ctx = { name: name, doneCalled: false };

      try
      {
        fn(makeTestObj(ctx));
      }
      catch (ex)
      {
        recordFailure(ctx, ex.message || ex.toString());
      }
    }
  });
}

module.exports = { run: run };
