// A pass-through HTTP proxy for performance diagnosis: the BFF talks to it instead of the
// isolated backend, and it records every backend call (start time, method, path, status,
// duration) as one JSON line. Test infrastructure only; the app is unchanged.
//   node e2e/support/timing-proxy.mjs <listenPort> <targetUrl> <logFile>
import { appendFileSync } from 'node:fs';
import http from 'node:http';

const [port, target, logFile] = process.argv.slice(2);
const upstream = new URL(target);

http
  .createServer((req, res) => {
    const started = Date.now();
    const t0 = performance.now();
    const forward = http.request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: upstream.host },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
        upstreamRes.on('end', () => {
          appendFileSync(
            logFile,
            `${JSON.stringify({
              start: started,
              method: req.method,
              path: req.url,
              status: upstreamRes.statusCode,
              ms: Math.round((performance.now() - t0) * 10) / 10,
            })}\n`,
          );
        });
      },
    );
    forward.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(forward);
  })
  .listen(Number(port), '127.0.0.1');
