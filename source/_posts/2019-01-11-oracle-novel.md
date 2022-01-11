---
layout: post
title: 通过数据库“阅读器”在上班时间看小说
category: 工作日记
tags:
- Oracle
- MySQL
- Cheatsheet
---
上班时间看小说有很多种方式，例如直接拿手机看，在浏览器上面看，用小说阅读器看，拷到Word里面看，甚至拷到Eclipse里面看……然而，这几种方式看起来都比较显眼，就算放在Eclipse上面看起来也不太自然（方块字又多又密，而且没有语法高亮，一看就不像程序代码）。在此，本文针对软件开发和运维人员介绍一种可以大大方方在上班时间看小说而且不会引起怀疑的方法——在数据库客户端里面看小说。

<!-- more -->

# 建库
如果开发团队管得不严，那么使用团队正在使用的数据库就行，反正领导和人力部门又不可能专门登数据库去看你搞了什么东西。为了避免与其他同事产生误会，建议创建小说专用账号，例如OGGFORWARD（用这个名词也要小心，别让DBA误会）：

Oracle范例：
```sql
-- 建立OGG传输专用账号
CREATE USER OGGFORWARD IDENTIFIED BY eromanga;
-- 允许登录OGG账号
GRANT CONNECT, RESOURCE, DBA TO OGGFORWARD;
-- 允许OGG账户访问当前账户所用表
BEGIN
    FOR TAB IN (SELECT TABLE_NAME FROM USER_TABLES) LOOP
        EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON '||TAB.TABLE_NAME||' TO OGGFORWARD';
    END LOOP;
END;
```

MySQL范例：
```sql
-- 建立数据库
CREATE DATABASE oggforward DEFAULT CHARSET utf8;
-- 建立OGG传输专用账号
CREATE USER oggforward@'%' IDENTIFIED BY 'eromanga';
-- 赋权
GRANT ALL PRIVILEGES ON oggforward.* TO oggforward@'%';
```

以上只是些普通的DBA操作，看起来没什么值得怀疑的。若你连DBA权限都没有，那么就需要自己搭数据库或者想办法骗DBA给你开个账号了。

接下来用OGGFORWARD登录，建立表结构：

Oracle范例：
```sql
-- 《情色漫畫老師》（中国大陆译作《埃罗芒阿老师》）
CREATE SEQUENCE OGGFORWARD.SEQ_TBL_EROMANGA START WITH 1 INCREMENT BY 1 NOMAXVALUE;
CREATE TABLE OGGFORWARD.TBL_EROMANGA (
    ID NUMBER NOT NULL        -- 主键
        CONSTRAINT PK_TBL_EROMANGA PRIMARY KEY,
    BOOK VARCHAR2(100) NOT NULL,    -- 第几作
    CHAPTER VARCHAR2(50),           -- 章节
    TEXT VARCHAR2(700),             -- 小说内容，为便于阅读，每行只留200字
    IS_READ CHAR(1) DEFAULT '0',    -- 是否已经阅读
    ACCESS_TIME DATE                -- 阅读时间
);
```

MySQL范例：
<!-- tab MySQL -->
```sql
-- 《情色漫畫老師》（中国大陆译作《埃罗芒阿老师》）
CREATE TABLE IF NOT EXISTS oggforward.tbl_eromanga (
    id INT NOT NULL AUTO_INCREMENT,     -- 主键
    book VARCHAR(100) NOT NULL,         -- 第几作
    chapter VARCHAR(50),                -- 章节
    text VARCHAR(700),                  -- 小说内容，为便于阅读，每行只留200字
    is_read CHAR(1) DEFAULT '0',        -- 是否已经阅读
    access_time DATE,                   -- 阅读时间
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

毕竟是你自己看的，怎么建都无所谓，但是应该要有ID（便于定位和排序），要区分出是哪本小说，另外也可以加一些伪装用的字段，显得像是在操作自己项目中的表一样。

# 导入小说
这一点比较关键，你需要先将小说下载下来，弄成TXT格式，然后编写一个导入程序，将其导入到数据库中。导入的时候需要注意字段长度和断行。建议在程序里面适当断行，不要一段话一口气写到底，这样查询的时候看起来方便。

注意文件字符编码！下面程序默认文件采用GB2312/GBK编码。如果为UTF-8，需在命令行中手动传入编码。

## Java程序
ImportUtils.java：

Oracle版本：
```java
import java.io.File;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Scanner;

