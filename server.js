// 本地开发用 API 服务，监听 3000 端口，供 Vite proxy 转发 /api 请求
const http = require('http')

const routes = {
  '/api/chat': require('./api/chat.js'),
  '/api/speech': require('./api/speech.js'),
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const handler = routes[req.url]
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: `No handler for ${req.url}` }))
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    if (body) {
      try { req.body = JSON.parse(body) } catch { req.body = {} }
    } else {
      req.body = {}
    }

    // 模拟 Vercel response 对象
    const mockRes = {
      _status: 200,
      _headers: {},
      status(code) { this._status = code; return this },
      setHeader(k, v) { this._headers[k] = v; return this },
      json(data) {
        res.writeHead(this._status, { 'Content-Type': 'application/json', ...this._headers })
        res.end(JSON.stringify(data))
      },
      end(data) {
        res.writeHead(this._status, this._headers)
        res.end(data)
      }
    }

    Promise.resolve(handler(req, mockRes)).catch(err => {
      console.error(err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    })
  })
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(`Local API server running at http://localhost:${PORT}`)
  console.log('Routes:', Object.keys(routes).join(', '))
})
