/* eslint-disable no-console */
async function runSuite(options)
{
  const suiteName = options.suiteName;
  const tests = options.tests || [];
  const beforeEach = typeof options.beforeEach === 'function' ? options.beforeEach : null;
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests)
  {
    if (beforeEach)
    {
      await beforeEach(test);
    }

    try
    {
      await test.fn();
      passed++;
    }
    catch (error)
    {
      failed++;
      failures.push({ name: test.name, error });
    }
  }

  if (failures.length > 0)
  {
    console.log(`\n  ${suiteName} Failures (${failed}):`);
    for (const failure of failures)
    {
      console.log(`    ✗ ${failure.name}`);
      console.log(`      ${failure.error.message}`);
    }
  }

  console.log(`  ${suiteName} Tests: ${passed} passed, ${failed} failed, ${tests.length} total`);

  if (failed > 0)
  {
    throw new Error(`${failed} ${suiteName} test(s) failed`);
  }
}

module.exports = {
  runSuite
};