/**
 * 文本导入工具
 */
public class ImportUtils {
    private final static String DB_CONNSTR = "jdbc:oracle:thin:@数据库IP地址:1521:数据库实例名";
    private final static String DB_USERNAME = "OGGFORWARD";
    private final static String DB_PASSWORD = "eromanga";
    private final static String INSERT_SQL = "INSERT INTO TBL_EROMANGA (ID, BOOK, CHAPTER, TEXT) VALUES (SEQ_TBL_EROMANGA.NEXTVAL, ?, ?, ?)";
    private final static String QUERY_SQL = "SELECT COUNT(1) FROM TBL_EROMANGA WHERE BOOK=? AND CHAPTER=?";

    // 是否移除两段文字之间多出来的一个空行
    private final static boolean REMOVE_EXTRA_BLANK_LINE = false;
    // 每条记录最大字数
    private final static int LINE_WIDTH = 70;

    public static void main(String[] args) {
        // 加载Oracle驱动
        try {
            Class.forName("oracle.jdbc.OracleDriver");
        } catch (ClassNotFoundException e) {
            System.err.println("错误：未找到ojdbc.jar！");
            return;
        }

        // 获取参数
        if (args.length < 3) {
            System.err.println("java ImportUtils <BOOK> <CHAPTER> <FILENAME> [UTF-8]");
            return;
        }

        String book = args[0];
        String chapter = args[1];
        String fileName = args[2];
        String encoding = "GBK";
        if (args.length > 3) {
            encoding = args[3];
        }

        try (Connection conn = DriverManager.getConnection(DB_CONNSTR, DB_USERNAME, DB_PASSWORD)) {
            // 可选 - 检查是否重复导入
            try (PreparedStatement stmt = conn.prepareStatement(QUERY_SQL)) {
                stmt.setString(1, book);
                stmt.setString(2, chapter);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        int len = rs.getInt(1);
                        if (len > 0) {
                            System.out.println("您似乎已经导入过了，是否继续（Y/N）？");
                            Scanner cin = new Scanner(System.in);
                            String read = cin.nextLine();
                            if (!"Y".equals(read.toUpperCase().trim())) {
                                return;
                            }
                        }
                    }
                }
            }

            conn.setAutoCommit(false);
            try (Scanner scanner = new Scanner(new File(fileName), encoding);
                 PreparedStatement stmt = conn.prepareStatement(INSERT_SQL)) {
                boolean isLastEmptyLine = false;
                while (scanner.hasNextLine()) {
                    String line = scanner.nextLine();

                    if (REMOVE_EXTRA_BLANK_LINE && line.trim().length() == 0 && !isLastEmptyLine) {
                        isLastEmptyLine = true;
                        continue;
                    }
                    isLastEmptyLine = (line.length() == 0);

                    // 按长度分割并插入数据库
                    for (int i = 0; i < line.length(); i += LINE_WIDTH) {
                        String part = line.substring(i, Math.min(i + LINE_WIDTH, line.length()));
                        stmt.setString(1, book);
                        stmt.setString(2, chapter);
                        stmt.setString(3, part);
                        stmt.addBatch();
                    }
                }

                stmt.executeBatch();
            } catch (SQLException | IOException e) {
                conn.rollback();
                conn.setAutoCommit(true);
                throw e;
            }
            conn.commit();
            conn.setAutoCommit(true);
            System.out.println("导入完成！");
        } catch (SQLException | IOException e) {
            System.err.println("导入时发生错误！");
            e.printStackTrace(System.err);
        }
    }
}
```

MySQL版本：
```java
import java.io.File;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Scanner;

