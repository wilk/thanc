import nodeResolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'
import { minify } from 'uglify-es'

export default {
  input: 'index.js',
  output: {
    file: 'dist.js',
    format: 'cjs'
  },
  plugins: [
    babel({
      runtimeHelpers: true,
      exclude: 'node_modules/**'
    }),
    nodeResolve(),
    commonjs(),
    uglify({}, minify)
  ]
}