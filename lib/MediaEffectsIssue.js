function getErrorMessage(error)
{
  return error && error.message ? error.message : String(error);
}

function stringifyDetails(details)
{
  try
  {
    return JSON.stringify(details || {});
  }
  catch (error)
  {
    return `[unserializable details: ${getErrorMessage(error)}]`;
  }
}

function normalizeIssue(defaults, issue)
{
  return Object.assign({}, defaults, issue || {});
}

function logIssue(logger, prefix, issue, includeComponent)
{
  const loggerMethod = logger[issue.severity] || logger.warn;
  let message = `${prefix}: `;

  if (includeComponent)
  {
    message += `component=${issue.component} `;
  }

  message +=
    `stage=${issue.stage} severity=${issue.severity} ` +
    `fallbackApplied=${Boolean(issue.fallbackApplied)} degraded=${Boolean(issue.degraded)} ` +
    `message=${issue.message} details=${stringifyDetails(issue.details)}`;

  loggerMethod.call(logger, message);
}

function forwardIssue(onIssue, issue, logger, callbackWarnPrefix, cloneIssue)
{
  if (!onIssue)
  {
    return;
  }

  try
  {
    onIssue(cloneIssue ? cloneIssue(issue) : issue);
  }
  catch (error)
  {
    if (logger && typeof logger.warn === 'function')
    {
      logger.warn(`${callbackWarnPrefix}: ${getErrorMessage(error)}`);
    }
  }
}

function emitIssue(onIssue, defaults, issue, logger, callbackWarnPrefix)
{
  if (!onIssue)
  {
    return;
  }

  try
  {
    onIssue(normalizeIssue(defaults, issue));
  }
  catch (error)
  {
    if (logger && typeof logger.warn === 'function')
    {
      logger.warn(`${callbackWarnPrefix}: ${getErrorMessage(error)}`);
    }
  }
}

module.exports = {
  emitIssue,
  forwardIssue,
  getErrorMessage,
  logIssue,
  normalizeIssue
};
