/**
 * 主线程与 AudioWorklet 之间的消息类型。
 *
 * 目前只保留两个最小控制面：
 * - `SET_SUPPRESSION_LEVEL`：动态调整降噪强度
 * - `SET_BYPASS`：启用/停用 AI 降噪，保留原始音频透传
 *
 * 单独抽文件的目的是避免主线程和 worklet 字符串里出现“魔法字符串”。
 */
module.exports = {
  SET_SUPPRESSION_LEVEL : 'SET_SUPPRESSION_LEVEL',
  SET_BYPASS            : 'SET_BYPASS'
};
