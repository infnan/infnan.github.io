---
layout: post
title: 在GitLab CI中构建GitBook的各种坑
category: 教程
tags:
- GitLab
- GitBook
---
GitBook是一个好用的文档工具，然而他们已经转型在线敛财，留下的开源的框架已经弃坑。我们用GitLab CI（或其他自动构建系统）构建，则会有很多的坑。本文梳理了会遇到的各种坑。

<!-- more -->

# GitBook的各种坑
## 卡在 Installing GitBook 3.2.3
这个是国内网络问题，直接换用淘宝源即可：
```
npm config set registry https://registry.npm.taobao.org
```

通常情况下，这样是不够过瘾的，所以要换得全一些，免得再踩坑：
```
npm config set registry https://registry.npm.taobao.org
npm config set disturl https://npm.taobao.org/dist
npm config set sass_binary_site https://npm.taobao.org/mirrors/node-sass
npm config set electron_mirror https://npm.taobao.org/mirrors/electron/
npm config set puppeteer_download_host https://npm.taobao.org/mirrors
npm config set chromedriver_cdnurl https://npm.taobao.org/mirrors/chromedriver
npm config set operadriver_cdnurl https://npm.taobao.org/mirrors/operadriver
npm config set phantomjs_cdnurl https://npm.taobao.org/mirrors/phantomjs
npm config set selenium_cdnurl https://npm.taobao.org/mirrors/selenium
npm config set node_inspector_cdnurl https://npm.taobao.org/mirrors/node-inspector
npm config set node_sqlite3_binary_host_mirror https://npm.taobao.org/mirrors

yarn config set registry https://registry.npm.taobao.org
yarn config set disturl https://npm.taobao.org/dist
yarn config set sass_binary_site https://npm.taobao.org/mirrors/node-sass
yarn config set electron_mirror https://npm.taobao.org/mirrors/electron/
yarn config set puppeteer_download_host https://npm.taobao.org/mirrors
yarn config set chromedriver_cdnurl https://npm.taobao.org/mirrors/chromedriver
yarn config set operadriver_cdnurl https://npm.taobao.org/mirrors/operadriver
yarn config set phantomjs_cdnurl https://npm.taobao.org/mirrors/phantomjs
yarn config set selenium_cdnurl https://npm.taobao.org/mirrors/selenium
yarn config set node_inspector_cdnurl https://npm.taobao.org/mirrors/node-inspector
yarn config set node_sqlite3_binary_host_mirror https://npm.taobao.org/mirrors
```

但是，到了CI服务器上，这样有可能还会卡Installing，所以我们可以考虑提前手工把这个3.2.3装好（位于`~/.gitbook/versions/3.2.3`）：

```bash
mkdir -p ~/.gitbook/versions
cd ~/.gitbook/versions
npm pack gitbook@3.2.3
tar -xvf gitbook-3.2.3.tgz
mv package 3.2.3
cd 3.2.3
npm i

# 防止踩后文提到的一个坑
npx npm i cpr@3
```

安好之后把它打包上传到服务器里面，然后我们需要设法让CI每次构建之前都能找到这个文件。

假设GitLab CI Runner基于Docker，那么有两种处理方法：
* 一种是把3.2.3文件也传到代码里，然后在构建步骤中增加类似`mkdir -p ~/.gitbook/versions; ln 3.2.3 ~/.gitbook/versions`的操作。但是大家都知道光处理一个node_modules就会耗费大量时间，所以除非没权限操作服务器，否则不太推荐。
* 如果有服务器权限的话，最简单的办法就是设置一个Volume，把3.2.3所有文件提前装好放到某个位置（例如`/data/gitlab-runner-gitbook-cache/versions/3.2.3`），然后修改Runner的config.toml：
```toml
[[runners]]
  ...
  [runners.docker]
    ...
    volumes = [
      ...
      "/data/gitlab-runner-gitbook-cache:/root/.gitbook",
    ]
```

