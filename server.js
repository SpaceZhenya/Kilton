const h=require('http'),f=require('fs'),p=require('path'),urlMod=require('url');
h.createServer(async (req,res)=>{
  // CORS proxy for Kilton browser downloads
  if (req.url.startsWith('/proxy?url=')) {
    const target = decodeURIComponent(req.url.slice(11))
    try {
      const proxyRes = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const ct = proxyRes.headers.get('content-type') || 'application/octet-stream'
      const cd = proxyRes.headers.get('content-disposition') || ''
      const blob = await proxyRes.arrayBuffer()
      res.writeHead(proxyRes.status, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': ct,
        'Content-Disposition': cd,
        'Content-Length': String(blob.byteLength)
      })
      res.end(Buffer.from(blob))
    } catch(e) {
      res.writeHead(502)
      res.end('Proxy error: ' + e.message)
    }
    return
  }
  // Serve index.html
  let fp = p.join(__dirname, 'index.html')
  f.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end('Not found') }
    else { res.writeHead(200, {'Content-Type':'text/html','Cache-Control':'no-cache,no-store,must-revalidate'}); res.end(d) }
  })
}).listen(3000, () => console.log('Kilton on http://localhost:3000'))
