/**
 * AINoiseSuppression 资源加载器。
 *
 * 职责：
 * 1. 统一管理 WASM 与模型文件的根路径。
 * 2. 生成固定的资源 URL，避免业务层散落路径拼接逻辑。
 * 3. 提供基础的二进制拉取能力，供 Core 初始化阶段复用。
 *
 * 说明：
 * - 这里不做 WebAudio、Worklet、MediaStream 相关逻辑，保持单一职责。
 * - 若后续要改成私有 CDN、本地静态目录或按环境切换路径，只改这里即可。
 */
const DEFAULT_CDN_URL = './static';

class AssetLoader
{
  /**
   * @param {Object} [config]
   * @param {string} [config.cdnUrl] AINoiseSuppression 静态资源根路径。
   */
  constructor(config = {})
  {
    this.cdnUrl = config.cdnUrl || DEFAULT_CDN_URL;
  }

  /**
   * 根据根路径拼出完整资源地址。
   *
   * @param {string} relativePath AINoiseSuppression 资源相对路径。
   * @returns {string}
   */
  getCdnUrl(relativePath)
  {
    return `${this.cdnUrl}/${relativePath}`;
  }

  /**
   * 返回当前版本 AINoiseSuppression 所需的资源清单。
   *
   * 这里固定了：
   * - `ans.js`：WASM 胶水代码
   * - `ans_bg.wasm`：WASM 运行时
   * - `ans_onnx.tar.gz`：模型压缩包
   *
   * @returns {{glue: string, wasm: string, model: string}}
   */
  getAssetUrls()
  {
    return {
      glue  : this.getCdnUrl('v2/ans.js'),
      wasm  : this.getCdnUrl('v2/ans.wasm'),
      model : this.getCdnUrl('v2/ans_onnx.tar.gz')
    };
  }

  /**
   * 拉取远端二进制资源并返回 ArrayBuffer。
   *
   * @param {string} url
   * @returns {Promise<ArrayBuffer>}
   */
  async fetchAsset(url)
  {
    const response = await fetch(url);

    if (!response.ok)
    {
      throw new Error(`Failed to fetch asset: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }
}

let defaultLoader = null;

/**
 * 获取默认 AssetLoader。
 *
 * 设计成单例的原因：
 * - 同一个页面通常只需要一套资源定位配置；
 * - 避免重复创建 loader 对象；
 * - 保留通过新 config 覆盖默认实例的能力。
 *
 * @param {Object} [config]
 * @returns {AssetLoader}
 */
function getAssetLoader(config)
{
  if (!defaultLoader || config)
  {
    defaultLoader = new AssetLoader(config);
  }

  return defaultLoader;
}

exports.AssetLoader = AssetLoader;
exports.getAssetLoader = getAssetLoader;
exports.DEFAULT_CDN_URL = DEFAULT_CDN_URL;
