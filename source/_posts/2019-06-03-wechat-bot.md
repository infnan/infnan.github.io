---
layout: post
title: 使用Puppeteer制作微信消息通知机器人
category: 闲谈
tags:
  - Puppeteer
  - 微信
---
微信机器人是一个比较难搞的东西，因为微信登录比较麻烦，而且官方不仅不提供API，还积极封杀机器人和“非法登录”的途径，导致研发风险较大。目前比较成熟的两种方式是模拟微信网页版以及程序控制微信PC版应用。

本文采用Puppeteer框架，借助真实的浏览器访问微信网页版，模拟浏览器的正常操作，以降低被封杀的风险。
<!-- more -->

## 大致思路
* 使用Express框架提供对外接口，让其他程序能够调用。
* 使用Puppeteer来访问微信网页版。由于微信网页版需要扫码登录，需要设计接口来暴露二维码（这里直接提供网页截图）。另外二维码会过期，因此需要刷新机制（本文程序的话，重启就行，不需要再另行实现）。
* 通过操作DOM来判断页面的状态。
* 通过模拟按键来寻找好友或群组、输入消息和发送消息。
* 通过捕获浏览器AJAX请求来获取新消息内容（本文未实现）。
* 实现敏感词和敏感言论过滤机制，以防无意或有意的攻击。

