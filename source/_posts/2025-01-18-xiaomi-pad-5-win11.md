---
layout: post
title: 小米平板5刷Win11懒人版的一些记录
category: 记录
tags:
  - 小米平板5
  - 刷机
---

小米平板5是性价比最高的平板之一，因为可以刷Windows，而且在众多网友的努力下，不仅安装过程变得非常简单，而且兼容性也达到了不影响正常使用的水平。这里基于[Mindows工具箱V8](https://mindows.cn/)和Win11懒人版刷机包刷机，刷机过程中有一些注意事项，在此特别记录。

<!-- more -->

## 视频教程

详细操作过程可直接参照B站视频[耐刷王！小米平板5刷澎湃OS+Win11双系统保姆级指南](https://www.bilibili.com/video/BV1WqshejENP/)。本文对视频中的一些问题进行补充。

该视频中的附件可在[www.在下莫老师.com](https://www.xn--ghqy5t5uf651b82d.com/#/?id=ep194-%e8%80%90%e5%88%b7%e7%8e%8b%ef%bc%81%e5%b0%8f%e7%b1%b3%e5%b9%b3%e6%9d%bf5%e5%88%b7%e6%be%8e%e6%b9%83oswin11%e5%8f%8c%e7%b3%bb%e7%bb%9f%e4%bf%9d%e5%a7%86%e7%ba%a7%e6%8c%87%e5%8d%97)中找到。

## 前提准备

* 一台装Windows 64位系统的电脑
* 一根Type-C数据线
* 一个U盘，根据电脑情况可能需要转接线或转接头。如果你会adb命令与Windows远程操作，也可不用U盘。
* 小米平板5
    * 系统可以是MIUI或澎湃（HyperOS），但是如果想从MIUI升级为HyperOS，务必在开始刷机之前就完成升级，解锁BL（Bootloader）之后就很难升级了。

拿到平板之后，需要先绑定小米账号，开启查找设备，解锁BL（Bootloader）。第一次解锁不会成功，但是你必须要从头到尾操作完，再等待至少7天，然后才能继续解锁和刷机。

小米给HyperOS增加了更多限制，使得解锁更加困难，对于这类机器，可按[MlgmXyysd/Xiaomi-HyperOS-BootLoader-Bypass](https://github.com/MlgmXyysd/Xiaomi-HyperOS-BootLoader-Bypass/blob/master/docs/README-zh.md)的说明文档来操作解锁。

在开始解锁到最终完成刷机之前，平板里的应用和数据会被彻底清除至少两次，注意提前做好备份！

## 安装过程

### Mindows工具箱

[Mindows工具箱](https://mindows.cn/)网站为https://mindows.cn/，点击“脚本版V8”，需要下载两个文件：一个是“Mindows工具箱V8.7z”，另一个是“修复下载-2024.5.27-1.zip”。

先解压Mindows工具箱，然后解压“修复下载”，将修复下载里面的两个bat文件放到工具箱的bin文件夹中，覆盖原有文件。

注意文件路径不能有空格。

操作完成后，打开Mindows工具箱，点击“切换机型”，然后选择小米平板5。

### 懒人包

在选择Windows安装包时，可以选择很多懒人包。注意：

* LTSC版本不要给系统更新，否则会变成纯英文。
* 24H2版本系统可能有一些要命的问题。如果选择该版本，安装完成后务必仔细阅读系统里附带的说明。
* 如果选择低版本，安装完成后，要防止Windows更新给自动升级成高版本，否则平板会变砖。

### 手工下载资源包

虽然有“修复下载”，但是下载资源包仍然是失效的，需要进行手工处理。分别前往以下几个地址下载文件，并且按照路径改名（注意备份，以免被工具箱删除）：

* [syxz.lanzn.com/igOAI1jx3mpe](https://syxz.lanzn.com/igOAI1jx3mpe)：`工具箱\tmp\update\andres.7z.001`
* [syxz.lanzn.com/iyaW31jx44li](https://syxz.lanzn.com/iyaW31jx44li)：`工具箱\tmp\update\andres.7z.002`
* [syxz.lanzoue.com/iBITj1qzcfxi](https://syxz.lanzoue.com/iBITj1qzcfxi)：`工具箱\tmp\update\woares.7z.001`
* [syxz.lanzoue.com/ie7D81qzcl8j](https://syxz.lanzoue.com/ie7D81qzcl8j)：`工具箱\tmp\update\woares.7z.002`

然后修改bin\\toolbox.bat，屏蔽掉一些代码。具体方法是每一行的前面加入rem和一个空格，把相关代码都注释掉，防止错误地删除或下载文件。

* 1658～1665行：从`ECHO.准备下载...`到`(ECHO.无woa资源包. 跳过...)`
* 1773：`if exist res\%product%\and ...`
* 1774：`if exist tmp\update rd /s ...`
* 1776：`ECHO.下载安卓资源包... `
* 1785：`if exist res\%product%\woa ...`
* 1786：`if exist tmp\update rd /s ...`
* 1788：`ECHO.下载woa资源包...`

操作完成后，重新切换一遍机型，让工具箱把相关资源装上。

### 刷机

接下来的刷机脚本都是正确的，按屏幕提示操作即可。全部完成后，Windows系统就可以正常使用了。

切换安卓则需要进入Fastboot模式，按视频教程操作，或者使用工具箱的“刷入或临时启动安卓Boot”临时进入安卓。第一次进入安卓时，会出现小米官方Recovery，需要在界面上选择清除数据，然后重启，才能继续进入安卓系统。

## 刷完之后需要尽快做的事情

### 关掉Windows的睡眠

目前Windows还不支持睡眠，点睡眠会出现死机或白线烧屏的问题，因此要尽快把相关功能屏蔽掉，防止误操作：

1. 进入系统设置，在系统-电源和电池-屏幕、睡眠和休眠超时中，全部选择“从不”，防止系统自动进入休眠状态。
2. 在开始菜单直接输入“控制面板”，进入控制面板-硬件和声音-电源选项-选择电源按钮的功能，所有选项选择“不采取任何操作”，同时把页面下方的睡眠的对勾去掉。

### 防止屏幕闪瞎眼

在Windows里，屏幕亮度会随屏幕内容亮暗不同而发生变化，而且在小米平板上这个变化幅度更加明显。为了保护视力，建议将其关闭。

进入系统设置，在系统-屏幕中，点击“亮度”右面的三角，会出现“根据内容更改亮度”的设置，选择“关”即可关闭。

### 双系统切换

刷完之后需要两个img文件，用于双系统切换。

* 从Windows进安卓：需要按前文提到的视频教程操作（在操作刷机的那个电脑上操作），流程如下
    * 去指定网站找线刷包
    * 使用payload-dumper-go-boot从线刷包里提取boot.img
    * 进入安卓系统（可通过Mindows工具箱操作），用Magisk对boot.img进行处理
    * 把处理完成的img文件放到Windows系统的`C:\boot.img`中。
* 从安卓进Windows：
    * 安装Mindows助手app，启动一次
    * 刷机完成后，电脑的Mindows工具箱中会出现一个`懒人包UEFI-xxxx.img`文件，把它改名为`uefi.img`，放到安卓的`内部存储/Mindows工具箱/uefi.img`中。

视频中的部分链接已经失效，所以可以直接看附件里的地址：

* Mindows助手：[https://pan.quark.cn/s/86025e66ddf9](https://pan.quark.cn/s/86025e66ddf9)
* Magisk：[https://magiskcn.com/magisk-download](https://magiskcn.com/magisk-download)
* 小米官方固件：
    * MIUI：[https://roms.miuier.com/zh-cn/devices](https://roms.miuier.com/zh-cn/devices)
    * HyperOS：[https://hyperos.fans/zh/devices](https://hyperos.fans/zh/devices)
* payload-dumper-go-boot：[https://magiskcn.com/payload-dumper-go-boot](https://magiskcn.com/payload-dumper-go-boot)

## 其他学习资料

* [https://github.com/erdilS/Port-Windows-11-Xiaomi-Pad-5](https://github.com/erdilS/Port-Windows-11-Xiaomi-Pad-5)