说到config.toml，顺便提一下，`/root/.npm`和`/cache`也可以顺便在服务器本机缓存一下，避免每次创建容器时都重新下载，从而提高构建速度。

## 报错，TypeError: cb.apply is not a function
报错全文：
```
/usr/local/lib/node_modules/gitbook-cli/node_modules/npm/node_modules/graceful-fs/polyfills.js:287
      if (cb) cb.apply(this, arguments)
                 ^

TypeError: cb.apply is not a function
    at /usr/local/lib/node_modules/gitbook-cli/node_modules/npm/node_modules/graceful-fs/polyfills.js:287:18
    at FSReqCallback.oncomplete (node:fs:194:5)
```

解决方法有两种：
* 将Node.js降级为版本10.x
* 找到报错的源头，即polyfills.js文件的第287行，将这个函数直接改成
```js
function statFix (orig) {
  return orig
}
```

鉴于我们要通过CI来构建，推荐使用第一种解决方法。

## 莫名其妙地找不到文件
错误信息：
```
Error: ENOENT: no such file or directory, stat '/builds/xxxxx/xxxxx/_book/gitbook/gitbook-plugin-xxx/xxx.js'
```

如果你多试几次，可能会发现每次报错的文件都不一样。

如果GitBook 3.2.3是手工安装的，需要进到安装目录里，补一条命令，例如：
```
cd ~/.gitbook/versions/3.2.3
npx npm i cpr@3
```

自动安装（如果你不嫌卡Installing GitBook 3.2.3）则需要提前`gitbook fetch 3.2.3`，然后在正式build之前执行上面两行命令（当然建议写成一行`(cd ~/.gitbook/versions/3.2.3 && npx npm i cpr@3)`，命令两端有括号）。

## 左侧的文档目录未更新
是不是使用summary插件自动生成目录了？如果是，每次build两遍就好了。

# 参考操作
## 手工安装GitBook 3.2.3
参见前文。

## package.json
仅列举部分内容：

```json
{
  // ...
  "scripts": {
    "serve": "gitbook serve",
    "build": "gitbook build"
  },
  "dependencies": {
    "gitbook-cli": "^2.3.2",
    "gitbook-plugin-editlink": "^1.0.2",
    "gitbook-plugin-prism": "^2.4.0",
    "gitbook-plugin-search-pro": "^2.0.2",
    "gitbook-plugin-summary": "^1.1.0",
    // 其他插件...
    // 唯独不能放 gitbook，否则会报错
  }
}
```

## .gitlab-ci.yml

```yaml
stages:
  - build
  - deploy

variables:
  PROD_DEPLOY_USER: root
  PROD_DEPLOY_HOST: x.x.x.x
  PROD_DEPLOY_PORT: 22
  PROD_DEPLOY_PATH: /var/www/html
  # PROD_DEPLOY_SSH 在 GitLab 的 Settings -> CI/CD -> Variables 中配置

build:
  stage: build
  image: node:10      # 此处要使用版本10

  script:
    - npm config set registry https://registry.npm.taobao.org
    - npm config set disturl https://npm.taobao.org/dist
    - npm i
    - npm run build
    # 使用summary插件生成目录的话，需要build两遍才能显示新版的目录
    - npm run build

  cache:
    paths:
      - node_modules/

  artifacts:
    paths:
      - _book
    expire_in: 1 week

  only:
    - master

deploy:
  stage: deploy
  image: sebble/deploy
  script:
    - mkdir -p ~/.ssh
    - echo "$PROD_DEPLOY_SSH" >> ~/.ssh/id_dsa
    - chmod 600 ~/.ssh/id_dsa
    - echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > ~/.ssh/config
    - rsync -rav -e "ssh -p $PROD_DEPLOY_PORT" _book/ "$PROD_DEPLOY_USER"@"$PROD_DEPLOY_HOST":"$PROD_DEPLOY_PATH"
  only:
    - master
```

# 参考资料
* https://github.com/GitbookIO/gitbook-cli/issues/55
