const RUNTIME_GLOBAL = 'CRTCAiVBERuntime';
const WASM_FACTORY_GLOBAL = 'createCRTCAiVBEWasm';

const FILES = {
  runtimeScript      : 'aivb.js',
  simdLoaderScript   : 'aivb_simd.js',
  simdWasmBinary     : 'aivb_simd.wasm',
  noSimdLoaderScript : 'aivb_nosimd.js',
  noSimdWasmBinary   : 'aivb_nosimd.wasm',
  graphBinary        : 'aivb_graph.binarypb',
  landscapeModel     : 'aivb_landscape.tflite',
  portraitModel      : 'aivb_portrait.tflite'
};

module.exports = {
  RUNTIME_GLOBAL,
  WASM_FACTORY_GLOBAL,
  FILES
};
