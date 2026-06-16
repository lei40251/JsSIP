/**
 * AiVBSegmentationCommon —— 主线程 / Worker 共用的纯分割辅助逻辑。
 *
 * 这里刻意只放与宿主环境无关的代码：
 *   - segmenter 初始化参数
 *   - 从 MediaPipe 结果里选择人物遮罩
 *   - 读取遮罩数值
 *   - 释放分割结果资源
 *   - 将置信度写入 alpha 通道
 *
 * 不放这里的内容：
 *   - DOM / script 注入
 *   - Worker 动态 import
 *   - canvas / OffscreenCanvas 的创建与生命周期
 *
 * 这样主线程和 Worker 能共享同一套业务规则，同时保留各自的宿主实现。
 */

function createSegmentationHelpers()
{
  function createSegmenterOptions(modelUrl, delegate)
  {
    return {
      baseOptions : {
        modelAssetPath : modelUrl,
        delegate
      },
      runningMode           : 'VIDEO',
      outputCategoryMask    : false,
      outputConfidenceMasks : true
    };
  }

  function resolveRuntimeOptions(assetConfig, modelPath)
  {
    const safeAssetConfig = assetConfig && typeof assetConfig === 'object' ? assetConfig : {};

    return {
      moduleUrl   : typeof safeAssetConfig.moduleUrl === 'string' ? safeAssetConfig.moduleUrl : '',
      wasmBaseUrl : typeof safeAssetConfig.wasmBaseUrl === 'string' ? safeAssetConfig.wasmBaseUrl : '',
      modelUrl    : typeof modelPath === 'string' && modelPath.trim()
        ? modelPath.trim()
        : (typeof safeAssetConfig.modelUrl === 'string' ? safeAssetConfig.modelUrl : '')
    };
  }

  function resolvePersonMaskIndex(labels, maskCount)
  {
    const safeLabels = Array.isArray(labels) ? labels : [];

    for (let index = 0; index < safeLabels.length; index += 1)
    {
      if (typeof safeLabels[index] === 'string' && /person/i.test(safeLabels[index]))
      {
        return index;
      }
    }

    if (maskCount > 1)
    {
      return maskCount - 1;
    }

    return 0;
  }

  function resolveOutputMask(result, labels)
  {
    if (result && Array.isArray(result.confidenceMasks) && result.confidenceMasks.length > 0)
    {
      const personMaskIndex = resolvePersonMaskIndex(labels, result.confidenceMasks.length);

      return {
        mask : result.confidenceMasks[personMaskIndex],
        personMaskIndex
      };
    }

    if (result && result.categoryMask)
    {
      return {
        mask            : result.categoryMask,
        personMaskIndex : 0
      };
    }

    throw new Error('ImageSegmenter did not return a supported mask output');
  }

  function readMaskValues(mask)
  {
    if (!mask)
    {
      throw new Error('ImageSegmenter mask is required');
    }

    if (typeof mask.getAsFloat32Array === 'function')
    {
      return mask.getAsFloat32Array();
    }

    if (typeof mask.getAsUint8Array === 'function')
    {
      const categoryValues = mask.getAsUint8Array();
      const floatValues = new Float32Array(categoryValues.length);

      for (let index = 0; index < categoryValues.length; index += 1)
      {
        floatValues[index] = categoryValues[index] > 0 ? 1 : 0;
      }

      return floatValues;
    }

    throw new Error('Unsupported ImageSegmenter mask format');
  }

  function closeSegmentationResult(result)
  {
    if (result && typeof result.close === 'function')
    {
      result.close();

      return;
    }

    if (result && Array.isArray(result.confidenceMasks))
    {
      result.confidenceMasks.forEach((mask) =>
      {
        if (mask && typeof mask.close === 'function')
        {
          mask.close();
        }
      });
    }

    if (result && result.categoryMask && typeof result.categoryMask.close === 'function')
    {
      result.categoryMask.close();
    }
  }

  function fillAlphaMaskImageData(confidenceValues, imageData, alphaBias)
  {
    let offset = 0;

    for (let index = 0; index < confidenceValues.length; index += 1)
    {
      const normalizedAlpha = Math.max(
        0,
        Math.min(1, (confidenceValues[index] - alphaBias) / (1 - alphaBias))
      );
      const alpha = Math.max(0, Math.min(255, Math.round(normalizedAlpha * 255)));

      imageData[offset] = 0;
      imageData[offset + 1] = 0;
      imageData[offset + 2] = 0;
      imageData[offset + 3] = alpha;
      offset += 4;
    }
  }

  return {
    closeSegmentationResult,
    createSegmenterOptions,
    fillAlphaMaskImageData,
    readMaskValues,
    resolveRuntimeOptions,
    resolveOutputMask,
    resolvePersonMaskIndex
  };
}

exports.createSegmentationHelpers = createSegmentationHelpers;
exports.getWorkerSegmentationHelpersFactorySource = function()
{
  return createSegmentationHelpers.toString();
};
