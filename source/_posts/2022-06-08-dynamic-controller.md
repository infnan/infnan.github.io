---
layout: post
title: 基于Spring Boot和若依框架实现可灵活配置的动态接口
category: 教程
tags:
- Spring Boot
- 接口
- 数据库
---
很多业务都是以增删改查为基础，利用若依框架，已经能够实现代码的快速生成，但需要在后端部署一些VO、Controller和Service，如需维护，依然要修改多个文件，而且要升级和重启后端系统。

如果业务只是简单的SQL或脚本，我们能否进一步简化，实现接口动态维护，不停机就能快速配置好系统接口呢？

<!-- more -->

# 说明

如在生产系统中使用，可直接使用更为成熟的产品，例如[magic-api](https://www.ssssssss.org/)（[在线预览](https://magic-api.ssssssss.org.cn/magic/web/index.html)）。

# 功能设计

系统主要实现以下功能：

1. 接口管理：向开发者提供接口信息管理功能，能够创建和维护接口，动态管理接口名称、接口URL、接口类型、输入参数、代码等信息。当接口数量较多时，可通过整理分组来保持可维护性。
2. 接口调用：在接口管理功能设置好接口后，开发者无需重启后端应用，即可调用相应接口。调用时，系统后台对调用者身份和权限进行校验，校验通过后执行相应代码，返回运行结果。

接口支持以下技术特性：

1. 快速配置，保存即更新，无需停机维护。
2. 可根据需要设置或更改接口URL。
3. 可设置或限制接口的访问方式，如GET、POST。
4. 支持提供输入参数，并支持通过URL、JSON、form等多种方式传入参数。
5. 支持SQL和JavaScript（要求Java版本小于15）两种类型的代码。SQL支持MyBatis的动态标签，JavaScript可获取Spring对象。
6. 支持授权和权限验证。
7. 支持切换数据源。

# 数据库设计

设计两张表，一个为接口内容（interface_item），存储所有接口的代码；另一个为接口分组（interface_group），便于归类管理所有接口。

```sql
CREATE TABLE interface_item
(
    id          BIGINT AUTO_INCREMENT COMMENT '主键'
        PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL COMMENT '名称',
    code        VARCHAR(255)  NOT NULL COMMENT '接口名',
    type        TINYINT       NOT NULL COMMENT '类型，1-sql，2-js',
    description TEXT          NULL COMMENT '描述',
    method      VARCHAR(255)  NOT NULL DEFAULT 'GET' COMMENT '请求方式,GET/POST',
    group_id    BIGINT        NULL COMMENT '分组',
    group_code  VARCHAR(255)  NULL COMMENT '分组',
    datasource  VARCHAR(255)  NULL COMMENT '数据源',
    is_enable   TINYINT       NOT NULL DEFAULT 1 COMMENT '是否启用',
    is_log      TINYINT       NOT NULL DEFAULT 0 COMMENT '是否记录调用日志',
    permission  VARCHAR(255)  NULL COMMENT '权限标识,*表示免登录',
    param       VARCHAR(1000) NULL COMMENT '输入参数',
    program        TEXT       NULL COMMENT '代码内容',
    create_by   VARCHAR(255)  NULL COMMENT '创建人',
    create_time DATETIME      NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by   VARCHAR(255)  NULL COMMENT '更新人',
    update_time DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT '接口项目';

CREATE TABLE interface_group
(
    id          BIGINT AUTO_INCREMENT COMMENT '主键'
        PRIMARY KEY,
    name        VARCHAR(255)                       NOT NULL COMMENT '名称',
    code        VARCHAR(255)                       NOT NULL COMMENT 'url',
    icon        VARCHAR(255)                       NULL COMMENT '图标',
    description VARCHAR(255)                       NULL COMMENT '描述',
    parent_id   BIGINT                             NULL COMMENT '上级节点id',
    create_by   VARCHAR(255)                       NULL COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP NULL COMMENT '创建时间',
    update_by   VARCHAR(255)                       NULL COMMENT '更新人',
    update_time DATETIME                           NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT '接口分组';
```

设计完成后，可使用平台的“代码生成”功能生成相应的VO、Vue等文件，并将菜单权限导入到数据库中。

# 核心代码

以若依的[前后分离版本](https://gitee.com/y_project/RuoYi-Vue)为例来实现这个功能。下面介绍核心部分代码，完整代码参见[GitHub](https://github.com/infnan/dynamic-controller-demo)。

## 解析动态SQL

利用MyBatis的相应方法，可解析MyBatis标签：

```java
// 将SQL中的绑定参数传入到该paramMap中
Map<String, Object> paramMap;

// 解析SQL
SqlSource sqlSource = sqlSessionTemplate.getConfiguration().getLanguageDriver(XMLLanguageDriver.class).createSqlSource(sqlSessionTemplate.getConfiguration(), rawSql, Map.class);
BoundSql boundSql = sqlSource.getBoundSql(paramMap);
String parsedSql = boundSql.getSql();

// SQL语句解析完成
ptst = conn.prepareStatement(parsedSql);

// 传入参数
List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();

if (parameterMappings != null) {
    for (int i = 0; i < parameterMappings.size(); i++) {
        ParameterMapping parameterMapping = parameterMappings.get(i);
        if (parameterMapping.getMode() != ParameterMode.OUT) {
            String propertyName = parameterMapping.getProperty();
            Object value = paramMap.get(propertyName);

            TypeHandler typeHandler = parameterMapping.getTypeHandler();
            JdbcType jdbcType = parameterMapping.getJdbcType();
            if (value == null && jdbcType == null) {
                jdbcType = sqlSessionTemplate.getConfiguration().getJdbcTypeForNull();
            }
            typeHandler.setParameter(ptst, i + 1, value, jdbcType);
        }
    }
}

// 准备完成，执行SQL
ResultSet result = ptst.executeQuery();

// ...
```

## 获取SQL执行结果中的字段名

ResultSet中有一个getMetaData函数，通过该函数可获取到查询结果中的各字段名：

```java
ResultSet result = ptst.executeQuery();
ResultSetMetaData md = result.getMetaData();
int columnCount = md.getColumnCount();
while (result.next()) {
    Map<String, Object> rowData = new HashMap<>();
    for (int i = 1; i <= columnCount; i++) {
        // 获取字段名称和结果
        rowData.put(md.getColumnLabel(i), result.getObject(i));
    }
    list.add(rowData);
}
```

## 动态运行JavaScript代码

Java自带一个名为Nashorn的JavaScript引擎（备注：从Java 15开始已经移除），可通过以下代码运行：

```java
String code;                        // 代码
Map<String, Object> paramMap;       // 用户传入的参数

// ...

ScriptEngine engine = new ScriptEngineManager().getEngineByName("JavaScript");

// 将一些Java对象传入到JS引擎中，以便在JS代码内直接调用
engine.put("xxx", xxxObj);
// ...

// 将代码封装至 Main 函数中，在JS代码中可通过 paramMap 获取参数。
code = "load(\"nashorn:mozilla_compat.js\"); function Main(paramMap) {\n" + code + "\n}";

// 编译并运行脚本
CompiledScript script = ((Compilable) engine).compile(code);
script.eval();

Invocable inv2 = (Invocable) engine;
try {
    // 调用函数并传入参数
    return inv2.invokeFunction("Main", paramMap);
} catch (NoSuchMethodException e) {
    throw new ScriptException(e);
}
```

## 身份和权限校验

若依已经将身份和权限校验封装为两个Service，引用即可：

```java
// 定义部分
@Resource
private TokenService tokenService;

@Resource
private PermissionService ss;

// ...

// 校验是否登录
HttpServletRequest request = ServletUtils.getRequest();
LoginUser user = tokenService.getLoginUser(request);
if (user != null) {
    // 设置为当前用户
    tokenService.setLoginUser(user);
} else {
    return new ServiceException("认证失败", HttpStatus.UNAUTHORIZED);
}

// 接口限制权限
if (StringUtils.isNotEmpty(permission)) {
    // 进行校验
    boolean hasPermission = ss.hasPermi(permission);
    if (!hasPermission) {
        return new ServiceException("无访问权限", HttpStatus.FORBIDDEN);
    }
}

// 未抛出异常则校验成功
```

## 支持多种请求方式

很简单，在Controller中把各种请求方式都写上即可。如果限定了请求方式，可以在调用invoke之后再进行校验：

```java
@GetMapping("/{code}")
@ResponseBody
public AjaxResult processGet(@PathVariable("code") String code, @RequestParam Map<String, Object> paramMap) {
    // GET方式
    return invoke("", "", code, paramMap, "GET");
}

@PostMapping(value = "/{code}",
        consumes = {MediaType.APPLICATION_JSON_VALUE},
        produces = {MediaType.APPLICATION_JSON_VALUE})
@ResponseBody
public AjaxResult processPost(@PathVariable("code") String code, @RequestBody JSONObject body) {
    // POST json
    Map<String, Object> params = new HashMap<>();
    for (String key : body.keySet()) {
        params.put(key, body.get(key));
    }
    return invoke("", "", code, params, "POST+json");
}

@PostMapping(value = "/{code}",
        consumes = {MediaType.APPLICATION_FORM_URLENCODED_VALUE},
        produces = {MediaType.APPLICATION_JSON_VALUE})
@ResponseBody
public AjaxResult processPost(@PathVariable("code") String code, @RequestParam Map<String, Object> params) {
    // POST x-www-form-urlencoded
    return invoke("", "", code, params, "POST+form");
}

// ...

private AjaxResult invoke(String group, String subgroup, String code, Map<String, Object> params, String method) {
    Object result = interfaceService.invokeInterface(group, subgroup, code, params, method);
    return success(result);
}
```

## 切换数据源

一句话：

```java
// 数据源名称参见 application.yaml 配置
DynamicDataSourceContextHolder.push("数据源名称");
```

## JavaScript工具类

为使JavaScript代码能够操作数据库或其他目标，需将常用函数封装到一个工具类中，并暴露给JavaScript运行环境。具体代码参见[InterfaceUtilImpl](https://github.com/infnan/dynamic-controller-demo/blob/master/ruoyi-system/src/main/java/com/ruoyi/system/service/impl/InterfaceUtilImpl.java)。

# 使用说明

## 接口设置

接口设置界面如下：

![接口列表](/img/2022-06-08-dynamic-controller/1.png)

当接口数量较多时，为便于维护，可先设置分组，将不同业务的接口组织到不同分组中。

选择分组，点击添加按钮，录入接口信息：

![接口信息](/img/2022-06-08-dynamic-controller/2.png)

主要参数说明：

* 接口分组、接口代号：决定接口的URL
* 请求方式：限制GET、POST（JSON格式）、POST（x-www-form-urlencoded），或不限制请求方式
* 输入参数：如接口需要输入参数，可在此处设置。例如输入参数为`name,id`，那么前端调用时需要传入name和id两个参数，在SQL中则需要通过`#{name}`和`#{id}`进行引用。
* 权限标识：校验接口调用者是否具有权限，即“菜单管理”中的权限标志。`*`表示无需token，留空表示需要验证Token但不限制权限。
* 数据源：即`application.yaml`中配置的数据源。

系统提供测试功能，方便开发人员调试接口。接口的返回值为JSON，以便前端使用，具体格式类似：

```json
{
    "msg": "操作成功",
    "code": 200,
    "data": [
        {
            "id": 1,
            "name": "test"
        }
    ]
}
```

## SQL配置

像MyBatis一样配置即可。纯SQL可直接输入，带逻辑的SQL则需要用`<script>`包围，例如：

```sql
<script>
SELECT * FROM table WHERE 1=1
<if test='name != ""'>
AND name LIKE CONCAT(#{name}, '%')
</if>
</script>
```

## JavaScript配置

Nashorn引擎支持ES5的大部分特性，可通过ES5语法编程。其代码差异之处，以及Java代码调用方法，可参见[Oracle手册](https://docs.oracle.com/en/java/javase/14/scripting/index.html)。

Java的包和类可用JS代码直接导入并调用，例如：

```javascript
// 导入包
importPackage(com.xxx.service);
// 导入类
importClass(com.xxx.service.TabService);
var serv = new TabService();
// 导入后，可以像Java一样new实例，或者在JS环境中调用Java方法与函数
```

在本系统中，可通过`paramMap`获取用户的请求参数，通过`AppUtil`来调用Java函数，例如：

```javascript
// 获取请求参数
var name = paramMap.name || '未命名';

// 执行SQL
var list = AppUtil.executeQuery('select * from sys_user');
AppUtil.executeSql('update tab set name = ? where id = ?', name, id);

// 获取Spring Bean并调用
var tabService = AppUtil.getBean('tabService');
var list = tabService.getList();
```

# 进一步思考

由于接口配置功能可以输入任意代码，因此当然不能向一般用户开放，否则系统会被恶意代码损毁。

输入参数往往是由用户提供的，因此应当假定每个输入参数都带有恶意，例如SQL注入、超出长度范围、超出权限范围（例如将URL中的`?id=3`改为`?id=4`）等等，。SQL或JavaScript代码也应注意限制执行时间和查询结果数量，以免数据溢出或造成阻塞。

动态的接口维护功能主要目的是便利开发人员，降低维护成本，但是本代码缺少对高并发的优化，因此不建议在高并发情况下使用。

# TODO

1. 查阅接口调用日志
2. Swagger接口文档
3. Kotlin语言支持
4. [ES6支持](/2023/05/10/javet)
