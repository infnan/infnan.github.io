---
layout: post
title: MySQL数据库设计规范（三）：PDM文档
category: 项目管理
tags:
- 规范
- MySQL
---
本文为我们项目中所采用的数据库文档的设计规范。

计划分为三篇文章，[第一篇](/2020/11/01/db-specification/)为数据库的表结构设计，[第二篇](/2020/11/07/db-specification-2/)为SQL语句的书写，本篇为PDM文档规范。
<!-- more -->

# 工具
本文以[PDMan](http://www.pdman.cn/)为数据库模型设计工具。其他工具可适当参考。

# 命名
* 表格应按业务域进行归类。字典及系统通用（例如用户）则分别放在“字典”与“系统通用”类别中。
* 命名统一用小写字母。
* “数据域”一栏的“数据类型”中，将名称和代码统一改成实际类型，例如`VARCHAR(32)`，并采用大写字母，方便不同成员合并。团队所有人可直接复制粘贴附录中的代码。
* 数据表命名
    * 模块名采用`B-SYS-系统基础`格式
    * 中文表名采用`01-用户信息`格式（因为已经有分组，名称太长的话会影响展示）
    * 英文表名`t_dynamic_xxx`，长度不要超过25（在oracle标识符不能超过30，考虑到主键前缀`pk_`，表名就不能卡着30起了）
    * 显示方式`{name}[{code}]`（正好跟默认值颠倒，以方便浏览）
    * 英文单词使用名词、单数

# 字段
* 系统默认字段按以下设置：
    * 版本，`version`，`INT`，非空，默认值0
    * 创建人，`created_by`，`INT`，非空，无默认值
    * 创建时间，`created_at`，`TIMESTAMP`，非空，默认值`CURRENT_TIMESTAMP`
    * 更新人，`updated_by`，`INT`，非空，无默认值
    * 更新时间，`updated_at`，`TIMESTAMP`，非空，默认值`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
* 字段信息
    * 名称长度不超过25
    * 字段尽量非空，并尽量指定默认值
    * `VARCHAR`、`CHAR`必须非空，如需可空，说明中要明确体现`可空`二字
    * 只允许使用以下数据类型：
        * CHAR
        * VARCHAR，长度从10、20、32、50、64、255、512、1024里面取。
        * TINYINT
        * INT
        * BIGINT
        * DATETIME
        * DECIMAL（必须指定长度，建议默认取`DECIMAL(10,2)`）
        * BLOB、TEXT（应避免使用）
    * 禁止使用FLOAT、DOUBLE
* 字段的说明
    * 字段名的含义不能一望而知时，必须在说明进行解释。
    * 标志项必须指明取值，例如`0-否，1-是`，或者`参见GB/T 2260-2007`。
    * 数据使用分隔符分隔（例如`1,2,4`）、JSON串等非标准数据，必须在说明中解释。
    * 取值有国家标准、行业标准的，应优先采用国家标准及行业标准。实在搜不到再自创值域。

# 其他
* 必须设置索引，除非没有任何需要建索引的字段。另外主键自带索引，因此不要再给主键建立索引。
* 除表结构外，每个模块中应绘制关系图。

# 附录：统一数据类型
```json
{"database":[],"datatype":[{"name":"VARCHAR(32)","code":"VARCHAR(32)","apply":{"JAVA":{"type":"String"},"MYSQL":{"type":"VARCHAR(32)"},"ORACLE":{"type":"NVARCHAR2(32)"},"SQLServer":{"type":"NVARCHAR(32)"},"PostgreSQL":{"type":"VARCHAR(32)"}}},{"name":"VARCHAR(64)","code":"VARCHAR(64)","apply":{"MYSQL":{"type":"VARCHAR(64)"},"ORACLE":{"type":"VARCHAR2(64)"},"JAVA":{"type":"String"},"SQLServer":{"type":"VARCHAR(64)"},"PostgreSQL":{"type":"VARCHAR(64)"}}},{"name":"VARCHAR(128)","code":"VARCHAR(128)","apply":{"JAVA":{"type":"String"},"MYSQL":{"type":"VARCHAR(128)"},"ORACLE":{"type":"NVARCHAR2(128)"},"SQLServer":{"type":"NVARCHAR(128)"},"PostgreSQL":{"type":"VARCHAR(128)"}}},{"name":"VARCHAR(255)","code":"VARCHAR(255)","apply":{"JAVA":{"type":"String"},"MYSQL":{"type":"VARCHAR(255)"},"ORACLE":{"type":"NVARCHAR2(255)"},"SQLServer":{"type":"NVARCHAR(255)"},"PostgreSQL":{"type":"VARCHAR(255)"}}},{"name":"VARCHAR(512)","code":"VARCHAR(512)","apply":{"JAVA":{"type":"String"},"MYSQL":{"type":"VARCHAR(512)"},"ORACLE":{"type":"NVARCHAR2(512)"},"SQLServer":{"type":"NVARCHAR(512)"},"PostgreSQL":{"type":"VARCHAR(512)"}}},{"name":"VARCHAR(1024)","code":"VARCHAR(1024)","apply":{"JAVA":{"type":"String"},"MYSQL":{"type":"VARCHAR(1024)"},"ORACLE":{"type":"NVARCHAR2(1024)"},"SQLServer":{"type":"NVARCHAR(1024)"},"PostgreSQL":{"type":"VARCHAR(1024)"}}},{"name":"VARCHAR(3072)","code":"VARCHAR(3072)","apply":{"JAVA":{"type":"String"},"ORACLE":{"type":"NVARCHAR2(3072)"},"MYSQL":{"type":"VARCHAR(3072)"},"SQLServer":{"type":"NVARCHAR(3072)"},"PostgreSQL":{"type":"VARCHAR(3072)"}}},{"name":"TEXT","code":"TEXT","apply":{"JAVA":{"type":"String"},"MYSQL":{"type":"TEXT"},"ORACLE":{"type":"CLOB"},"SQLServer":{"type":"NTEXT"},"PostgreSQL":{"type":"TEXT"}}},{"name":"DECIMAL(32,10)","code":"DECIMAL(32,10)","apply":{"JAVA":{"type":"Double"},"MYSQL":{"type":"DECIMAL(32,10)"},"ORACLE":{"type":"NUMBER(12,10)"},"SQLServer":{"type":"DECIMAL(32,10)"},"PostgreSQL":{"type":"DECIMAL(32,10)"}}},{"name":"DECIMAL(32,8)","code":"DECIMAL(32,8)","apply":{"JAVA":{"type":"Double"},"MYSQL":{"type":"DECIMAL(32,8)"},"ORACLE":{"type":"NUMBER(24,8)"},"SQLServer":{"type":"DECIMAL(32,8)"},"PostgreSQL":{"type":"DECIMAL(32,8)"}}},{"name":"DECIMAL(10,2)","code":"DECIMAL(10,2)","apply":{"JAVA":{"type":"Double"},"MYSQL":{"type":"DECIMAL(10,2)"},"ORACLE":{"type":"NUMBER(8,2)"},"SQLServer":{"type":"DECIMAL(10,2)"},"PostgreSQL":{"type":"DECIMAL(10,2)"}}},{"name":"DECIMAL(4,2)","code":"DECIMAL(4,2)","apply":{"MYSQL":{"type":"DECIMAL(4,2)"},"JAVA":{"type":"Double"},"ORACLE":{"type":"NUMBER(2,2)"},"SQLServer":{"type":"DECIMAL(4,2)"},"PostgreSQL":{"type":"DECIMAL(4,2)"}}},{"name":"TINYINT","code":"TINYINT","apply":{"MYSQL":{"type":"TINYINT"},"ORACLE":{"type":"INT"},"JAVA":{"type":"Integer"},"SQLServer":{"type":"INT"},"PostgreSQL":{"type":"INT"}}},{"name":"INT","code":"INT","apply":{"JAVA":{"type":"Integer"},"MYSQL":{"type":"INT"},"ORACLE":{"type":"INT"},"SQLServer":{"type":"INT"},"PostgreSQL":{"type":"INT"}}},{"name":"BIGINT","code":"BIGINT","apply":{"MYSQL":{"type":"BIGINT"},"JAVA":{"type":"Long"},"ORACLE":{"type":"NUMBER"},"SQLServer":{"type":"BIGINT"},"PostgreSQL":{"type":"BIGINT"}}},{"name":"DATETIME","code":"DATETIME","apply":{"JAVA":{"type":"Date"},"MYSQL":{"type":"DATETIME"},"ORACLE":{"type":"DATE"},"SQLServer":{"type":"DATE"},"PostgreSQL":{"type":"DATE"}}},{"name":"CHAR(1)","code":"CHAR(1)","apply":{"MYSQL":{"type":"CHAR(1)"},"ORACLE":{"type":"CHAR(1)"},"JAVA":{"type":"String"},"SQLServer":{"type":"CHAR(1)"},"PostgreSQL":{"type":"CHAR(1)"}}}]}
```

# 本系列文章
* [MySQL数据库设计规范（一）：表结构设计](/2020/11/01/db-specification/)
* [MySQL数据库设计规范（二）：SQL语句](/2020/11/07/db-specification-2/)
* **MySQL数据库设计规范（三）：PDM文档**
