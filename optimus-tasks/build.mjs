import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist",{recursive:true});
await copyFile("index.html","dist/index.html");
await build({entryPoints:["app.js"],outfile:"dist/app.js",bundle:true,minify:true,format:"esm",platform:"browser",target:"es2020",logLevel:"info"});