/**
 * 文本导入工具
 */
public class ImportUtils {
    private final static String DB_CONNSTR = "jdbc:mysql://数据库IP地址:3306/oggforward";
    private final static String DB_USERNAME = "oggforward";
    private final static String DB_PASSWORD = "eromanga";
    private final static String INSERT_SQL = "INSERT INTO tbl_eromanga (book, chapter, text) VALUES (?, ?, ?)";
    private final static String QUERY_SQL = "SELECT count(1) FROM tbl_eromanga WHERE book=? AND chapter=?";

    // 是否移除两段文字之间多出来的一个空行
    private final static boolean REMOVE_EXTRA_BLANK_LINE = false;
    // 每条记录最大字数
    private final static int LINE_WIDTH = 70;

    public static void main(String[] args) {
        // 加载Oracle驱动
        try {
            Class.forName("com.mysql.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            System.err.println("错误：未找到mysql-connector-java.jar！");
            return;
        }

        // 获取参数
        if (args.length < 3) {
            System.err.println("java ImportUtils <BOOK> <CHAPTER> <FILENAME> [UTF-8]");
            return;
        }

        String book = args[0];
        String chapter = args[1];
        String fileName = args[2];
        String encoding = "GBK";
        if (args.length > 3) {
            encoding = args[3];
        }

        try (Connection conn = DriverManager.getConnection(DB_CONNSTR, DB_USERNAME, DB_PASSWORD)) {
            // 可选 - 检查是否重复导入
            try (PreparedStatement stmt = conn.prepareStatement(QUERY_SQL)) {
                stmt.setString(1, book);
                stmt.setString(2, chapter);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        int len = rs.getInt(1);
                        if (len > 0) {
                            System.out.println("您似乎已经导入过了，是否继续（Y/N）？");
                            Scanner cin = new Scanner(System.in);
                            String read = cin.nextLine();
                            if (!"Y".equals(read.toUpperCase().trim())) {
                                return;
                            }
                        }
                    }
                }
            }

            conn.setAutoCommit(false);
            try (Scanner scanner = new Scanner(new File(fileName), encoding);
                 PreparedStatement stmt = conn.prepareStatement(INSERT_SQL)) {
                boolean isLastEmptyLine = false;
                while (scanner.hasNextLine()) {
                    String line = scanner.nextLine();

                    if (REMOVE_EXTRA_BLANK_LINE && line.trim().length() == 0 && !isLastEmptyLine) {
                        isLastEmptyLine = true;
                        continue;
                    }
                    isLastEmptyLine = (line.length() == 0);

                    // 按长度分割并插入数据库
                    for (int i = 0; i < line.length(); i += LINE_WIDTH) {
                        String part = line.substring(i, Math.min(i + LINE_WIDTH, line.length()));
                        stmt.setString(1, book);
                        stmt.setString(2, chapter);
                        stmt.setString(3, part);
                        stmt.addBatch();
                    }
                }

                stmt.executeBatch();
            } catch (SQLException | IOException e) {
                conn.rollback();
                conn.setAutoCommit(true);
                throw e;
            }
            conn.commit();
            conn.setAutoCommit(true);
            System.out.println("导入完成！");
        } catch (SQLException | IOException e) {
            System.err.println("导入时发生错误！");
            e.printStackTrace(System.err);
        }
    }
}
```

运行之前需要下载JDBC驱动（[Oracle](https://www.oracle.com/technetwork/database/application-development/jdbc/downloads/index.html)、[MySQL](https://dev.mysql.com/downloads/connector/j/8.0.html)）。如果不使用Eclipse或IDEA等IDE，可以用以下命令编译：

```bash
javac ImportUtils.java
```

为了方便阅读，我对小说按照章节进行了分割，文件名格式类似5_1.txt。预处理完成后运行（备注：这里是Linux/macOS）：

```bash
# Oracle
export CLASSPATH=.:ojdbc6.jar
# MySQL
export CLASSPATH=.:mysql-connector-java-8.0.13.jar

