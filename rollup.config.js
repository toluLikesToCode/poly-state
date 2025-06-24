import typescript from '@rollup/plugin-typescript'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import dts from 'rollup-plugin-dts'

const external = ['react', 'react/jsx-runtime']

export default [
  // Core bundle (vanilla TypeScript)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.build.json',
        exclude: ['src/react/**/*'],
        outputToFilesystem: true,
      }),
    ],
  },
  // React bundle
  {
    input: 'src/react.ts',
    output: [
      {
        file: 'dist/react.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/react.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.build.json',
        outputToFilesystem: true,
      }),
    ],
  },
  // Type definitions for core
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
  // Type definitions for React
  {
    input: 'src/react.ts',
    output: {
      file: 'dist/react.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
]
