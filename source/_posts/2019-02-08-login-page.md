---
layout: post
title: 并不简单的基础开发工作（一）：登录页面
category: 项目开发经验
tags:
- 功能设计
---
开发业务系统，虽然原理非常简单，就是数据库的增删改查，而且业务规则也不过是一堆if-else判断，但是想要做好其实并不容易。本系列文章旨在说明：即使是看起来非常简单的基础开发工作，在设计和实现上也会有很多陷阱，需要非常认真和细心才行。

本文以简单的登录页面为例，为了突出问题，假设系统只有两个页面：一个登录页面，另一个是登录成功之后显示的“Hello world”。
<!-- more -->

# 思路
登录的思路很简单，就是去数据库里查一下用户输入的账号和密码是否和数据库数据一致，如果一致就将会话状态设置成“已登录”，并跳转到正式的操作页面上，如果不一致就返回登录页面并提示“账号密码错误”。

# 设计方面的问题
## 暴露多余的信息
有的系统会“智能”地提示“用户名错误”、“密码错误”，这样会在不经意间暴露多余信息。特别是“密码错误”，这个提示会暗示“用户名正确”，从而促使攻击者加快攻击的步伐。正确的做法是使信息尽可能模糊，只提示“用户名或密码错误”。

## 未防范暴力破解
虽然密码不正确的话进不去，但是网站也未针对暴力破解进行防范，也就是说，只要写个程序一个一个密码地试验，早晚能把密码试出来。因此需要设计防暴力破解的机制，例如：

* 输入正确的验证码才能登录（需注意简单的验证码可以被机器识别）。
* 第一次不需要输入验证码，但是输错账号密码之后需要输入验证码（需注意“第一次进入登录页面”这种情况也可以伪造）。
* 多次认证错误之后锁定账号，例如输错3次密码锁定半小时。（推荐）

## 明文存储密码
在数据库中密码不应当明文存储，否则数据库被攻破之后密码会直接泄漏，更严重的话用户在其他网站账号也会随之攻破（例如[2011年中国网站用户信息泄露事件](https://zh.wikipedia.org/wiki/2011%E5%B9%B4%E4%B8%AD%E5%9B%BD%E7%BD%91%E7%AB%99%E7%94%A8%E6%88%B7%E4%BF%A1%E6%81%AF%E6%B3%84%E9%9C%B2%E4%BA%8B%E4%BB%B6)）。

密码应当散列之后再存储到数据库中，而且要用比较安全的散列算法，例如bcrypt。不能用简单的MD5、SHA1（包括MD5之后再MD5），否则仍然有可能通过彩虹表等手段破解（例如事先把常用密码的MD5都计算好，看到`202CB962AC59075B964B07152D234B70`之后就很容易猜出它是“123”）。

## 没有日志记录
建议设计登录审计功能，每次登录无论成功还是失败都将用户信息记录（主要是IP信息）下来，并提供记录查询，以便使用户判断账号是否安全，或者在发生盗号等安全事件之后进行追溯。

除此之外也可以加入多重认证（例如隐私验证问题、短信验证码、Google Authenticator）、异地登录提醒等功能，提高安全性。

## 没有找回密码功能
既然有登录功能，那么也应该提供找回密码的功能（设计上要求用户拿着身份证去柜台申请重置密码的除外），使忘记密码的人能够自行重置密码。[这篇文章](http://www.ruanyifeng.com/blog/2019/02/password.html)介绍了设计找回密码功能时需要注意的事情。

## 是否需要互斥？
无论是业务系统，还是其他系统，均会存在多人同时操作同一账号的情况，因此在设计上需要考虑是否允许这种情况（若不允许，需要考虑是否在技术上加以限制）。

# 实现方面的问题
初学者被安排编码工作之后，如果经验不足，也容易犯一些错误，例如：

## 绕过认证
如果知道Helloworld页面的网址，没登录的情况下能不能依靠直接敲网址进去呢？如果能，说明只实现了登录功能，配套的会话验证和权限验证功能没实现。

## SQL注入问题
初学者容易这样来书写SQL：

```java
String sql = "SELECT count(1) FROM users WHERE username='" + username + "' AND password='" + password + "'";
```

代码中的SQL是直接拼接的，所以只要在密码框输入`' or '1'='1`即可绕过验证，因为SQL会变成：

```sql
SELECT count(1) FROM users WHERE username='admin' AND password='' or '1'='1';
                                                                ^=========^
```

所输密码成为了SQL逻辑的一部分，破坏了原来SQL的逻辑，即SQL注入。

建议尽可能用绑定参数的形式来查询SQL。如果非要去拼接字符串，那么必须保证用户输入全部被转义，但是不推荐拼接因为容易忘记过滤。

## 前台校验
建议加入前台校验，当用户未输入用户名或密码便点击登录按钮时，系统给出提示并跳转到未输入内容的文本框上，因为前台校验和提示发生在用户的浏览器上面，耗时可以忽略不计，而提交到服务器去校验，提交和返回都需要时间，网络状况差的话速度会比较慢。另外建议采用统一的校验程序，不要自己写校验js，浪费时间精力。

即便如此，后台校验（特别是业务层面的校验）也是必不可少的，因为前台校验即使逻辑再严密也可以很轻松地绕过去。

## 重复提交表单
由于用户的网络环境不一定很好，点击“登录”按钮之后可能需要等待一段时间才能出来结果，这时候不耐烦的用户可能会多点击几下按钮，因此编码时候要考虑到这一点。一个简单的处理办法是点击“登录”按钮之后立刻将按钮变灰（无法点击），直到返回结果之后再恢复按钮状态。

## 明文传输
国内很多网站仍然在使用HTTP协议进行传输。HTTP传输内容都是明文，在不安全的网络环境下，用户访问的信息很容易遭到监视和篡改：

![密码被截获](/img/2019-02-08-login-page/password.png)

而HTTPS协议传输内容是经过加密的，监听者既无法解密也无法篡改，因此建议尽可能将网站更换成HTTPS协议。

## 串号
有些人喜欢注册小号，即使是必须本人操作的业务系统，也存在很多将账号交给他人代办的情况。假如用户操作完A账号，注销（或者直接重新进入登录页面），然后登录B账号，但是A账号相关页面并未关闭，那么在这些页面中还能继续操作吗？

# 更致命的问题——有必要全部自己开发吗？
本文章只是为了说明问题，功能也简单到只有俩页面。实际上，在生产过程中应当采用一些现成的成熟框架，不要自己从头开始实现用户管理功能，既浪费时间和金钱，又容易漏洞百出。

# 本系列目录
1. **登录页面**
2. [信息展示列表](/2019/02/09/list-page/)
3. [信息录入表单](/2019/09/21/edit-page/)
4. 业务申办-审批流程