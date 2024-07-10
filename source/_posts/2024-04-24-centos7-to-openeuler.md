---
layout: post
title: CentOS 7.x迁移至openEuler 22.03 SP3
category: 教程
tags:
 - CentOS
 - openEuler
 - 信创
---
CentOS 7即将停止支持，如果系统同时又有信创要求，可考虑升级为华为的openEuler系统。

因为官方升级工具有很多隐蔽的错误，而且不能平稳升级，所以本教程不使用官方的升级工具，而是直接使用命令升级。

<!-- more -->

从CentOS 7直接升级到最新版openEuler会出现兼容性问题，因此，为保证平稳升级，升级要分两步进行，第一步是将CentOS 7升级到较旧的openEuler 20.03，升级成功后，再将旧版的openEuler升级到最新版本。

## 升级流程

### 一、CentOS 7 升 openEuler 20.03

原始来源：[从Centos-7迁移到(华为欧拉系统)openEuler-20.03-LTS-SP3的教程](https://zhuanlan.zhihu.com/p/648470379)，有改动。

**生产环境先进行备份，如升级失败，或者中途意外中断，你很可能需要重装系统！**

检查本机是否安装了桌面环境，例如GNOME，如果有，需要先将其卸载。

检查本机是否能访问网络，如果没有网，需要先开策略联网：

```shell
ping repo.huaweicloud.com
```

**下面默认全程使用root账户操作。如不是root，可使用su或sudo su切换到root账号。**

直接粘贴以下命令。为保证每条命令都被执行，每次粘贴之后务必按一下回车：

```shell
yum install -y --nogpgcheck epel-release
yum update -y --nogpgcheck
yum install -y --nogpgcheck dnf
```

确认无误后reboot重启。

重启完成后，继续粘贴以下命令：

```shell
cp -r /etc/yum.repos.d/ /etc/yum.repos.d.bak/
dnf remove epel-release -y
rm -rf /etc/yum.repos.d/*

rpm -e --nodeps $(rpm -qa|grep centos-)
rpm -ivh --nodeps --force https://repo.openeuler.org/openEuler-20.03-LTS-SP3/OS/x86_64/Packages/openEuler-release-20.03LTS_SP3-52.oe1.x86_64.rpm
rpm -ivh --nodeps --force https://repo.openeuler.org/openEuler-20.03-LTS-SP3/OS/x86_64/Packages/openEuler-repos-1.0-3.1.oe1.x86_64.rpm
rpm -ivh --nodeps --force https://repo.openeuler.org/openEuler-20.03-LTS-SP3/OS/x86_64/Packages/openEuler-gpg-keys-1.0-3.1.oe1.x86_64.rpm
sed -i 's/repo.openeuler.org/repo.huaweicloud.com\/openeuler/g' /etc/yum.repos.d/openEuler.repo
sed -i 's/metalink=/#metalink=/g' /etc/yum.repos.d/openEuler.repo
dnf clean all
```

此处确认是否报错。

如无报错，粘贴以下命令：

```shell
mkdir /tmp/rpm
cd /tmp/rpm
dnf -y --releasever='20.03LTS_SP3' --allowerasing --setopt=deltarpm=false distro-sync --nogpgcheck --downloadonly --downloaddir=/tmp/rpm
```

执行完成后，确认是否报错。

如无报错，继续粘贴：

```shell
yum -y remove dnf
rm -rf /etc/yum
rpm -Uvh  --nodeps --force /tmp/rpm/*.rpm

dnf remove systemd-sysv -y
dnf group install "Minimal Install" -y
```

此时系统的内核已经变为最新版本，你需要根据服务器的实际情况来更新引导和GRUB启动菜单。我的服务器配置方式如下，仅供参考，请勿照搬：

```shell
export grubcfg=$(find /boot/ -name openEuler)
grub2-mkconfig -o $grubcfg/grub.cfg
```

执行完成后，确认是否报错。

如无报错，继续粘贴：

```shell
cd
curl -o libsystemd.pp https://plusnan.me/2024/04/24/centos7-to-openeuler/libsystemd.pp
setenforce 1
semodule -i libsystemd.pp
rm libsystemd.pp
dnf reinstall systemd systemd-libs systemd-udev systemd-help systemd-container -y
setenforce 0
```

如全部无报错，输入 reboot 重启服务器。

重启完成后，输入

```shell
uname -a
cat /etc/os-release
```

检查操作系统版本，如Linux内核变4.19，操作系统变openEuler，然后再检查各应用运行情况，如果没发现问题，说明CentOS 7已成功升级到openEuler 20.03。

### 二、openEuler 20.03 升 22.03 SP3

原始来源：[（华为欧拉系统)openEuler-20.03-LTS-SP3升级openEuler-22.03-LTS-SP3教程](https://zhuanlan.zhihu.com/p/648723829)，有改动。

#### 初始化

直接粘贴：

```shell
dnf -y update

# 刚升级过来，无需再备份了
# cp -r /etc/yum.repos.d/ /etc/yum.repos.d.bak
rm -rf /etc/yum.repos.d/*

rpm -Uvh --nodeps --force https://repo.openeuler.org/openEuler-22.03-LTS-SP3/OS/x86_64/Packages/openEuler-release-22.03LTS_SP3-56.oe2203sp3.x86_64.rpm
rpm -Uvh --nodeps --force https://repo.openeuler.org/openEuler-22.03-LTS-SP3/OS/x86_64/Packages/openEuler-repos-1.0-3.6.oe2203sp3.x86_64.rpm
rpm -Uvh --nodeps --force https://repo.openeuler.org/openEuler-22.03-LTS-SP3/OS/x86_64/Packages/openEuler-gpg-keys-1.0-3.6.oe2203sp3.x86_64.rpm
sed -i 's/repo.openeuler.org/repo.huaweicloud.com\/openeuler/g' /etc/yum.repos.d/openEuler.repo
sed -i 's/metalink=/#metalink=/g' /etc/yum.repos.d/openEuler.repo
dnf clean all
```

#### 软件包升级

接下来，从20.03升到22.03时，很可能会出现软件包冲突，此处需要手工解决冲突，然后再完成升级。

先输入：

```shell
dnf -y --releasever='22.03LTS_SP3' --allowerasing --setopt=deltarpm=false distro-sync --nogpgcheck
```

执行完成后，如果没有报错，可跳过本章节剩余步骤。如果系统报错，注意报错内容，例如：

```
file /usr/share/glib-2.0/schemas/org.ukui.power-manager.gschema.xml from install of ukui-power-manager-3.1.2-5.oe2203sp2.x86_64 conflicts with file from package ukui-power-manager-common-2.0.3-1.oe1.x86_64
```

整理一下`from package`后面的内容，如不是系统核心组件，可先将其卸载，例如：

```shell
rpm -e --nodeps nss-tools-3.90.0-2.el7_9.x86_64 nss-softokn-freebl-3.90.0-6.el7_9.x86_64 nss-sysinit-3.90.0-2.el7_9.x86_64
```

处理完成后，重新执行：

```shell
dnf -y --releasever='22.03LTS_SP3' --allowerasing --setopt=deltarpm=false distro-sync --nogpgcheck
```

如果还报`conflicts with file from package`的错，就继续按上面方式删除冲突的软件包。

在安装过程中，会出现ldconfig的报错，这个报错可以忽略，当安装完成后，该错误会自然消失。

#### 继续完成升级

粘贴以下命令：

```shell
rpm --rebuilddb
dnf group install "Minimal Install" -y
```

更新GRUB，此处需根据服务器实际情况执行：

```shell
export grubcfg=$(find /boot/ -name openEuler)
grub2-mkconfig -o $grubcfg/grub.cfg
```

可考虑卸载旧内核，例如：

```shell
dnf list installed | grep kernel
rpm -e --nodeps kernel-4.19.90-2401.1.0.0233.oe1

export grubcfg=$(find /boot/ -name openEuler)
grub2-mkconfig -o $grubcfg/grub.cfg
```

确认无报错后，reboot重启服务器，如服务器正常启动，各应用运行正常，表示升级成功。

## 其他事项

### 安装Docker

直接粘贴以下命令：

```shell
curl -o /etc/yum.repos.d/docker-ce.repo https://repo.huaweicloud.com/docker-ce/linux/centos/docker-ce.repo
sed -i 's/\$releasever/7/g' /etc/yum.repos.d/docker-ce.repo
sed -i 's/download.docker.com/repo.huaweicloud.com\/docker-ce/' /etc/yum.repos.d/docker-ce.repo

dnf install -y docker-ce docker-ce-cli containerd.io

systemctl enable docker
systemctl start docker
```

### 升级SSH（勤奋版）

以下内容来自[编译国产openEuler 22.03 LTS系统OpenSSH 9.4的rpm安装包](https://blog.csdn.net/forestqq/article/details/132733136)，有改动。

找一台能够编译的服务器，在此系统上构建rpm包：

```shell
dnf install -y rpm-build zlib-devel openssl-devel gcc perl-devel pam-devel

cd
mkdir -p rpmbuild/{SOURCES,SPECS}
cd rpmbuild/SOURCES/
curl -o openssh-9.4p1.tar.gz -k https://ftp.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-9.4p1.tar.gz
curl -o x11-ssh-askpass-1.2.4.1.tar.gz -k https://src.fedoraproject.org/repo/pkgs/openssh/x11-ssh-askpass-1.2.4.1.tar.gz/8f2e41f3f7eaa8543a2440454637f3c3/x11-ssh-askpass-1.2.4.1.tar.gz
curl -o openssl-1.1.1v.tar.gz -k https://www.openssl.org/source/openssl-1.1.1v.tar.gz
```

创建`~/rpmbuild/SOURCES/sshd.pam.oe2203`，内容[从这里下载](sshd.pam.oe2203)。

创建`~/rpmbuild/SPECS/openssh.spec`，内容[从这里下载](openssh.spec)。

操作完成后，开始构建安装包：

```shell
cd ~/rpmbuild/SPECS/
rpmbuild -bb openssh.spec
```

构建完成后进行升级：

```shell
cd ~/rpmbuild/RPMS/x86_64
rpm -iUv *
```

因为OpenSSH 9.*加密算法只支持256位以上，因此原来的配置文件不能直接用了，先替换配置文件，再重启服务：

```shell
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
/bin/cp /etc/ssh/sshd_config.rpmnew /etc/ssh/sshd_config

# 根据实际情况修改配置
vim /etc/ssh/sshd_config

systemctl restart sshd

# 检查升级情况
ssh -V
sshd -V
```

构建完成后，可将`~/rpmbuild/RPMS/x86_64`中的安装包拷出来，直接给其他服务器使用，不用再重新构建了。

### 升级SSH（懒人版）

如果你是openEuler 22.03，x86_84架构，比较懒：

**警告：以下命令仅供参考，后果自负**

```shell
mkdir ~/openssh-9.4
cd openssh-9.4
curl -o openssh-9.4p1-oe2203.x86_64.rpm https://plusnan.me/2024/04/24/centos7-to-openeuler/openssh-9.4p1-oe2203.x86_64.rpm
curl -o openssh-clients-9.4p1-oe2203.x86_64.rpm https://plusnan.me/2024/04/24/centos7-to-openeuler/openssh-clients-9.4p1-oe2203.x86_64.rpm
curl -o openssh-debuginfo-9.4p1-oe2203.x86_64.rpm https://plusnan.me/2024/04/24/centos7-to-openeuler/openssh-debuginfo-9.4p1-oe2203.x86_64.rpm
curl -o openssh-debugsource-9.4p1-oe2203.x86_64.rpm https://plusnan.me/2024/04/24/centos7-to-openeuler/openssh-debugsource-9.4p1-oe2203.x86_64.rpm
curl -o openssh-server-9.4p1-oe2203.x86_64.rpm https://plusnan.me/2024/04/24/centos7-to-openeuler/openssh-server-9.4p1-oe2203.x86_64.rpm

rpm -iUv *

mv /etc/sysconfig/sshd.rpmsave /etc/sysconfig/sshd
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
/bin/cp -f /etc/ssh/sshd_config.rpmnew /etc/ssh/sshd_config

systemctl restart sshd
systemctl status sshd
```

### 不满足信创要求

领导说openEuler不在信创目录？没看到“华为”两个字吗，敢说华为不信创，你这领导是不想干了吗？

## 参考资料

* [从Centos-7迁移到(华为欧拉系统)openEuler-20.03-LTS-SP3的教程](https://zhuanlan.zhihu.com/p/648470379)
* [（华为欧拉系统)openEuler-20.03-LTS-SP3升级openEuler-22.03-LTS-SP3教程](https://zhuanlan.zhihu.com/p/648723829)
* [编译国产openEuler 22.03 LTS系统OpenSSH 9.4的rpm安装包](https://blog.csdn.net/forestqq/article/details/132733136)
