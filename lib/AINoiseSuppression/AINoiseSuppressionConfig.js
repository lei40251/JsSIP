const Logger = require('../Logger');

const logger = new Logger('AINoiseSuppressionConfig');

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_SUPPRESSION_LEVEL = 80;
const DEFAULT_CDN_URL = './static';

exports.DEFAULT_SAMPLE_RATE = DEFAULT_SAMPLE_RATE;
exports.DEFAULT_SUPPRESSION_LEVEL = DEFAULT_SUPPRESSION_LEVEL;
exports.DEFAULT_CDN_URL = DEFAULT_CDN_URL;

exports.create = function(options)
{
  options = options && typeof options === 'object' ? options : {};

  const config = {
    enabled             : exports.normalizeBoolean(options.enabled, true),
    preserveOtherTracks : exports.normalizeBoolean(options.preserveOtherTracks, true),
    sampleRate          : exports.normalizePositiveInteger(options.sampleRate, DEFAULT_SAMPLE_RATE),
    noiseReductionLevel : exports.normalizeSuppressionLevel(options.noiseReductionLevel, DEFAULT_SUPPRESSION_LEVEL),
    assetConfig         : exports.normalizeAssetConfig(options.assetConfig)
  };

  logger.debug(`Config created: ${JSON.stringify(config)}`);

  return config;
};

exports.normalizeBoolean = function(value, fallback)
{
  if (typeof value === 'boolean')
  {
    return value;
  }

  if (value !== undefined)
  {
    logger.debug(`normalizeBoolean fallback: value=${value} fallback=${fallback}`);
  }

  return Boolean(fallback);
};

exports.normalizePositiveInteger = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0)
  {
    return Math.floor(numberValue);
  }

  if (value !== undefined)
  {
    logger.debug(`normalizePositiveInteger fallback: value=${value} fallback=${fallback}`);
  }

  return fallback;
};

exports.normalizeSuppressionLevel = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue))
  {
    return Math.max(0, Math.min(100, Math.floor(numberValue)));
  }

  if (value !== undefined)
  {
    logger.debug(`normalizeSuppressionLevel fallback: value=${value} fallback=${fallback}`);
  }

  return fallback;
};

exports.normalizeAssetConfig = function(assetConfig)
{
  if (!assetConfig || typeof assetConfig !== 'object')
  {
    if (assetConfig !== undefined && assetConfig !== null)
    {
      logger.debug(`normalizeAssetConfig fallback: invalid value=${assetConfig}`);
    }

    return null;
  }

  const normalized = {};

  if (typeof assetConfig.cdnUrl === 'string' && assetConfig.cdnUrl.trim())
  {
    normalized.cdnUrl = assetConfig.cdnUrl.trim();
  }
  else if (assetConfig.cdnUrl !== undefined)
  {
    logger.debug(`normalizeAssetConfig ignore cdnUrl: value=${assetConfig.cdnUrl}`);
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};
