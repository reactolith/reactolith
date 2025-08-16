import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';

// externalize react and its subpaths (jsx-runtime) + react-dom if you use it
const external = (id) => /^(react|react-dom)(\/|$)/.test(id);

export default [
    // JS bundles
    {
        input: 'src/index.ts',
        external,
        plugins: [
            peerDepsExternal(),
            resolve({ extensions: ['.mjs', '.js', '.ts', '.tsx'] }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                clean: true,
                tsconfigOverride: { compilerOptions: { declaration: false } }, // dts plugin handles .d.ts
            }),
        ],
        output: [
            { file: 'dist/index.mjs', format: 'esm', sourcemap: true },
            { file: 'dist/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
        ],
    },
    // Types
    {
        input: 'src/index.ts',
        plugins: [dts()],
        output: { file: 'dist/index.d.ts', format: 'es' },
    },
];
