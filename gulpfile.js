/* eslint-disable strict */
'use strict';
/* eslint-enable strict */

const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const gulp = require('gulp');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify-es').default;
const rename = require('gulp-rename');
const header = require('gulp-header');
const expect = require('gulp-expect-file');
// const nodeunit = require('gulp-nodeunit-runner');
const eslint = require('gulp-eslint');
const plumber = require('gulp-plumber');
const log = require('fancy-log');
const colors = require('ansi-colors');
const obfuscate = require('gulp-javascript-obfuscator');
const zip = require('gulp-zip');
const del = require('del');

const PKG = require('./package.json');
const today = new Date();

// gulp-header.
const BANNER = fs.readFileSync('banner.txt').toString();
const BANNER_OPTIONS = {
  pkg         : PKG,
  currentYear : today.getFullYear(),
  compileTime : `${today.getFullYear()}${today.getMonth()+1}${today.getDate()}${today.getHours()}${today.getMinutes()}`
};

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
    .pipe(header(BANNER, BANNER_OPTIONS))
    .pipe(gulp.dest('dist/'));
});

gulp.task('uglify', function()
{
  const src = `dist/${ PKG.title }.js`;

  return gulp.src(src)
    .pipe(expect(EXPECT_OPTIONS, src))
    .pipe(obfuscate({ compact: true }))
    .pipe(uglify())
    .pipe(header(BANNER, BANNER_OPTIONS))
    .pipe(rename(`${PKG.title }.min.js`))
    .pipe(gulp.dest('dist/'));
});

gulp.task('test', function()
{
  // var src = 'test/*.js';
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
gulp.task('zip-demo', function()
{
  return gulp
    .src('demo/**')
    .pipe(gulp.dest('zip/demo/'));
});

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
    .pipe(zip(`CRTC_SDK_Web_Release_${ PKG.version }.zip`))
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

gulp.task('zip', gulp.series('zip-del-zip', 'zip-demo', 'zip-dist', 'zip-changelog', 'zip-doc', 'zip-zip', 'zip-del'));

gulp.task('devel', gulp.series('grammar'));

gulp.task('dist', gulp.series('lint', 'babel', 'test', 'browserify', 'uglify'));

gulp.task('default', gulp.series('dist'));
