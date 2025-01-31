import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { resolve } from "path";
import { readFileSync } from "fs";
import {
  ImportmapDeclaration,
  logInfo,
  logWarn,
  removeTrailingSlash,
} from "../utils";

/* eslint-disable no-console */

export interface DevelopArgs {
  port: number;
  host: string;
  backend: string;
  open: boolean;
  importmap: ImportmapDeclaration;
  spaPath: string;
  apiUrl: string;
  configUrls: Array<string>;
}

export function runDevelop(args: DevelopArgs) {
  const { backend, host, port, open, importmap, configUrls } = args;
  const apiUrl = removeTrailingSlash(args.apiUrl);
  const spaPath = removeTrailingSlash(args.spaPath);
  const app = express();
  const source = resolve(
    require.resolve("@openmrs/esm-app-shell/package.json"),
    "..",
    "lib"
  );
  const index = resolve(source, "index.html");
  const indexContent = readFileSync(index, "utf8")
    .replace(
      RegExp("<script>[\\s\\S]+</script>"),
      `
    <script>
        initializeSpa({
          apiUrl: ${JSON.stringify(apiUrl)},
          spaPath: ${JSON.stringify(spaPath)},
          env: "development",
          offline: true,
          configUrls: ${JSON.stringify(configUrls)},
        });
    </script>
  `
    )
    .replace(/href="\/openmrs\/spa/g, `href="${spaPath}`)
    .replace(/src="\/openmrs\/spa/g, `src="${spaPath}`);

  const pageUrl = `http://${host}:${port}${spaPath}/`;

  // Set up routes. Note that different middlewares have different rules
  // about route precedence.
  //
  // HPM/createProxyMiddleware always takes top precedence, so we must
  // explicitly exclude routes that we want to use other handlers for.
  //
  // express.static respects normal route declaration order.

  // Return our custom `index.html` for all requests beginning with spaPath
  // and not ending in `.js`, `.woff`, `.woff2`, `.json`, or any three-character
  // extension.
  const indexHtmlPathMatcher = new RegExp(
    `^${spaPath}/(?!.*\\.js$)(?!.*\\.woff2?$)(?!.*\\.json$)(?!.*\\....$).*$`
  );

  // Route for custom `importmap.json` goes above static assets
  app.get(`${spaPath}/importmap.json`, (_, res) => {
    if (importmap.type === "inline") {
      res.contentType("application/json").send(importmap.value);
    } else {
      res.redirect(importmap.value);
    }
  });

  // Route for custom `index.html` goes above static assets
  app.get(indexHtmlPathMatcher, (_, res) =>
    res.contentType("text/html").send(indexContent)
  );

  // Return static assets for any request for which we have one, except importmap.json and index.html
  app.use(spaPath, express.static(source, { index: false }));

  // Proxy requests beginning with `apiUrl` but which should not serve `index.html`.
  // This may include the JS bundles when using an import map that refers to
  // JS bundles located at the same domain as `apiUrl`.
  app.use(
    apiUrl,
    createProxyMiddleware(
      (path) => {
        return (
          new RegExp(`${apiUrl}/.*`).test(path) &&
          !indexHtmlPathMatcher.test(path)
        );
      },
      {
        target: backend,
        changeOrigin: true,
      }
    )
  );

  app.listen(port, host, () => {
    logInfo(`Listening at http://${host}:${port}`);
    logInfo(`SPA available at ${pageUrl}`);

    if (open) {
      const open = require("open");

      open(pageUrl, { wait: false }).catch(() => {
        logWarn(
          `Unable to open "${pageUrl}" in browser. If you are running in a headless environment, please do not use the --open flag.`
        );
      });
    }
  });

  return new Promise(() => {});
}
