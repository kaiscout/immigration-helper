import { packageCorpus } from "../server/uscis/package.mjs";

const result = packageCorpus();
console.log(
  `Packaged ${result.sourcePath} ` +
  `(${(result.sourceBytes / 1024 / 1024).toFixed(1)} MB) as ` +
  `${result.packagedPath} ` +
  `(${(result.packagedBytes / 1024 / 1024).toFixed(1)} MB).`
);
