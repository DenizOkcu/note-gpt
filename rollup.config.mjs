import browsersync from "rollup-plugin-browsersync";
import postcss from "rollup-plugin-postcss";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default [
  {
    input: "src/main.ts",
    output: {
      name: "Lib",
      file: "./main.js",
      format: "cjs",
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      typescript({
        compilerOptions: { lib: ["es5", "es6", "dom"], target: "es5" },
      }),
      postcss({
        extract: true,
        minimize: true,
      }),
      terser(),
      browsersync(),
    ],
  },
];
