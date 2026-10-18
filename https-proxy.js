// TLS front for the CreditNote app: terminates HTTPS and forwards to next start on localhost.
const https = require("https")
const http = require("http")
const fs = require("fs")
const path = require("path")

const TARGET_PORT = Number(process.env.APP_PORT || 3002)
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443)
const pfx = fs.readFileSync(path.join(__dirname, "certs", "creditnote.pfx"))
const passphrase = fs.readFileSync(path.join(__dirname, "certs", "pfx-pass.txt"), "utf8").trim()

https
  .createServer({ pfx, passphrase }, (req, res) => {
    const headers = { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": req.headers.host || "" }
    const up = http.request(
      { host: "127.0.0.1", port: TARGET_PORT, path: req.url, method: req.method, headers },
      (r) => {
        res.writeHead(r.statusCode, r.headers)
        r.pipe(res)
      },
    )
    up.on("error", () => {
      res.writeHead(502)
      res.end("CreditNote app unavailable")
    })
    req.pipe(up)
  })
  .listen(HTTPS_PORT, () => console.log(`HTTPS ${HTTPS_PORT} -> ${TARGET_PORT}`))
