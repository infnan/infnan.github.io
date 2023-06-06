---
layout: post
title: CentOS 7安全等保整改记录
category: 教程
tags:
- CentOS
- 安全
- 等保
---
为满足等保测评要求，对CentOS 7服务器进行了统一整改，整改命令记录如下。

<!-- more -->

# 升级SSH

网上教程太多了，此处不再提供。

如果从7.x旧版升级到8.x或9.x，需要注意几个问题：

1. 禁用SELinux：

```bash
setenforce 0
sed -i 's/=enforcing/=disabled/' /etc/selinux/config
```

2. 删除旧的key：

```bash
rm -f /etc/ssh/ssh*key
```

3. 允许root登录：

```bash
echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
```

# 升级curl（需要网络）

```bash
rpm -Uvh http://www.city-fan.org/ftp/contrib/yum-repo/city-fan.org-release-3-4.rhel7.noarch.rpm
sed -i 's/enabled=0/enabled=1/g' /etc/yum.repos.d/city-fan.org.repo
sed -i 's/gpgcheck=1/gpgcheck=0/g' /etc/yum.repos.d/city-fan.org.repo
yum update -y --nogpgcheck curl
```

# 系统配置

```bash
# shell不记录历史命令
sed -i 's/HISTSIZE=1000/HISTSIZE=0/g' /etc/profile

# shell自动超时
echo 'export TMOUT=600' >> /etc/profile

# 密码复杂度规则、账号锁定规则
sed -i 's/authtok_type=/authtok_type= minlen=12 lcredit=-1 ucredit=-1 dcr+++edit=-1 ocredit=-1 enforce_for_root/' /etc/pam.d/system-auth
sed -i 's/99999/120/g' /etc/login.defs
echo 'auth required pam_tally.so onerr=fail no_magic_root' >> /etc/pam.d/system-auth
echo 'account required pam_tally.so deny=5 unlock_time=300 root_unlock_time=300 no_magic_root even_deny_root_account per_user reset' >> /etc/pam.d/system-auth

# SSH加密算法
echo 'KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521' >> /etc/ssh/sshd_config
systemctl restart sshd
```
