import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input  : 'js/index.js',
  output : {
    file   : 'js/app.js',
    format : 'iife',
    name   : 'demo'
  },
  plugins : [
    resolve(),
    commonjs(),
    babel({ babelHelpers: 'bundled' })
  ]
};