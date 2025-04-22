/* eslint-disable strict */
'use strict';

const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const gulp = require('gulp');
const babel = require('gulp-babel');
// const uglify = require('gulp-uglify-es').default;
const rename = require('gulp-rename');
const header = require('gulp-header');
const expect = require('gulp-expect-file');
// const nodeunit = require('gulp-nodeunit-runner');
const eslint = require('gulp-eslint');
const plumber = require('gulp-plumber');
const log = require('fancy-log');
const colors = require('ansi-colors');
// const obfuscate = require('gulp-javascript-obfuscator');
const zip = require('gulp-zip');
const del = require('del');
const terser = require('gulp-terser');
const replace = require('gulp-replace');

const PKG = require('./package.json');
const today = new Date();

// gulp-header.
const BANNER = fs.readFileSync('banner.txt').toString();
const BANNER_OPTIONS = {
  pkg         : PKG,
  currentYear : today.getFullYear(),
  compileTime : `${today.getFullYear()}${today.getMonth()+1}${today.getDate()}${today.getHours()}${today.getMinutes()}`
};

const buildTime = getLocalTimestamp()*2;

// gulp-expect-file options.
const EXPECT_OPTIONS = {
  silent         : true,
  errorOnFailure : true,
  checkRealFile  : true
};

function logError(error)
{
  log(colors.red(String(error)));
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
  const src = [ 'gulpfile.js', '.eslintrc.js', 'lib/**/*.js', 'test/**/*.js' ];

  return gulp.src(src)
    .pipe(plumber())
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('babel', function()
{
  return gulp
    .src([ 'lib/**/*.js' ])
    .pipe(babel())
    .pipe(gulp.dest('lib-es5'));
});

// gulp.task('babel1', function()
// {
//   return gulp
//     .src([ `dist/${ PKG.title }.js` ])
//     .pipe(babel())
//     .pipe(gulp.dest('dist/b/'));
// });

gulp.task('browserify', function()
{
  return browserify(
    {
      entries      : 'lib-es5/JsSIP.js',
      extensions   : [ '.js' ],
      // Required for sourcemaps (must be false otherwise).
      debug        : false,
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
    .pipe(rename(`${PKG.title}.js`))
    .pipe(replace(/__VERSION__/g, `${PKG.version }.${buildTime}`))
    .pipe(replace(/__TITLE__/g, PKG.title))
    .pipe(header(BANNER, BANNER_OPTIONS))
    .pipe(gulp.dest('dist/'));
});

gulp.task('uglify', function()
{
  const src = `dist/${ PKG.title }.js`;

  return gulp.src(src)
    .pipe(expect(EXPECT_OPTIONS, src))
    // .pipe(obfuscate({ compact: true }))
    .pipe(terser({
      toplevel        : true, // 混淆顶级作用域
      module          : true, // 处理 ES 模块
      keep_classnames : false, // 混淆类名
      keep_fnames     : false, // 混淆函数名
      mangle          : {
        // 保留必要的名称
        reserved : [
          'CommonHeader',
          'FloorRequest',
          'FloorRelease',
          // 'FloorRequestStatusMsg',
          'FloorStatus',
          'Hello',
          'HelloAck',
          // 'FloorRequestStatusAck',
          // 'FloorStatusAck',
          'FloorQuery',
          'AttributeType',
          // 'FloorId',
          'FloorRequestId',
          'FloorRequestStatusAtr',
          // 'SupportedAttributes',
          // 'SupportedPrimitives',
          'FloorRequestInformation',
          // 'Primitive',
          // 'Complements',
          'RequestStatus'
        ]
      },
      compress : {
        // 增加压缩轮次
        passes      : 5,
        unsafe      : true,
        unsafe_math : true,
        reduce_vars : true,
        global_defs : {
          __DEBUG__ : false // 全局常量替换
        }
      },
      output : { // 添加这一段配置
        comments : false, // 禁用所有注释
        beautify : false, // 禁用美化格式
        preamble : 'var _0x1234=0;' // 添加混淆前缀
        // ascii_only : true // 防止 Unicode 转义
      }
    }))
    // .pipe(obfuscate({
    //   compact                  : true,
    //   // controlFlowFlattening          : true, // 控制流扁平化
    //   // controlFlowFlatteningThreshold : 0.01,
    //   // deadCodeInjection              : true, // 注入死代码
    //   // deadCodeInjectionThreshold     : 0.4,
    //   // debugProtection                : true, // 防调试
    //   // debugProtectionInterval        : 5000,
    //   // disableConsoleOutput           : true, // 禁用 console
    //   identifierNamesGenerator : 'hexadecimal', // 16进制变量名
    //   // log                            : false,
    //   numbersToExpressions     : true
    //   // renameGlobals            : false, // 保留全局变量
    //   // selfDefending            : true, // 自我保护
    //   // simplify                 : true,
    //   // splitStrings             : true,
    //   // splitStringsChunkLength        : 5,
    //   // stringArray              : true
    //   // stringArrayEncoding      : [ 'base64', 'rc4' ], // 字符串加密
    //   // stringArrayThreshold     : 0.15,
    //   // transformObjectKeys            : true
    //   // unicodeEscapeSequence          : false
    // }))
    .pipe(header(BANNER, BANNER_OPTIONS))
    .pipe(rename(`${PKG.title }.min.js`))
    .pipe(gulp.dest('dist/'));
});

gulp.task('test', function()
{
  const src = [
    'test/test-classes.js',
    'test/test-normalizeTarget.js',
    'test/test-parser.js',
    'test/test-properties.js',
    'test/test-UA-no-WebRTC.js',
    'test/test-digestAuthentication.js'
  ];

  return gulp.src(src)
    .pipe(expect(EXPECT_OPTIONS, src));
  // 不支持nodejs
  // .pipe(nodeunit({ reporter: 'default' }));
});

gulp.task('grammar', function(cb)
{
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
      let modified_grammar = grammar.replace(/throw new this\.SyntaxError\(([\s\S]*?)\);([\s\S]*?)}([\s\S]*?)return result;/, 'new this.SyntaxError($1);\n        return -1;$2}$3return data;');

      modified_grammar = modified_grammar.replace(/\s+$/mg, '');
      fs.writeFileSync('lib/Grammar.js', modified_grammar);
      log(`grammar: ${ colors.yellow('done')}`);
      cb();
    }
  );
});

// 打zip压缩包用
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
  del.sync('./dist/b', done());
});

gulp.task('dist-del', function(done)
{
  del.sync('./dist/', done());
});

gulp.task('devel', gulp.series('grammar'));

gulp.task('dist', gulp.series('lint', 'babel', 'test', 'browserify', 'uglify', 'tmp-del'));

gulp.task('zip', gulp.series('zip-del-zip', 'zip-demo', 'zip-dist', 'zip-changelog', 'zip-doc', 'zip-zip', 'zip-del'));

gulp.task('default', gulp.series('dist-del', 'dist'));
