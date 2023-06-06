---
layout: post
title: 用Docker快速为办公室搭建VPN
category: 教程
tags:
- VPN
- 远程办公
---
由于武汉肺炎疫情原因，随时可能会封城，导致无法前往办公室办公。如果公司没有提供VPN，为了在居家办公时能有一个连接办公室资源的方法，可以考虑自己搭一个简易的VPN。

<!-- more -->

# 搭建VPN

## 服务器准备

准备一个服务器，能够访问公司办公室各资源，而且能连接互联网。配置好之后，安装Docker，并开放服务器443端口。

## 安装容器和VPN配置

前往[https://github.com/wppurking/ocserv-docker](https://github.com/wppurking/ocserv-docker)，将内容全部下载。也可以直接输入命令：

```bash
git clone https://github.com/wppurking/ocserv-docker.git
```

进入`ocserv-docker/ocserv`目录，清空`ocpasswd`文件内容，删除默认账号。

再修改`ocserv.conf`，在结尾增加：

```
route = 192.168.0.0/255.255.255.0

custom-header = "X-CSTP-Client-Bypass-Protocol: true"
```

route后面的IP需要根据实际情况配置。例如公司内网采用192.168网段，那么就是`192.168.0.0/255.255.255.0`。如果不确定，也可以不增加route这行配置，这样连上VPN后所有流量都会通过VPN访问。

## 启动VPN

下载完成后，进入该目录并启动容器：

```bash
cd ocserv-docker
docker run -d --privileged --restart unless-stopped --name ocserv-docker -v ~/ocserv-docker/ocserv:/etc/ocserv -p 443:443/tcp wppurking/ocserv

# 查看日志，检查是否正常运行
docker logs ocserv-docker
```

## 分配账号密码

```bash
docker exec -it ocserv-docker ocpasswd 用户名
```

输入两遍密码，修改立即生效，无需重启VPN服务器。

# 公网映射

VPN搭好之后，需要将该VPN的端口映射到公网上面。如果公司有公网IP，而且能够进行配置，可找相应部门把端口配置好。如果没有相应资源，可参考[内网穿透教程](/2018/07/14/tunnel/)进行配置。

# VPN客户端

[下载Cisco AnyConnect客户端](https://www.cisco.com/c/en/us/support/security/anyconnect-secure-mobility-client-v4-x/model.html#~tab-downloads)，下载完成后进行安装。

第一次启动时，需要进入设置页面，将“Block connections to untrusted servers”前面的勾取消。

输入VPN公网映射之后的地址和端口，点击Connect即可连接。启动后会出现安全提示，点击“Connect Anyway”连接，然后输入账号密码即可连接VPN。

# 扩展思考：能不能用来翻墙？

当然可以，在国外服务器上用相同方式部署一套VPN软件即可，但是由于Cisco AnyConnect的流量特征太明显，所以建议用其他更可靠的方式翻墙。
