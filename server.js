const h=require('http'),f=require('fs'),p=require('path');
h.createServer((req,res)=>{
  let fp=p.join(__dirname,'index.html');
  f.readFile(fp,(e,d)=>{
    if(e){res.writeHead(404);res.end('Not found')}
    else{res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache,no-store,must-revalidate'});res.end(d)}
  })
}).listen(3000,()=>console.log('Kilton on http://localhost:3000'));
