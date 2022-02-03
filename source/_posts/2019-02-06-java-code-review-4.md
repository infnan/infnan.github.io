---
layout: post
title: Java代码审查（四）：使用Phabricator进行代码审计
category: 项目管理
tags: 
- Phabricator
---
本文介绍如何使用Phabricator进行人工代码审查（实际上是审计），以及供参考的操作规范。因为时间和篇幅有限，不再写如何搭建Phabricator，需要者可自行在网上搜索安装教程。

Phabricator是一个在浏览器上操作的开发管理平台，其中包括一个代码审查工具。工具支持两种代码审查方式，一种是事前审查，即提交之后必须先审查通过才能进入代码库；另一种是事后审查，也就是无论是否审查，代码都已经提交到代码库中。考虑我们自身实际情况（事前审查成本比较高），我们采用了“事后审查”的方式，本文也将讲述事后审查的操作。
<!-- more -->

# 概览
使用Phabricator进行代码审查的理由：
* 配置好之后比较容易上手，而且不用额外安装软件，只要电脑有浏览器就能使用。（不过对于配置者来说很难上手）
* 审查以代码提交为单位，每个提交都会展示差异，比较方便和直观。
* 审查时可直接在具体代码处标记问题，方便定位和纠正。
* 如采用Phabricator进行任务或缺陷管理，可将代码提交活动与任务/缺陷进行关联，便于任务跟踪。
* 支持表情包。

Phabricator的不足之处：
* 若提交不规范（例如多次提交），审查会变得比较繁琐。
* 若团队成员操作不规范，缺陷跟踪会变得混乱。（对策：制定操作规范）
* 缺少统计功能。（对策：在数据库建立查询用账号，通过SQL语句进行统计）
* 操作比较繁琐，进入一个功能需要点很多链接。（对策：把常用页面放在浏览器收藏夹中，或者使用Phabricator自带的定制面板和菜单功能把菜单设置好）

考虑先前代码审查所用手段和工具，我们项目决定采用Phabricator进行人工代码审查，并通过制定规范和进行培训来避免可能出现的问题。

# 准备工作
如果准备工作已经做好，那么可以直接跳到下面“审查”一节。

以下是Phabricator的基本条件：

1. 服务器上面安装了Phabricator及相关组件，包括Apache/Nginx、PHP 7.2、MySQL、Phabricator、Git/Subversion、Pygments（基于Python 3，在PATH中且可执行）等。
2. 服务器配置了域名。如果没有域名，那么需要设置一个伪域名，并要求各成员改hosts。
3. 给各成员建立了账号。（注意：如果给Phabricator配置了邮箱，注意几乎每个动作都会发邮件，需要告知大家调整系统邮件通知设置）
4. 有代码库访问权限。
5. Phabricator后台进程（Daemon）运行正常。

建议在Phabricator的“Project”应用中建立“Project”，然后将项目成员设置为“Member”，以方便组织成员并控制内容可见性。添加代码库以及新建任务的时候有个字段叫做“Tags”，这个“Tags”便是“Project”。

