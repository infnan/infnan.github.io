---
layout: post
title: 在2018版MacBook Pro手工安装Windows 10，以及分区扩容
category: 教程
tags: 
- Mac
- Boot Camp
---
几个月前在苹果商店购买了新版的MacBook Pro，为了玩个游戏（例如GTA5），准备安装Windows系统，然而发现通过系统的Boot Camp（启动转换助理）进行安装根本无法成功。经过一番折腾，得出一个结论：只能手工制作安装盘，以手工方式安装Windows 10。
<!-- more -->

# 坑的要点

* 用Boot Camp创建启动盘时会提示“‘启动转换’安装失败”、“拷贝Windows安装文件时出错”、“‘启动转换助理’正在移除其创建的分区，请稍候”，因为Windows 10安装盘通常大于4GB，FAT32格式分区装不下，所以失败。
* 即使找到了小于4GB的安装盘，也不要继续用Boot Camp来进行安装。虽然重启之后能进入到Windows安装程序中，也能正常地下一步下一步，但是只要到再努力一小下就会成功的时刻，安装程序就会蹦出“Windows无法更新计算机的启动配置，安装无法继续”，然后系统开始自动回滚，结果失败。

这说明Boot Camp本身可能有bug，我们不能使用Boot Camp进行安装。

# 避免踩坑的操作步骤

1. 做好以下准备：
    * U盘：注意文件系统要FAT32的，所以尽量不要用移动硬盘
    * USB键盘、USB鼠标（至少要预备个鼠标）
    * USB转接线（建议用那个死贵死贵要一百多块钱才能买一个的官方转接线）
    * 下载Windows 10 64位安装盘（可以去[msdn.itellyou.cn](http://msdn.itellyou.cn)下载），将安装盘映像当作压缩包解压到U盘上——因为MacBook也是EFI启动，所以解压就足够了，不需要特意找刻录软件去刻录
    * 给Windows多划些空间。现代游戏动不动就几十个G，而Windows系统本身再占三四十G，不划到100GB根本不够用。游戏种类再多些的话，就要变成Mac只留100GB了。
2. 按住Command+R开机，进入Recovery模式，完成以下操作：
    * [在磁盘工具给Windows分区、格式化](https://support.apple.com/zh-cn/guide/disk-utility/dskutl14027/mac)。注意两点，第一是记住磁盘容量以免在安装时错误地格式化，第二是尽量把容量计算好，因为调整容量非常麻烦，而且很可能要删分区。
    * [关闭安全启动](https://support.apple.com/zh-cn/HT208330)
3. 回到macOS，启动Boot Camp，点击“操作”中的“下载Windows支持软件”。下载完成后相关文件会放到家目录中，把它复制到U盘根目录中。这一步不要漏掉，否则后面安装时找不到硬盘。
4. 插上U盘，重启电脑，启动时按住Option键，从U盘启动。
5. 进入Windows安装程序，把事先预备好的键盘和鼠标接上，如果能操作，那么就可以按正常步骤安装Windows了。若在选择分区时提示没有硬盘或分区，可以点击“加载驱动程序”按钮，找到事先在macOS系统里面下载的支持软件，安装SSD驱动，使Windows安装程序能够发现分区。
6. 安装成功后，进入Windows系统，找到U盘里的支持软件，运行安装程序。安装成功后重启。

以这种方式进行安装，除了有点麻烦以及不能在macOS的Boot Camp界面进行管理（即删除Windows）以外，其他基本上没什么区别。

# 调整分区容量
一旦Windows系统用起来了，调整容量将是极其麻烦的事情。如果非扩容不可，建议先备份数据，然后删掉Windows分区，全部重来。

但是，如果Mac分区剩余空间比Windows系统盘大，那么还可以以一种麻烦的方式完成扩容：将Windows系统盘备份到映像，删除Windows盘并重新分区，然后恢复备份，修正分区表。如果操作成功，那么就不需要重装系统和各软件，也不需要再调系统设置了。

注意，操作有风险！如果不熟悉装机以及Linux/Unix操作，请不要继续，以免造成系统损坏或数据丢失！

建议在操作时使各分区容量不相同，而且进行每一步破坏性操作之前确认目标分区容量，以避免误操作。

按以下步骤操作：

1. 准备工作：
    * Windows安装U盘，其中已经预备好Boot Camp的“Windows支持软件”。
    * 转接线
    * USB键盘和鼠标（这次要敲命令所以一定要准备好键盘）
2. 按住Command+R开机，进入Recovery模式。
3. 进入磁盘工具，确认Windows安装盘的位置（例如/dev/disk0s2）以及Mac系统盘的名称（例如Macintosh HD）。如果还是拿不准的话，可以在终端里用“diskutil info /dev/disk0s2”这种命令来确认。
4. 退出磁盘工具，进入终端。假如Mac系统盘叫做Macintosh HD，Windows系统盘是/dev/disk0s2，那么需要输入以下命令进行备份：
    ```
    cd "/Volumes/Macintosh HD"
    dd if=/dev/disk0s2 of=backup.img bs=1m
    ```
5. 完成后重新进入磁盘工具，删除Windows分区，重新调整分区，不要格式化。Windows分区格式化工作交给Windows来做。
6. 重启，从U盘启动Windows安装程序，接上鼠标，在Windows安装程序界面上进行格式化。
7. 回到Mac的Recovery模式，确认新分区的位置是disk几s几（例如disk0s4）。
8. 重新进入终端，恢复映像：
    ```
    cd "/Volumes/Macintosh HD"
    dd if=backup.img of=/dev/disk0s4 bs=1m
    ```
9. 这时候Windows应该可以重新进入了。但是，dd并非那种专业Windows分区备份还原软件，所以Windows分区的容量和剩余空间还是错的，需要修正。再次用Windows安装盘启动，接上键盘和鼠标，这次按Shift+F10进入命令提示符，然后输入diskpart，进入分区工具。
10. 在diskpart里输入以下命令（注意命令中的“0”和“4”要根据实际情况填写）：
    ```
    list disk
    sel disk 0
    list volume
    sel volume 4
    extend
    ```
11. 检查两个系统能否正常启动。如果没问题就可以删掉苹果系统里的/backup.img了。

# 后续（2019年）
实际上大多数ISO是可以借助Boot Camp安装的，可以去[MSDN I Tell You](https://msdn.itellyou.cn/)多试几个版本，总有一个能用的。如果版本比较老，装好之后再去Windows Update里头做个升级就行了。

# 后续二（2020年）
Parallels Desktop 15优化了苹果电脑显卡支持。对于MacBook Pro来说，只要不是特别现代的游戏，虚拟机也能带得动了。例如本人试验，在虚拟机里（Windows 10，分配6GB内存），2019年发布的DOA6把电脑像挖矿一样卡崩了，同年发布的AI少女卡成了幻灯片，而2012年的CSGO就没有什么大毛病。
