---
layout: post
title: 用Puppeteer扒漫画
category: 闲谈
tags:
  - 爬虫
  - Puppeteer
---
[Puppeteer](https://github.com/GoogleChrome/puppeteer)是Google搞的爬虫框架，其特点就是我们可以直接通过程序来操作Google浏览器（服务器没装图形界面也没关系，这个Google浏览器不需要图形界面）。通过这个框架，我们就可以像正常使用浏览器一样爬网站，并且像进控制台那样操作页面获取信息，甚至还可以截图。只要网站不使用验证码或reCAPTCHA之类的大杀器，而且运营者不希望正常使用浏览器的用户也无法访问页面，那么我们就可以随便扒网站了。例如本文从[https://tw.manhuagui.com](tw.manhuagui.com)网站扒漫画。
<!-- more -->

下面直接贴代码：

```js
/**
 * https://tw.manhuagui.com 扒漫画工具
 * 
 * @author infnan
 * @version 1.0
 */

'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const request = require('request');
const winston = require('winston');

// 用await延时
const sleep = (timeout) => new Promise((resolve, reject) => { setTimeout(() => resolve(), timeout); });

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format(info => {
            info.level = info.level.toUpperCase();
            return info;
        })(),
        winston.format.colorize(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `[${info.timestamp}] <${info.level}> ${info.message}`)
    ),
    transports: [new winston.transports.Console()]
});

/**
 * 显示用法
 */
const showUsage = () => {
    console.log('tw.manhuagui.com 漫画下载器 v1.0');
    console.log('目前支持单话或整本。下载整部作品时建议在VPS上跑。');
    console.log();
    console.log('node manhuagui.js [--rate 频率] [--dest 存储位置] [--override] [--help] <url>');
    console.log();
    console.log('  url:            例如 https://tw.manhuagui.com/comic/22843/314335.html（某一话）或 https://tw.manhuagui.com/comic/22843/（整部作品）');
    console.log('  --rate 0.5:     每秒下载多少页，默认值0.5。建议两秒一张，超过这个速度很容易被网站封IP。');
    console.log('  --dest 存储位置: 把漫画存到哪个地方。');
    console.log('  --override:     即使下过也要重新下载（仅限下整部作品的时候判断）');
};

/**
 * 建立目录。已存在的时候忽略报错。
 * @param {string} path 
 */
const mkdir = (path) => new Promise((resolve, reject) => {
    fs.mkdir(path, (err) => {
        if (err && err.code !== 'EEXIST') {     // 目录已存在不要当成错误
            reject(err);
        } else {
            resolve();
        }
    });
});

/**
 * 下载单个文件
 * 说明： 正常情况下这样就能下载下来，但是漫画网站服务器有个配置不对，
 * 而且Chromium有个bug（ https: //github.com/GoogleChrome/puppeteer/issues/795），
 * 下载下来的东西里头带有锟斤拷，所以后面不使用这个方法下载。
 * @param {Browser} browser 
 * @param {string} url 
 * @param {string} filename 
 */
const downloadFile = async (browser, url, filename) => {
    // 打开新标签页
    const page = await browser.newPage();

    // 开始下载
    const img = await page.goto(url);
    fs.writeFileSync(filename, await img.buffer());
    await page.close();
};

/**
 * 单话
 * @param {Page} page 
 * @param {Object} options 
 */
const processSingleManga = async (page, url, options) => {
    // 跳转到页面
    try {
        await page.goto(url, { timeout: 10000 });
    } catch {
        try {
            await page.evaluate((_) => window.stop());
        } catch (e) {
            logger.error('下载错误', e);
            return;
        }
    }

    // 借助页面本身的jQuery取漫画名称和第几话
    const title = await page.evaluate(`$('div.w980.title h1 a').text()`);
    const subtitle = await page.evaluate(`$('div.w980.title h2').text()`);
    if (!title) {
        logger.error('未知内容，PASS！');
        return;
    }

    // 取漫画页数
    const count = await page.evaluate(`$('#pageSelect option').length`);
    if (!count) {
        logger.error('未获取到漫画页数，PASS！');
        return;
    } else {
        logger.info(`加载完成，页数：${count}`);
    }

    // 在本机建立目录
    const dirName = `${title.trim()} ${subtitle.trim()}`;
    const destPath = path.join(options.dest, dirName);
    await mkdir(destPath);

    // 用jQuery控制点击“第1页”
    await page.evaluate(`$('#pageSelect').val('1').change();`);

    // 下载漫画
    for (let i = 1; i <= count; i++) {
        // 获取图片URL
        const imgSrc = (await page.evaluate(`$('#mangaFile').prop('src')`)).replace('.webp', '');

        // 下载文件
        const basePath = path.join(destPath, `${i}`);
        logger.info(`${i}/${count}: url = ${imgSrc}`);

        // 因为这家网站服务器有个设置不对，而且Chromium有个bug，直接爬buffer会整出锟斤拷，所以没法像下面这样下载
        // await downloadFile(browser, imgSrc, `${basePath}.jpg`);

        // 虽然上面方法不能用，但是此网站服务器只校验Referer，不校验Cookie，所以直接请求更简单
        request({
            uri: imgSrc,
            headers: {
                'User-Agent': options.userAgent,
                'Referer': page.url(),
            },
        }).pipe(fs.createWriteStream(`${basePath}.jpg`));

        // 模拟按向右箭头按钮，进入下一页
        await page.keyboard.press('ArrowRight');

        // 延迟，以免因为速度太快被封IP
        await sleep(options.delay);
    }
};

/**
 * 下载整部作品
 * @param {Page} page 
 * @param {Object} options 
 */
const processWholeManga = async (page, url, options) => {
    // 跳转到页面
    await page.goto(url);

    // 借助页面本身的jQuery取漫画名称和第几话
    const title = await page.evaluate(`$('div.book-cont div.book-title').text()`);
    if (!title) {
        logger.error('未知内容，PASS！');
        return;
    }

    logger.info(`开始下载《${title}》...`);

    // 爬页面上的链接，准备一个一个地点击
    const mangalist = [];
    const linklist = await page.$$('div.chapter div.chapter-list li a');
    for (let link of linklist) {
        let countEle = await link.$('i');
        let countStr = await (await countEle.getProperty('textContent')).jsonValue();
        mangalist.push({
            title: await (await link.getProperty('title')).jsonValue(),
            url: await (await link.getProperty('href')).jsonValue(),
            count: parseInt(countStr)
        });
    }
    logger.info(`已发现${mangalist.length}话`);

    for (let manga of mangalist) {
        let dirName = `${title} ${manga.title}`;

        // 判断是不是已经下载过了，以节省时间
        if (!options.override) {
            let ok = true;
            for (let i = 1; i < manga.count; i++) {
                if (!fs.existsSync(path.join(options.dest, dirName, `${i}.jpg`))) {
                    ok = false;
                    break;
                }
            }

            if (ok) {
                logger.info(`${manga.title} 已下载过，PASS`);
                continue;
            }
        }

        logger.info(`开始下载 ${manga.title}`);
        await processSingleManga(page, manga.url, options);
    }
};

/**
 * 开始下载
 * @param {Array} urllist 
 * @param {Object} options 
 */
const doWork = async (urllist, options) => {
    // 开启无头浏览器
    const browser = await puppeteer.launch({
        headless: true,
    });
    options.userAgent = await browser.userAgent();

    for (let url of urllist) {
        try {
            logger.info(`【漫画URL】${url}`);

            const page = (await browser.pages())[0];                            // 取浏览器第一个Tab页
            await page.setViewport({ width: 1366, height: 768 });    // 浏览器窗口大小

            // 判断是单话还是整个作品
            if (url.match(/\/comic\/\d+\/\d+/)) {
                await processSingleManga(page, url, options);
            } else {
                logger.info('检测到要下载整部作品');
                await processWholeManga(page, url, options);
            }
        } catch (e) {
            logger.error(`下载过程中出现错误: `, e);
        }
    }

    // 关闭浏览器
    await browser.close();
};

// 命令行参数
const argv = require('minimist')(process.argv.slice(2));
if (!argv._ || argv._.length === 0 || argv.help || argv.version) {
    showUsage();
} else {
    // 开工
    doWork(argv._, {
        delay: 1000 / (argv.rate || 0.5),
        dest: argv.dest || '.',
        override: argv.override,
    });
}
```

package.json：

```json
{
  "name": "manhuagui",
  "version": "1.0.0",
  "description": "",
  "main": "manhuagui.js",
  "dependencies": {
    "minimist": "^1.2.0",
    "puppeteer": "^1.14.0",
    "request": "^2.88.0",
    "winston": "^3.2.1"
  },
  "devDependencies": {},
  "scripts": {
    "start": "node manhuagui.js",
    "install-start": "npm install && npm start"
  },
  "author": "infnan",
  "license": "AGPL-3.0-or-later"
}
```