Phabricator安装非常复杂，建议使用现成的Docker容器，例如[bitnami版本](https://github.com/bitnami/bitnami-docker-phabricator)。

## 导入代码库
满足基本条件之后，需要在Phabricator中导入代码库才能开始进行审查。进入“Diffusion”应用，点击右上角“Create Repository”，在出现的画面中根据实际情况选择Git或SVN。新建完成后界面如下：

![repository](/img/2019-02-06-java-code-review-4/repository.png)

除了新建Repository，还需要完成以下工作才能开始审查：

1. 指定实际的Git/SVN仓库位置。
2. 设置需要导入的路径（仅适用于SVN）。
3. 设置默认字符编码（如果不是UTF-8的话）。
4. 激活仓库。

### 指定仓库位置
默认情况下Phabricator会自行托管仓库（Git），我们需要将其解除，并关联到实际的代码库上面。

![uri-1](/img/2019-02-06-java-code-review-4/uri-1.png)

点击URL，会进入具体设置

![uri-2](/img/2019-02-06-java-code-review-4/uri-2.png)

点击“Edit URI”修改设置

![uri-3](/img/2019-02-06-java-code-review-4/uri-3.png)

需要将其中的“I/O Type”修改成“No I/O”，然后保存。之后点击URIs页面上的“New URI”按钮，添加真正的代码库的URL：

![uri-4](/img/2019-02-06-java-code-review-4/uri-4.png)

注意“I/O Type”选择Observe，因为这个仓库仅用于代码审查，不用于真正的提交。（对于Git仓库，可以用Phabricator作为中介实现事前审查，但SVN仓库不支持事前审查）

若代码库需要认证，那么还需要在保存之后点击页面右侧的“Set Credential”设置账号密码。

建议给代码库设置Phabricator访问专用账号。

### 设置需要导入的路径（SVN）
在输入代码库URL时，我们必须输入整个SVN仓库的根目录。实际上可能仅在个别分支上进行开发，不需要关注整个代码库的提交，这样的话需要设置实际导入的路径：

![svn-path](/img/2019-02-06-java-code-review-4/svn-path.png)

### 设置字符编码、激活仓库
在概览页点击“Actions”按钮，从弹出的菜单中选择“Edit Text Encoding”即可指定默认编码。

选择“Activate Repository”即可激活仓库。一旦仓库激活，Phabricator的后台进程便会定时爬取Git/SVN提交记录，同步更新代码库。爬取频率与代码库实际提交情况有关，工作时间提交频繁，同步速度就快，而下班时间无人提交，同步速度也会降下来。

如果使用HTTPS协议的SVN仓库，且HTTPS证书不正确，那么同步版本库会失败。这种情况下可以进入服务器的shell，以Web Server用户身份手动运行一下svn checkout，永久信任证书，成功checkout之后便可自动同步了。

# 审查
进入Phabricator的Diffusion应用，找到自己项目的代码库，点击之后可以看到代码库内容和提交记录：

![repo](/img/2019-02-06-java-code-review-4/repo.png)

点击“Graph”之后可以翻看所有记录。点击Commit中的版本号，可以看到那个版本的变更内容：

![commit](/img/2019-02-06-java-code-review-4/commit.png)

其中左侧代码是修改之前的版本，右侧是修改之后的版本。代码中红色表示删除内容，而绿色表示增加内容。

Phabricator只能比较文本文件，如果是其他格式则需要自行用其他手段检查，但是不影响录入审查结果。另外Phabricator一次只能审查一个版本，如果想一次性审查多个版本，需要借助一些工具，例如IntelliJ IDEA或TortoiseSVN客户端。

检查完成后，需要到页面下面点击“Add Action”，从中选择审查结果。“Accept Commit”表示该版本通过，而“Raise Concern”表示发现问题需要修改。评论完成之后，点击右下角的“Submit”按钮即可提交。

需要注意的是，除了在页面下方评论区进行评论，也可以在问题代码位置进行评论。点击问题代码的行号，系统会在上面弹出评论框，这样就可以精确地指出哪一行代码存在问题，以便他人进行定位和修复。

顺便提一下，Phabricator支持送奖章和发表情包。点击页面右侧的“Award Token”可以送奖章，点击评论区工具栏的表情符号按钮可发送表情包。如需维护表情包，可回到Phabricator首页，在左侧找到“More Applications”，在应用列表中找到“Macro”，然后即可添加或修改表情包。表情包名称需要至少三个字。

# 纠正缺陷
进入Diffusion应用，点击页面左下角的“Browse Commits”可以进入提交概览页：

![commitview](/img/2019-02-06-java-code-review-4/commitview.png)

其中第一排的Needs Attention是需要你进行修改的缺陷，你需要点进去查看具体问题，修改，提交，将状态设置为“Request Verification”，然后告知审查者重申（旧版本和新版本都要审）。

如果你在代码提交说明或评论中提及其他版本号（例如上面的1d6d2ede8de4或R5:12345这种形式），Phabricator会自动在版本号上面生成链接，以便交叉引用。假如你的问题出现在R5:12345版本中，建议提交代码时在说明中包含“R5:12345”字样（例如“修正R5:12345代码审查问题”），这样在审查修改之后的版本（例如R5:12354）中可以直接点链接跳转到12345版本，而且12345这个版本的页面上也会多一个指向12354版本的链接。

# 缺陷跟踪
个人从Browse Commits里可以看到需要处理和等待他人处理的记录。如果想查看其他记录（例如专门审查某个人的提交），或者需要掌握整体的缺陷情况，可以使用高级搜索功能进行检索。

![search](/img/2019-02-06-java-code-review-4/search.png)

# 数据统计
Phabricator未提供导出代码审查问题列表功能，也没有代码审查问题的统计功能，因此需要登录到后台数据库，通过查SQL的方法进行导出和统计。

假设Phabricator中代码库代号为R5，那么

## 问题列表
```sql
SELECT
    cmt.commitIdentifier AS `提交ID`,
    DATE_FORMAT(FROM_UNIXTIME(cmt.epoch), '%Y-%m-%d %H:%i:%s') AS `提交时间`,
    dat.authorName AS `提交者`,
    usr.userName AS `审核者`,
    cmt.auditStatus AS `状态`,
    path.path,
    RIGHT(path.path, INSTR(REVERSE(path.path), '/')-1) AS `文件名`,
    CASE WHEN pl.lineNumber=0 THEN NULL ELSE pl.lineNumber END AS `行号`,
    pl.content AS `问题描述`
FROM phabricator_repository.repository_commit cmt
INNER JOIN phabricator_repository.repository_commitdata dat ON dat.commitID = cmt.id
INNER JOIN phabricator_audit.audit_transaction aud ON aud.objectPHID = cmt.phid AND aud.commentPHID IS NOT NULL
INNER JOIN phabricator_audit.audit_transaction_comment pl ON pl.phid = aud.commentPHID
LEFT JOIN phabricator_repository.repository_path path ON path.id = pl.pathID
INNER JOIN phabricator_user.user usr ON usr.phid = pl.authorPHID
WHERE
    cmt.repositoryID = 5
    -- 根据需要解除下面的注释
    -- AND auditStatus IN ('concern-raised', 'needs-verification')  -- 未关闭
    -- AND auditStatus = 'audited'                                  -- 已关闭
    -- AND DATEDIFF(SYSDATE(), FROM_UNIXTIME(cmt.epoch)) < 7        -- 七天之内
    -- AND DATEDIFF(SYSDATE(), FROM_UNIXTIME(cmt.epoch)) >= 7       -- 七天以上
ORDER BY cmt.epoch DESC, cmt.repositoryID DESC;
```

## 按提交人统计未关闭缺陷数量
```sql
SELECT
    u.userName, u.realName, count(1) as 未关闭数目
FROM phabricator_repository.repository_commit c
INNER JOIN phabricator_user.user u ON u.phid=c.authorPHID
WHERE
    c.auditStatus IN ('concern-raised', 'needs-verification')
    AND c.repositoryID = 5
GROUP BY
    u.userName, u.realName
ORDER BY count(1) DESC;
```

# 操作规范（仅供参考）
* 应当按照实际开发活动一次性把相关文件都提交上，但是开发活动不同的话代码也要分开提交。
* 提交代码必须书写合适的提交说明。
* 如有开发活动，每日不定期进行代码审查。
* 新员工和一点人生的经验不足者的代码必须被审查。
* 审查如发现问题，需要进行说明，并将其标记在问题代码处。
* 问题纠正后由本人在系统中将状态标记为“Request Verification”，通过Git/SVN提交摘要或站内评论的方式将新旧版本号关联，然后由原审查者重审，将新旧版本同时关闭。
* 审查发现的问题应当及时（例如限制一周之内）关闭。

# 本系列目录
1. [代码审查问题](/2019/01/02/java-code-review-1)
2. [应用安全问题](/2019/01/03/java-code-review-2)
3. [关于编程习惯的要求](/2019/01/04/java-code-review-3)
4. **使用Phabricator进行人工代码审查**
5. 使用FindBugs和SonarQube等工具进行扫描
6. ……
