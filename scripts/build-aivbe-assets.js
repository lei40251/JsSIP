const fs = require('fs');
const path = require('path');
const AssetManifest = require('../lib/AiVBE/AiVBEAssetManifest');

const sourceDir = path.resolve(__dirname, '../samples/mediapipeselfie-segmentation/dist/assets/selfie_segmentation');
const targetDir = path.resolve(__dirname, '../demo/base-js/virtual-background/mediapipe/vision');

const SOURCE_FILES = {
  runtimeScript      : 'selfie_segmentation.js',
  simdLoaderScript   : 'selfie_segmentation_solution_simd_wasm_bin.js',
  simdWasmBinary     : 'selfie_segmentation_solution_simd_wasm_bin.wasm',
  noSimdLoaderScript : 'selfie_segmentation_solution_wasm_bin.js',
  noSimdWasmBinary   : 'selfie_segmentation_solution_wasm_bin.wasm',
  graphBinary        : 'selfie_segmentation.binarypb',
  landscapeModel     : 'selfie_segmentation_landscape.tflite',
  portraitModel      : 'selfie_segmentation.tflite'
};

const TARGET_FILES = AssetManifest.FILES;

function ensureDir(dirPath)
{
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(fromName, toName)
{
  fs.copyFileSync(path.join(sourceDir, fromName), path.join(targetDir, toName));
}

function replaceAll(source, replacements)
{
  let output = source;

  replacements.forEach(([ from, to ]) =>
  {
    output = output.split(from).join(to);
  });

  return output;
}

function patchRuntimeScript()
{
  const sourcePath = path.join(sourceDir, SOURCE_FILES.runtimeScript);
  const targetPath = path.join(targetDir, TARGET_FILES.runtimeScript);
  const runtimeScript = fs.readFileSync(sourcePath, 'utf8');
  let patched = replaceAll(runtimeScript, [
    [ 'selfie_segmentation_solution_simd_wasm_bin.js', TARGET_FILES.simdLoaderScript ],
    [ 'selfie_segmentation_solution_wasm_bin.js', TARGET_FILES.noSimdLoaderScript ],
    [ 'selfie_segmentation_landscape.tflite', TARGET_FILES.landscapeModel ],
    [ 'selfie_segmentation.tflite', TARGET_FILES.portraitModel ],
    [ 'selfie_segmentation.binarypb', TARGET_FILES.graphBinary ],
    [ 'createMediapipeSolutionsWasm', AssetManifest.WASM_FACTORY_GLOBAL ],
    [ 'SelfieSegmentation', AssetManifest.RUNTIME_GLOBAL ]
  ]);

  // Keep external asset names obfuscated, but preserve the original internal
  // model override paths expected by the graph binary.
  patched = patched.replace(
    'e="third_party/mediapipe/modules/selfie_segmentation/"+h',
    'e="third_party/mediapipe/modules/selfie_segmentation/"+(1===c?"selfie_segmentation_landscape.tflite":"selfie_segmentation.tflite")'
  );

  fs.writeFileSync(targetPath, patched, 'utf8');
}

function patchWasmLoader(sourceName, targetName)
{
  const sourcePath = path.join(sourceDir, sourceName);
  const targetPath = path.join(targetDir, targetName);
  const loaderScript = fs.readFileSync(sourcePath, 'utf8');
  const patched = replaceAll(loaderScript, [
    [ 'createMediapipeSolutionsWasm', AssetManifest.WASM_FACTORY_GLOBAL ],
    [ 'selfie_segmentation_solution_simd_wasm_bin.wasm', TARGET_FILES.simdWasmBinary ],
    [ 'selfie_segmentation_solution_wasm_bin.wasm', TARGET_FILES.noSimdWasmBinary ]
  ]);

  fs.writeFileSync(targetPath, patched, 'utf8');
}

function main()
{
  ensureDir(targetDir);

  patchRuntimeScript();
  patchWasmLoader(SOURCE_FILES.simdLoaderScript, TARGET_FILES.simdLoaderScript);
  patchWasmLoader(SOURCE_FILES.noSimdLoaderScript, TARGET_FILES.noSimdLoaderScript);

  copyFile(SOURCE_FILES.simdWasmBinary, TARGET_FILES.simdWasmBinary);
  copyFile(SOURCE_FILES.noSimdWasmBinary, TARGET_FILES.noSimdWasmBinary);
  copyFile(SOURCE_FILES.graphBinary, TARGET_FILES.graphBinary);
  copyFile(SOURCE_FILES.landscapeModel, TARGET_FILES.landscapeModel);
  copyFile(SOURCE_FILES.portraitModel, TARGET_FILES.portraitModel);
}

main();
