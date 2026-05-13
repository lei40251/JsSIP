const MODERN_OPTION_KEYS = [
  'width',
  'height',
  'fps',
  'layoutMode',
  'backgroundColor',
  'audioGain',
  'renderMode',
  'workerUrl',
  'dropFrameWhenBusy',
  'maxFrameQueue',
  'preserveDrawingBuffer'
];

const VALID_RENDER_MODES = {
  auto            : true,
  'worker-webgl2' : true,
  'main-webgl2'   : true,
  'worker-2d'     : true,
  'main-2d'       : true
};

exports.create = function(options)
{
  options = options || {};

  const hasModernOptions = exports.hasMixerOptions(options);
  const hasExplicitRenderMode = Object.prototype.hasOwnProperty.call(options, 'renderMode');
  const layoutMode = options.layoutMode || (hasModernOptions ? 'grid' : 'legacy');

  return {
    hasModernOptions      : hasModernOptions,
    hasExplicitRenderMode : hasExplicitRenderMode,
    layoutMode            : layoutMode,
    config                : {
      width                 : exports.normalizePositiveInteger(options.width, layoutMode === 'legacy' ? null : 1280),
      height                : exports.normalizePositiveInteger(options.height, layoutMode === 'legacy' ? null : 720),
      fps                   : exports.normalizePositiveInteger(options.fps, null),
      backgroundColor       : options.backgroundColor || '#000',
      audioGain             : exports.normalizeGain(options.audioGain, 0.8),
      renderMode            : exports.normalizeRenderMode(options.renderMode, layoutMode === 'legacy' ? 'main-2d' : 'auto'),
      workerUrl             : typeof options.workerUrl === 'string' ? options.workerUrl : null,
      dropFrameWhenBusy     : options.dropFrameWhenBusy === false ? false : true,
      maxFrameQueue         : exports.normalizePositiveInteger(options.maxFrameQueue, 1),
      preserveDrawingBuffer : options.preserveDrawingBuffer === false ? false : true
    }
  };
};

exports.hasMixerOptions = function(options)
{
  return Boolean(
    options &&
    MODERN_OPTION_KEYS.some((key) => Object.prototype.hasOwnProperty.call(options, key))
  );
};

exports.normalizeRenderMode = function(value, fallback)
{
  if (typeof value === 'string' && VALID_RENDER_MODES[value])
  {
    return value;
  }

  return fallback || 'auto';
};

exports.normalizePositiveInteger = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0)
  {
    return Math.floor(numberValue);
  }

  return fallback;
};

exports.normalizeSlot = function(value, index)
{
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue))
  {
    return null;
  }

  return Math.max(0, Math.floor(numberValue)) + index;
};

exports.normalizeGain = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue >= 0)
  {
    return numberValue;
  }

  return fallback;
};

exports.normalizeSourceOptions = function(optionsOrSlot, index, defaultGain)
{
  const options = {};

  if (typeof optionsOrSlot === 'number')
  {
    options.slot = exports.normalizeSlot(optionsOrSlot, index);
  }
  else if (optionsOrSlot && typeof optionsOrSlot === 'object')
  {
    if (typeof optionsOrSlot.slot === 'number')
    {
      options.slot = exports.normalizeSlot(optionsOrSlot.slot, index);
    }

    if (typeof optionsOrSlot.gain === 'number')
    {
      options.gain = exports.normalizeGain(optionsOrSlot.gain, defaultGain);
    }
  }

  return options;
};
