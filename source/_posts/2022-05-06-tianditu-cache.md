---
layout: post
title: 使用nginx配置天地图缓存
category: 记录
tags:
- nginx
- 天地图
- 缓存
---
由于天地图有时访问速度缓慢，加上接口访问数量限制，可借助nginx对天地图进行缓存，提高访问速度。

<!-- more -->

# 配置文件内容

```conf
# ...

http {
    # ...

    resolver 114.114.114.114 ipv6=off;

    # 此处换成实际的缓存路径
    proxy_temp_path /var/cache/tianditu_temp;
    proxy_cache_path /var/cache/tianditu levels=1:2 keys_zone=cache_one:200m inactive=1d max_size=30g;

    upstream tianditu_server {
        server t0.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
        server t1.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
        server t2.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
        server t3.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
        server t4.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
        server t5.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
        server t6.tianditu.gov.cn:443 weight=1 max_fails=2 fail_timeout=30s;
    }

    server {
        # 此处需修改成实际端口
        listen 5000 default_server;
        server_name _;

        location / {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Headers X-Requested-With;
            add_header Access-Control-Allow-Methods GET,POST,OPTIONS;

            proxy_ssl_name t0.tianditu.gov.cn;
            proxy_ssl_server_name on;
            
            proxy_cache cache_one;
            proxy_cache_key $uri$is_args$args;
            
            proxy_pass https://tianditu_server;
            proxy_set_header Host t0.tianditu.gov.cn;
            proxy_set_header User-Agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36";
            proxy_ignore_headers Set-Cookie;
            proxy_ignore_headers Cache-Control;
            proxy_cache_valid 200 302 7d;
            
            expires 7d;
        
            add_header X-Proxy-Cache $upstream_cache_status;
        }
    }

    # ...
}
```

# 使用

将天地图域名换成服务器地址即可，例如将`https://t0.tianditu.gov.cn/img_w/wmts`替换成`http://172.16.0.100:5000/img_w/wmts`。
