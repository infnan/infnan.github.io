---
layout: post
title: 从Eclipse切换到IDEA
category: 教程
tags: 
- IDEA
---
我们项目组之前一直使用Eclipse进行开发。对于我们项目而言，由于Eclipse存在现实的问题，我便开始研究IDEA的用法，并且试着将工作切换到IDEA上面，之后逐步地在项目组内推广使用IntelliJ IDEA。本系列文章面向Eclipse使用者，讲述IDEA的一些基本操作，以便平稳地进行切换。
<!-- more -->

# 本系列内容
* **为什么进行切换**
* [切换的基本操作](/2018/12/13/switch-to-idea-1/)
* [传统Web项目在IDEA的Project Structure](/2019/01/27/switch-to-idea-2)
* [传统Web项目转为Gradle项目](/2019/08/03/switch-to-idea-3/)

# 切换到IDEA的理由
下面是我向同事推荐使用IDEA（商业版）的一些理由：

1. 公司版本管理软件从ClearCase切换到了SVN，这意味着开发工作不再受ClearCase拖累，开发工具也可以随意换成更好用的了。
2. 公司电脑配置不高，而且项目文件非常多，Eclipse用起来很卡。虽然IDEA资源消耗比较高，但是用起来比Eclipse顺畅得多（备注：对于内存只有4GB的电脑，要么加条，要么换旧版IDEA，否则会很糟糕）。
3. IDEA的搜索比Eclipse快得多，按全项目搜索的话，Eclipse要等把所有文件都过一遍，而IDEA可以一下子搜出来。
4. IDEA的SVN支持非常好，可以很方便地检查自己修改的代码、查询同事修改、对比文件版本，虽然TortoiseSVN和Eclipse也有类似功能，但是IDEA用起来更舒服。

以下也是IDEA的长处，不过有些是个人体验，或者未作为推销的内容向同事介绍：

1. IDEA的工作空间对版本控制友好，只要我把项目配置好，加到版本库中，其他人就可以直接用IDEA打开项目，等IDEA把文件索引完，然后再配一下JDK和Tomcat路径就能投入开发了。Eclipse的话每次全新checkout都要从头开始配置，而且我们项目组有时也会出现因工作安排变动或电脑难用而重新搭环境甚至重装系统的情况。
2. IDEA集成了数据库插件，代码提示比其他数据库软件好一些。另外修改数据时PL/SQL Developer需要附上FOR UPDATE，Toad需要用EDIT语句，SQL Developer需要自己写UPDATE语句，而IDEA可以直接在查询结果上面改。
3. IDEA对代码风格方面的提示和警告比Eclipse丰富，例如IDEA可以检测出哪些代码是一模一样的，或者哪些类与函数根本没有人使用。
4. IDEA自带反编译工具，可以方便地反编译代码，以分析一些jar包的原理。

当然，Eclipse的用户和插件也不少，对于爱搞配置的人来说应该也比较好用。

# 差异
Eclipse和IDEA的界面与操作方法有些区别。概念上的重大差异主要是“Project Structure”，即项目文件结构的管理，不过如果有人把项目配置好并提交版本控制之后，其他成员反倒不太需要关注这些东西，因此我会另外写一篇文章进行叙述。

# 法律问题
IDEA分免费的社区版（Community Edition）和收费的商业版（Ultimate Edition），前者不支持Web开发，只能选用商业版。商业版需要激活，大家往往会用注册码、注册机来进行破解。这当然是违法的，而且比起个人，公司更容易陷入诉讼（告赢了就是一大笔钱），因此有条件的话务必买正版。
