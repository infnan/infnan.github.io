---
layout: post
title: Node.js输出原始Request内容
category: 记录
tags:
  - Web
---

有时候希望能直观地看到一个HTTP请求发送到服务器之后长什么样子，以便抓包和调试。平时可以预备一个现成的简单程序，以备不时之需。

<!-- more -->

## 直接模式

```js
const http = require('http')

http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  res.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\n`)
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    res.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\n`)
  }
  res.write('\n')
  req.on('data', (chunk) => {
    res.write(chunk)
  })
  req.on('end', () => {
    res.end()
  })
}).listen(8080)

console.log('Raw server is listening on port 8080...')
```

使用方法：保存为index.js，然后直接用Node.js启动即可。请求时，只要是http://IP:8080，可以发任意path和内容，浏览器会如实地把请求（和Header）内容给打印出来。

## TODO 代理模式

代理模式可以更加灵活，例如只拦截和展示特定请求，其余一律放行。

```js

```

使用方法：TODO