## 代码
详细参见[https://github.com/infnan/SimpleNotifyBot](https://github.com/infnan/SimpleNotifyBot)。

开启浏览器：
```js
// 开启无头浏览器
const browser = await puppeteer.launch({
    headless: true,
});

const page = (await browser.pages())[0];                 // 取浏览器第一个Tab页
await page.setViewport({ width: 1366, height: 768 });    // 浏览器窗口大小

// 使用简体中文界面
await page.goto('https://wx.qq.com/?lang=zh_CN');
```

发送消息的过程：

```js
const sendMessage = async (target, message) => {
    // 判断是否登录
    const unloginTest = await page.$('body.unlogin');
    if (unloginTest) {
        throw new MessageError('Not login', 'NOLOGIN');
    }

    if (!target) {
        throw new MessageError('Target not found', 'NOTARGET');
    }

    // 如果当前聊天就是目标，那么不用搜了，直接蹦到聊天框
    const testEle1 = await page.$('#chatArea a.title_name');
    const test1 = await (await testEle1.getProperty('textContent')).jsonValue();
    
    if (test1 !== target) {
        const searchEle = await page.$('#search_bar > input');

        // 清空搜索框和搜索结果
        await page.$eval('#search_bar input', node => node.value = '');
        await searchEle.focus();
        await searchEle.type(' ');
        await searchEle.press('Backspace');
        // 延时，使页面上原有的搜索结果消失
        for (let timeout = 40; timeout >= 0; timeout--) {
            const testEle2 = await page.$('#search_bar div.mmpop');
            if (!testEle2) {
                break;
            }
            await sleep(50);
        }

        // 输入目标群组名称
        await searchEle.type(target);

        // 等待出现搜索结果，最长等待5秒
        let ok = false;
        for (let timeout = 100; timeout >= 0; timeout--) {
            const testEle3 = await page.$('#search_bar div.mmpop h4.contact_title');
            if (testEle3) {
                const test3 = await (await testEle3.getProperty('textContent')).jsonValue();
                if (test3 === '找不到匹配的结果') {
                    throw new MessageError('Target not found', 'NOTARGET');
                } else {
                    ok = true;
                    break;
                }
            }
            await sleep(50);
        }
        if (!ok) {
            throw new MessageError('WeChat not responding', 'NORESPONSE');
        }

        // 遍历搜索结果
        // 由于overflow数字不大，且翻页需要消耗操作和等待网络请求的时间，建议目标名称独一无二，免得不好找。
        const pop = await page.$('#search_bar div.mmpop');
        let lastname = '';
        ok = false;
        for (let overflow = 100; overflow >= 0; overflow--) {
            const nowEle = await pop.$('div.contact_item.on');
            // 说明正在loading
            if (!nowEle) {
                await sleep(50);
                continue;
            }
            let currname = await (await (await nowEle.$('h4')).getProperty('textContent')).jsonValue();
            if (lastname === currname) {
                // 未找到目标，结束
                ok = false;
                break;
            }
            lastname = currname;

            // 如果没找到而且能往下翻那么就继续往下翻
            // 找到的话按一下回车键，进入聊天界面
            if (currname === target) {
                ok = true;
                await searchEle.press('Enter');
                break;
            } else {
                await searchEle.press('ArrowDown');

                // 等待微信响应
                for (let timeout = 10; timeout >= 0; timeout--) {
                    const nowEle2 = await pop.$('div.contact_item.on');
                    if (nowEle2) {
                        let currname2 = await (await (await nowEle2.$('h4')).getProperty('textContent')).jsonValue();
                        if (currname !== currname2) {
                            break;
                        }
                        await sleep(20);
                    } else {
                        // 暂时到底了，需要loading
                        await sleep(200);
                    }
                }
            }
        }
        if (!ok) {
            throw new MessageError('Target not found', 'NOTARGET');
        }

        // 等待进入聊天界面
        for (let timeout = 50; timeout >= 0; timeout--) {
            const titleEle = await page.$('#chatArea a.title_name');
            const title = await (await titleEle.getProperty('textContent')).jsonValue();
            if (title === target) {
                break;
            }
            await sleep(20);
        }
    }

    const testEle4 = await page.$('#chatArea a.title_name');
    const test4 = await (await testEle4.getProperty('textContent')).jsonValue();
    if (test4 === target) {
        // 输入消息
        await page.$eval('#editArea', node => node.textContent = '');

        const editEle = await page.$('#editArea');
        await editEle.focus();
        for (const [i, line] of message.split('\n').entries()) {
            if (i > 0) {
                // 发送多行消息时需要用 Ctrl+Enter 换行
                await page.keyboard.down('Control');
                await page.keyboard.press('Enter');
                await page.keyboard.up('Control');
            }
            await editEle.type(line);
        }

        // 按下发送按钮
        await page.keyboard.press('Enter');
    } else {
        throw new MessageError('Target not confirmed', 'NORESPONSE');
    }
};
```

## 保号注意事项
为确保安全，使用机器人时需要多加注意，以免封号甚至招致牢狱之灾。以下皆为网友经验，仅供参考。

### 注册
* 使用真实手机注册，避免用模拟器或双开软件。
  - 使用模拟器的话需要先用xprivacy控制好微信的权限，否则会无法登录或被微信封禁。
  - 使用双开之前先调查靠不靠谱，例如有些双开会被微信识别，导致账号被封，而小米手机的双开就比较安全。
* 使用真实手机号注册，并进行实名认证，然后绑定一张银行卡，再往微信钱包里头存一块钱。
* 手机和手机号尽量专用，一个设备或手机号不要拿着注册很多微信号，也不要拿着频繁登录注销。
* 新注册的账号要在真实的手机上挂15至30天，然后再进行其他操作，以免让系统“大数据”识别。
* 不要忘记设置昵称、地区和头像。
* 至少保持三个真实好友。
* 一天之内不要加太多好友。
* 好友不要超过5000。

### 发送消息
* 注意消息发送频率不要太高。几秒钟就发一大堆消息（例如像[脸滚键盘](https://www.bilibili.com/video/av394281/)那样），这样很容易被封号。
* 不定期往“filehelper”或专用群发送keepalive消息，以防掉线。
* 注意设计监控和报警机制，掉线之后能及时去恢复连接。
* 要特别注意控制消息发送内容！尤其是接受用户输入的程序，一定要做好言论控制，以免他人无意或有意触发政治敏感话题，导致你的账号被封，甚至让你被警方请去喝茶。
