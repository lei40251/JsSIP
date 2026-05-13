/**
 * Mixer 模块入口
 *
 * 这是 MediaStreamMixer 的公共入口点。旧代码通过 require('./Mixer') 引用，
 * 实际实现已拆分到 mixer-core/MixerController.js。
 * 此文件保留为 barrel 文件，确保向后兼容。
 *
 * @module Mixer
 * @see module:mixer-core/MixerController
 */
module.exports = require('./mixer-core/MixerController');
