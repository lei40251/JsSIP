/* eslint-disable strict */
'use strict';

const fs = require('fs');
const path = require('path');
const Transform = require('stream').Transform;
const exec = require('child_process').exec;
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const vinylSourcemap = require('vinyl-sourcemap');
const gulp = require('gulp');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const header = require('gulp-header');
const expect = require('gulp-expect-file');
const eslint = require('gulp-eslint');
const plumber = require('gulp-plumber');
const log = require('fancy-log');
const colors = require('ansi-colors');
const zip = require('gulp-zip');
const del = require('del');
const terser = require('gulp-terser');
const replace = require('gulp-replace');

const PKG = require('./package.json');
const today = new Date();

// 构建产物头部 banner。
// 这里保留原始 banner 文件，并在构建时注入版本和编译时间。
const BANNER = fs.readFileSync('banner.txt').toString();
const BANNER_OPTIONS = {
  pkg         : PKG,
  currentYear : today.getFullYear(),
  compileTime : `${today.getFullYear()}${today.getMonth()+1}${today.getDate()}${today.getHours()}${today.getMinutes()}`
};

// BFCP 相关名称在协议处理、外部调试和兼容场景里相对敏感，
// 这里显式保留，避免压缩后名称变化带来额外风险。
const TERSER_RESERVED = [
  'CommonHeader',
  'FloorRequest',
  'FloorRelease',
  'FloorStatus',
  'Hello',
  'HelloAck',
  'FloorQuery',
  'AttributeType',
  'FloorRequestId',
  'FloorRequestStatusAtr',
  'FloorRequestInformation',
  'RequestStatus'
];

// 定向属性混淆白名单。
// 这里只混淆 MediaStreamComposer / AiNS / 输出流链路里确定偏内部实现的属性，
// 不对全量 `_xxx` 属性做混淆，避免把 UA / RTCSession / SIP 内部字段也一起打坏。
// 如果后续某个测试或业务依赖这些属性名，需要从这里移除对应项。
const TERSER_MEDIA_PROPERTY_MANGLE_REGEX = /^__(?:aiVirtualBackgroundState|workerTest)$|^_(?:activeCaptureSinkVideo|audioBuses|audioComposer|canvas|capturedStream|capturedStreams|capturedVideoTrack|closeTransferFrames|compressorNode|config|context2d|contextWebGL2|continuousWriteFailures|createFrame|createWatermarkFrame|ctx2d|drawVideosToCanvas|filter|gco|generator|generatorTrack|gl|handleWorkerMessage|insertableActive|insertableEnabledByConfig|insertableSupport|lastTimestampUs|latestPendingFrame|manualCaptureFrameControl|maxContinuousWriteFailures|mixedStream|outputContext|outputStreamManager|pendingWrite|renderInWorker|sourceAiVBManager|sources|src|videoStream|worker|workerReady|writer)$/;

// 压缩配置说明：
// 1. 目标不是重型 obfuscator，而是在体积和可维护性之间做平衡。
// 2. `module: true` / `toplevel: true` 用于更激进地压缩顶级作用域。
// 3. `mangle.properties` 只对上面的定向属性生效，避免全局属性混淆风险过高。
// 4. `keep_quoted: true` 表示凡是以字符串字面量访问的属性名不参与属性混淆，
//    这样可以降低动态访问场景被打坏的概率。
// 5. `unsafe*` / `hoist_props` / `reduce_funcs` 会提高压缩率，但也意味着更依赖测试兜底。
// 6. `preamble` 是用户要求保留的前缀，不要移除。
const TERSER_OPTIONS = {
  toplevel        : true,
  module          : true,
  keep_classnames : false,
  keep_fnames     : false,
  mangle          : {
    eval       : true,
    properties : {
      regex       : TERSER_MEDIA_PROPERTY_MANGLE_REGEX,
      keep_quoted : true
    },
    reserved : TERSER_RESERVED
  },
  compress : {
    // `passes` 不继续无限加大，5 基本已经接近收益和构建时间的平衡点。
    passes        : 5,
    unsafe        : true,
    unsafe_math   : true,
    pure_getters  : 'strict',
    hoist_props   : true,
    reduce_vars   : true,
    reduce_funcs  : true,
    side_effects  : true,
    keep_fargs    : false,
    drop_debugger : true,
    global_defs   : {
      __DEBUG__ : false
    }
  },
  output : {
    comments   : false,
    beautify   : false,
    semicolons : false,
    // 该前缀是当前产物兼容用户既有策略的一部分，需要保留。
    preamble   : 'var _0x1234=0;'
  }
};

// 构建时间参与版本号替换，历史逻辑是把本地时间戳乘 2。
// 这里保留现状，避免影响现有版本串依赖。
const buildTime = getLocalTimestamp()*2;

// 文件存在性校验统一配置。
const EXPECT_OPTIONS = {
  silent         : true,
  errorOnFailure : true,
  checkRealFile  : true
};

function logError(error)
{
  log(colors.red(String(error)));
}