for i in `seq 1 5`; do
    java ImportUtils 5 1 5_$i.txt

    # UTF-8编码则需要
    # java ImportUtils 5 1 5_$i.txt UTF-8
done
```

## awk脚本（Linux服务器）
DBA们可能并没有在电脑上安装Java，不过没关系，我们也可以将小说上传到服务器上，通过下面的awk脚本生成SQL，然后通过sqlplus执行SQL，把将小说内容导入到数据库中：

gen_sql.awk：

Oracle版本：
```awk
BEGIN {
    INSERT_SQL = "INSERT INTO OGGFORWARD.TBL_EROMANGA (ID, BOOK, CHAPTER, TEXT) VALUES (SEQ_TBL_EROMANGA.NEXTVAL, '@1', '@2', '@3');";
    if (!LINE_WIDTH) {
        LINE_WIDTH = 70;
    }
    if (!BOOK) {
        exit 1;
    }

    print "SET AUTOCOMMIT OFF;";

    # 导入变量
    gsub(/@1/, BOOK, INSERT_SQL);
    gsub(/@2/, CHAPTER, INSERT_SQL);

    # awk会直接忽略空行
}

{
    gsub(/'/, "''");

    for (i=1; i<length; i+=LINE_WIDTH) {
        part = substr($0, i, LINE_WIDTH);
        line = INSERT_SQL;
        gsub(/@3/, part, line);
        print line;
    }
}

END {
    print "COMMIT;";
}
```

MySQL版本：
```awk
BEGIN {
    INSERT_SQL = "INSERT INTO oggforward.tbl_eromanga (book, chapter, text) VALUES ('@1', '@2', '@3');";
    if (!LINE_WIDTH) {
        LINE_WIDTH = 70;
    }
    if (!BOOK) {
        exit 1;
    }

    print "SET NAMES utf8;";
    print "BEGIN;";

    # 导入变量
    gsub(/@1/, BOOK, INSERT_SQL);
    gsub(/@2/, CHAPTER, INSERT_SQL);

    # awk会直接忽略空行
}

{
    gsub(/'/, "''");

    for (i=1; i<length; i+=LINE_WIDTH) {
        part = substr($0, i, LINE_WIDTH);
        line = INSERT_SQL;
        gsub(/@3/, part, line);
        print line;
    }
}

END {
    print "COMMIT;";
}
```

macOS系统需要注意，awk的length和substr无法正确识别中文；在Linux系统下面则需要正确设置LANG环境变量才能识别中文，例如在命令前面加`LANG=zh_CN.UTF-8`。

假如小说文件名是5_1.txt至5_5.txt，那么导入时可以：

```bash
for i in `seq 1 5`; do
    # Oracle
    awk -v BOOK=5 -v CHAPTER=$i -f gen_sql.awk 5_$i.txt | sqlplus oggforward/eromanga@你的数据库

    # MySQL
    awk -v BOOK=5 -v CHAPTER=$i -f gen_sql.awk 5_$i.txt | mysql -u oggforward -h 0.0.0.0 -peromanga
done
```

这里需要再次注意文件字符编码，如果txt编码、LANG、NLS_LANG（Oracle）与数据库（Oracle）/表（MySQL）编码四者不一致也会乱码！

假如txt文件是UTF-8，数据库是GBK，可以先用`iconv -f utf8 -t gbk -c 1.txt > 1_gbk.txt`对文件转码，然后`export LANG=zh_CN.GBK`设置awk编码。

另外也可以不改编码，管道到iconv：`awk ... | iconv -f utf8 -t gbk -c | sqlplus oggforward/eromanga`

## 如果连数据库也是Windows服务器
Windows系统自带VBScript，一样能生成SQL然后执行。不会写VBScript也没关系，把小说扔到Excel里面然后用公式拼接出SQL语句也行。

# 开始阅读
用你平常用的数据库工具登录，然后

Oracle：
```sql
-- 阅读
SELECT
    ID, BOOK, CHAPTER, TEXT, IS_READ, ACCESS_TIME 
FROM
    OGGFORWARD.TBL_EROMANGA E
WHERE E.BOOK = '1' AND E.CHAPTER = '1'    -- 例如：第1卷第一章
ORDER BY E.ID;
-- 阅读未看过的，加个WHERE条件IS_READ='0'
-- 标记已看过的部分
UPDATE OGGFORWARD.TBL_EROMANGA SET IS_READ='1', ACCESS_TIME=SYSDATE WHERE ID<你所看到的ID AND IS_READ='0';
```

MySQL：
```sql
-- 阅读
SELECT
    id, book, chapter, text, is_read, access_time 
FROM
    oggforward.tbl_eromanga e
WHERE e.book = '1' AND e.chapter = '1'    -- 例如：第1卷第一章
ORDER BY e.id;
-- 阅读未看过的，加个WHERE条件IS_READ='0'
-- 标记已看过的部分
UPDATE oggforward.tbl_eromanga SET is_read='1', access_time=sysdate() WHERE id<你所看到的ID AND is_read='0';
```

注意放一些有迷惑性的语句（相当于“老板键”），包装一下你的阅读器，例如：

```sql
-- Oracle

-- 查看锁表情况并生成解锁语句
SELECT
    b.owner,b.object_name,c.sid,c.serial#,a.locked_mode,c.username,c.osuser,c.machine,c.module,c.logon_time,
    'ALTER SYSTEM KILL SESSION '''||c.sid||','||c.serial#||''';' cmd,
    s.sql_text
FROM
    v$locked_object a,dba_objects b, v$session c, v$sql s
WHERE
    b.object_id = a.object_id AND a.session_id = c.sid AND s.address = c.PREV_SQL_ADDR AND s.hash_value = c.PREV_HASH_VALUE
ORDER BY c.logon_time;

-- 查看连接数
SELECT machine, status, count(1) FROM v$session GROUP BY machine, status ORDER BY count(1) DESC;

-- 查看表空间使用情况
SELECT
    a.tablespace_name,
    round(total_bytes / 1048576, 2) total_mb,
    round((total_bytes - free_bytes) / 1048576, 2) used_mb,
    round(free_bytes / 1048576, 2) free_mb,
    round((1 - free_bytes / total_bytes) * 100, 2) used_ratio
FROM
    (SELECT tablespace_name, sum(bytes) free_bytes FROM dba_free_space GROUP BY tablespace_name) a,
    (SELECT tablespace_name, sum(bytes) total_bytes FROM dba_data_files GROUP BY tablespace_name) b
WHERE a.tablespace_name = b.tablespace_name
ORDER BY a.tablespace_name;

-- 查看占资源的SQL
-- 最耗时的SQL
SELECT * FROM v$sqlstats ORDER BY elapsed_time DESC;
-- 执行次数最多的SQL
SELECT * FROM v$sqlstats ORDER BY executions DESC;
-- 读磁盘最多的SQL
SELECT * FROM v$sqlstats ORDER BY disk_reads DESC;
-- 耗CPU最多的SQL
SELECT * FROM v$sqlstats ORDER BY buffer_gets DESC;
```

如果在IDEA等环境操作数据库，可以再打开一些平日工作用的程序代码。

![看不出什么问题](/img/2019-01-11-oracle-novel/preview.png)

嗯，看不出什么问题（如果不看[插画](/img/2019-01-11-oracle-novel/eromanga.jpg)的话），而且领导来了也不怕，大大方方地继续执行附近SQL就行了——没准领导还会以为你热爱钻研数据库技术呢。

# 拓展
如果公司网络管的不严，而且自己电脑或数据库服务器能访问互联网，那么也可以继续拓展，通过Oracle或MySQL刷新闻、贴吧或微博之类的东西。