// 将 browserify 输出中的 inline sourcemap 解析到 `file.sourceMap`，
// 后续再交给 gulp.dest(..., { sourcemaps: '.' }) 写成外部 .map 文件。
function loadInlineSourceMap()
{
  return new Transform({
    objectMode : true,
    transform(file, enc, callback)
    {
      vinylSourcemap.add(file, callback);
    }
  });
}

function getLocalTimestamp()
{
  const d = new Date();

  return d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') + // 月份从0开始需+1
    d.getDate().toString()
      .padStart(2, '0') +
    d.getHours().toString()
      .padStart(2, '0') +
    d.getMinutes().toString()
      .padStart(2, '0');
}

// 1. 复制文件
function copyFiles()
{
  return gulp.src('demo/**')
    .pipe(gulp.dest('zip/demo/'));
}

// 2. 重命名备份文件
function renameConfig()
{
  return gulp.src('zip/demo/config.js.sample')
    .pipe(rename('config.js'))
    .pipe(gulp.dest('zip/demo/'));
}

// 3. 删除旧备份文件
function deleteBackup()
{
  return del('zip/demo/config.js.sample');
}

gulp.task('lint', function()
{
  // 先跑 lint，尽早暴露语法和风格问题，避免进入后续耗时流程。
  const src = [ 'gulpfile.js', '.eslintrc.js', 'lib/**/*.js', 'test/**/*.js' ];

  return gulp.src(src)
    .pipe(plumber())
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('babel', function()
{
  // 先把 lib 编译到临时目录，再基于 lib-es5 做 browserify。
  // 这样不污染源码目录，也方便最终统一清理。
  return gulp
    .src([ 'lib/**/*.js' ])
    .pipe(babel())
    .pipe(gulp.dest('lib-es5'));
});

gulp.task('browserify', function()
{
  // `standalone` 让 dist 产物既可直接挂到 window，也能兼容模块系统引用。
  // `debug: true` 让 browserify 先输出 inline sourcemap，后面会转成外部 .map 文件。
  return browserify(
    {
      entries      : 'lib-es5/JsSIP.js',
      extensions   : [ '.js' ],
      // browserify sourcemap 的起点；不要改回 false，否则后续无法串联 map。
      debug        : true,
      // Required for watchify (not used here).
      cache        : null,
      // Required for watchify (not used here).
      packageCache : null,
      // Required to be true only for watchify (not used here).
      fullPaths    : false,
      standalone   : PKG.title
    })
    .bundle()
    .on('error', logError)
    .pipe(source(`${PKG.title}.js`))
    .pipe(buffer())
    .pipe(loadInlineSourceMap())
    .pipe(rename(`${PKG.title}.js`))
    // 将源码中的占位符替换为实际构建信息。
    .pipe(replace(/__VERSION__/g, `${PKG.version }.${buildTime}`))
    .pipe(replace(/__TITLE__/g, PKG.title))
    .pipe(header(BANNER, BANNER_OPTIONS))
    // 输出 dist/CRTC.js，并将 sourcemap 写到 dist/maps/CRTC.js.map。
    .pipe(gulp.dest('dist/', { sourcemaps: './maps' }));
});

gulp.task('uglify', function()
{
  const src = `dist/${ PKG.title }.js`;

  return gulp.src(src, { sourcemaps: true })
    .pipe(expect(EXPECT_OPTIONS, src))
    // 这里不用重型 obfuscator，只走 terser。
    // 原因是 obfuscator 对体积、构建速度和兼容性冲击都更大。
    .pipe(terser(TERSER_OPTIONS))
    // banner 在压缩产物里同样保留。
    .pipe(header(BANNER, BANNER_OPTIONS))
    .pipe(rename(`${PKG.title }.min.js`))
    // 基于上一阶段加载进来的 sourcemap 继续生成 dist/maps/CRTC.min.js.map。
    .pipe(gulp.dest('dist/', { sourcemaps: './maps' }));
});

gulp.task('test-files', function()
{
  // 先确认测试文件都在，避免后续 require 时报出不直观的问题。
  const src = [
    'test/test-classes.js',
    'test/test-normalizeTarget.js',
    'test/test-parser.js',
    'test/test-properties.js',
    'test/test-UA-no-WebRTC.js',
    'test/test-digestAuthentication.js',
    'test/test-ai-virtual-background.js',
    'test/test-media-stream-composer.js',
    'test/test-rtcsession-media-stream-composer.js',
    'test/test-bfcp.js'
  ];

  return gulp.src(src)
    .pipe(expect(EXPECT_OPTIONS, src));
});

gulp.task('media-stream-composer-test', function(done)
{
  // 这组测试单独串起来，方便只验证媒体合成相关能力。
  require('./test/test-ai-virtual-background').run()
    .then(function()
    {
      return require('./test/test-media-stream-composer').run();
    })
    .then(function()
    {
      return require('./test/test-rtcsession-media-stream-composer').run();
    })
    .then(function()
    {
      done();
    })
    .catch(done);
});

gulp.task('mixer-test', gulp.series('media-stream-composer-test'));

gulp.task('bfcp-test', function(done)
{
  require('./test/test-bfcp').run()
    .then(function()
    {
      done();
    })
    .catch(done);
});

gulp.task('sdk-test', function(done)
{
  // SDK 通用能力测试与媒体合成测试分开跑，便于快速定位问题范围。
  const runner = require('./test/include/runner');

  require('./test/include/common');

  runner.run('SDK Classes', require('./test/test-classes'))
    .then(function()
    {
      return runner.run('SDK Parser', require('./test/test-parser'));
    })
    .then(function()
    {
      return runner.run('SDK normalizeTarget', require('./test/test-normalizeTarget'));
    })
    .then(function()
    {
      return runner.run('SDK Properties', require('./test/test-properties'));
    })
    .then(function()
    {
      return runner.run('SDK Digest Auth', require('./test/test-digestAuthentication'));
    })
    .then(function()
    {
      done();
    })
    .catch(done);
});

gulp.task('test', gulp.series('test-files', 'sdk-test', 'media-stream-composer-test', 'bfcp-test'));

gulp.task('grammar', function(cb)
{
  // `grammar` 会重新生成 lib/Grammar.js，并在生成后做一次定制补丁。
  // 这是有副作用的任务，只在明确需要时执行。
  const local_pegjs = path.resolve('./node_modules/.bin/pegjs');
  const Grammar_pegjs = path.resolve('lib/Grammar.pegjs');
  const Grammar_js = path.resolve('lib/Grammar.js');

  log('grammar: compiling Grammar.pegjs into Grammar.js...');

  exec(`${local_pegjs } ${ Grammar_pegjs } ${ Grammar_js}`,
    function(error, stdout, stderr)
    {
      if (error)
      {
        cb(new Error(stderr));
      }
      log(`grammar: ${ colors.yellow('done')}`);

      // Modify the generated Grammar.js file with custom changes.
      log('grammar: applying custom changes to Grammar.js...');

      const grammar = fs.readFileSync('lib/Grammar.js').toString();
      // 历史兼容补丁：调整 pegjs 生成代码的错误返回逻辑。
      let modified_grammar = grammar.replace(/throw new this\.SyntaxError\(([\s\S]*?)\);([\s\S]*?)}([\s\S]*?)return result;/, 'new this.SyntaxError($1);\n        return -1;$2}$3return data;');

      // 清理行尾空白，避免生成文件里出现无意义差异。
      modified_grammar = modified_grammar.replace(/\s+$/mg, '');
      fs.writeFileSync('lib/Grammar.js', modified_grammar);
      log(`grammar: ${ colors.yellow('done')}`);
      cb();
    }
  );
});

// 以下 zip 相关任务用于生成交付包，不参与普通 dist 构建。
gulp.task('zip-demo', gulp.series(
  copyFiles,
  renameConfig,
  deleteBackup // 新增删除步骤
));

gulp.task('zip-dist', function()
{
  return gulp
    .src('dist/*.min.js')
    .pipe(gulp.dest('zip/dist/'));
});

gulp.task('zip-changelog', function()
{
  return gulp
    .src('CHANGELOG.md')
    .pipe(gulp.dest('zip/'));
});

gulp.task('zip-doc', function()
{
  return gulp
    .src('doc/*.pdf')
    .pipe(gulp.dest('zip/doc/'));
});

gulp.task('zip-zip', function()
{
  return gulp
    .src('zip/**')
    .pipe(zip(`CRTC_SDK_Web_Release_${ PKG.version }.${today.getFullYear()}${today.getMonth()+1}${today.getDate()}${today.getHours()}.zip`))
    .pipe(gulp.dest('./SDK_zip/'));
});

gulp.task('zip-del-zip', function(done)
{
  del.sync('./SDK_zip/**', done());
});

gulp.task('zip-del', function(done)
{
  del.sync('./zip', done());
});

gulp.task('tmp-del', function(done)
{
  // 清理 browserify/构建过程中的临时目录。
  del.sync('./dist/b', done());
});

gulp.task('lib-es5-del', function(done)
{
  // 清理 babel 中间产物，避免仓库里长期残留编译目录。
  del.sync('./lib-es5/', done());
});

gulp.task('dist-del', function(done)
{
  // Windows 下 dist 目录偶发会被占用。
  // 这里对 EPERM / EBUSY 做软处理，避免一次占用直接让默认构建失败。
  try
  {
    del.sync('./dist/');
  }
  catch (error)
  {
    const code = error && error.code;

    if (code === 'EPERM' || code === 'EBUSY')
    {
      log(colors.yellow(`dist-del skipped: ${error.message || String(error)}`));
      done();

      return;
    }

    done(error);

    return;
  }

  done();
});

gulp.task('devel', gulp.series('grammar'));

// 标准构建链路：
// lint -> babel -> test -> browserify -> terser -> 清理临时目录
gulp.task('dist', gulp.series('lint', 'babel', 'test', 'browserify', 'uglify', 'tmp-del', 'lib-es5-del'));

gulp.task('zip', gulp.series('zip-del-zip', 'zip-demo', 'zip-dist', 'zip-changelog', 'zip-doc', 'zip-zip', 'zip-del'));

// 默认先清 dist，再执行标准构建。
gulp.task('default', gulp.series('dist-del', 'dist'));
