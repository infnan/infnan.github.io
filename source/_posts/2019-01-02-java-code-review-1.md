---
layout: post
title: Java代码审查（一）：代码审查问题
category: 项目开发经验
tags: 
- Java
---
当然，由于不同项目用的东西大概会很不一样，所以本文仅供参考。
<!-- more -->

# 格式与美观问题
* 命名不规范：例如类名小写字母开头、函数名大写字母开头、拼音英语混写等。由于关于命名规范的资料很多，这里不再列出。
* 不加空白/空白太多：例如
    * 没有缩进、缩进混乱、Tab空格混用
    * if、while、for或运算符之类的没有空格
    * 一行代码后面留好几行空白
    * 不同业务逻辑之间没有空行或“华丽的分割线”
    以上虽然没有错误，但是不好看。
* 一行内容太长
* 代码字符编码或换行符不一致：建议新项目统一用UTF-8字符编码和Unix换行符。
* 变量、方法顺序混乱
* 表达式太复杂：
    ```java
    // 错误：?:优先级低，导致整个判断条件的逻辑不正确。应该将不同情况用括号包上，分行列举并用注释说明业务规则
    if (year >= nowYear - 5 && hasApplied || year >= nowYear - 10 && year < nowYear - 5 && !hasApplied || year >= hasApplied ? nowYear - 20 : nowYear - 15) {
        ...
    }

    // 修改成
    boolean isValidApply = ((year >= nowYear - 5) && hasApplied) ||         // 业务规则1
        ((year >= nowYear - 10) && (year < nowYear - 5) && !hasApplied) ||  // 业务规则2
        (year >= (hasApplied ? (nowYear - 20) : (nowYear - 15)));           // 业务规则3
    if (isValidApply) {
        ...
    }
    ```

* 使用魔法值（未定义的常量）：建议改用常数或枚举。
    ```java
    if ("4".equals(vo.getStatusFlag())) {   // 4是什么状态？
        ...
    }
    ```

# 字符串操作
* 使用==和!=比较字符串：在Java中==和!=比较的不是字符串内容，应该用equals方法。
    ```java
    // 错误
    if (str != "") {
        ...
    }

    // 修改之后
    if (!"".equals(str)) {
        ...
    }
    ```

* 空指针风险：字符串对象和常量比较时，应当把常量放前面，例如
    ```java
    // 错误
    if (str.equals("A")) {
        ...
    }

    // 正确：str为null时返回false，不会报错，也不需要另外去判断
    if ("A".equals(str)) {
        ...
    }
    ```

    * 接上条：判断是否为空串时，未判断是否为null。建议改用StringUtils.isEmpty或StringUtils.isNotEmpty。
        ```java
        // 应该是 str != null && !"".equals(str)
        if (!"".equals(str)) {

        }
        ```

* 使用equals比较StringBuffer、StringBuilder或Date的值：如果equals前后一个是String，另一个是StringBuffer等对象，那么返回结果一定是false：
    ```java
    StringBuilder sql = ...;
    Date date = ...;
    ...
    // 错误：前后类型不一致，结果肯定是false
    if ("".equals(sql)) { ... }
    if ("2019-01-01".equals(date)) { ... }

    // 修改之后
    if ("".equals(sql.toString())) { ... } // 或者 if (sql.length() == 0) { ... }
    if ("2019-01-01".equals(new SimpleDateFormat("YYYY-MM-DD").format(date))) { ... }
    // 或者 if ("2019-01-01".equals(DateFormatUtils.ISO_DATE_FORMAT.format(date))) { ... } 
    ```

* 在for、while循环里面用+=拼接字符串：使用+=拼接字符串的效率比较低，运行数百次就会和StringBuilder产生明显差别，应该用StringBuilder或StringBuffer（如果多线程的话）拼接字符串。
    ```java
    // 错误
    String output = "";
    for (...) {
        ...
        output += id + ": " + line + "\n";      // 直接拼接字符串效率较低
    }

    // 修改之后
    StringBuilder output = new StringBuilder();
    for (...) {
        ...
        output.append(id).append(": ").append(line).append("\n");
    }
    ```

* split之后用固定下标取值：
    ```java
    String[] arr = str.split(",");
    String val = arr[3];    // 错误：如果str中分隔符后面没有内容（例如a,,b,c,,），val的位置将不是3

    // 可以修改成
    String[] arr = str.split(",", -1);
    // 或者不再依赖位置
    ```

* split时未注意分隔符前后有空格：例如原始数据是`1, 2,3 , 4`。建议取值之后trim。
* 使用split、trim之前未判断是否为null：常见于从数据库获取值之后立即操作。
    ```java
    String remark = rs.getString("REMARK").trim();      // 错误：未判断REMARK是否为null
    ```

# 对象访问
* 在循环里面初始化对象：
    ```java
    for (ApplyFormPO applyForm: applyList) {
        Date now = new Date();      // 浪费资源
        ...
        applyForm.setOperating_time(now);
        ...
    }

    // 修改成
    Date now = new Date();
    for (ApplyFormPO applyForm: applyList) {
        ...
        applyForm.setOperating_time(now);
        ...
    }
    ```
    需要注意的是，并不是所有在循环里初始化对象的代码都有问题，例如下面代码就不能向上面那样改：
    ```java
    List<ApplyFormPO> applyList = new ArrayList<ApplyFormPO>();
    for (...) {
        ApplyFormPO applyForm = new ApplyFormPO();      // 这个不能放到for外面，因List里面保存的是对象引用
        ...
        applyList.add(applyForm);
    }
    ```

* 空指针：在DAO、List、Map等地方取值时未判断是否为null，例如
    ```java
    // 错误：未判断list的元素个数
    if (!"".equals(list.get(0).getStatus()) {
        ...
    }

    // 错误：未判断中间变量A和B是否为null
    if (obj.getA().getB().isC()) {
        ...
    }
    ```

* 包装类比较==或!=：
    ```java
    Integer i1 = ...;
    Integer i2 = ...;
    // 错误：下面比较的不是i1和i2的值
    if (i1 == i2) {
        ...
    }
    ```

    * 顺便提一下，float、double即使不是包装类也不能用==或!=比较，因为存在精度问题。

* 在for循环里添加或删除集合中的元素：
    ```java
    for (Item obj: itemList) {
        if ("d".equals(obj.getFlag()) {
            itemList.remove(obj);       // 错误：会破坏for循环
            continue;
        }
        ...
    }

    // 修改方法：使用Iterator操作删除，或者再创建一个List，将删除操作反映到新List中
    List<Item> newItemList = new ArrayList<Item>();
    for (Item obj: itemList) {
        if (!"d".equals(obj.getFlag()) {
            newItemList.add(obj);
        }
    }
    for (Item obj: newItemList) { // 后续操作使用newItemList，或者以 itemList = newItemList; 替换
        ...
    }
    ```

* static SimpleDateFormat：SimpleDateFormat不是线程安全的，其实例不应定义成静态变量。建议不再使用SimpleDateFormat，而是改用DateFormatUtils。

* 工具类未使用static定义，或者static方法仍然在new对象之后调用：
    ```java
    public class StringUtils {
        // 错误：应改成static
        public boolean isEmpty(String str) {
            return (str == null) || (str.length() == 0);
        }
    }

    ...
    StringUtils su = new StringUtils();     // 改成static之后无需再实例化，以免浪费资源
    if (su.isEmpty(str)) {
        ...
    }
    ```

# 异常处理
* 将异常用作流程控制：该用if-else进行判断的地方不要用try-catch，因为效率低以及语义不同。
* 在for或while中try-catch：同样消耗资源，建议将try块挪到循环外面。
* 捕获/抛出NullPointerException或IndexOutOfBoundsException等异常：空指针、索引越界等问题应当使用if判断来避免，而且此类问题有可能是业务层面问题，不应靠异常机制处理。
    ```java
    String result;
    try {
        if ("A".equals(poList.get(0).getFlag())) {
            result = "Y";
        } else {
            result = "N";
        }
    } catch (NullPointerException e) {          // 错误：应当避免使程序产生此类异常
        result = "E";
    } catch (IndexOutOfBoundsException e) {     // 错误：应当避免使程序产生此类异常
        result = "E";
    }

    // 修改成
    if (poList == null || poList.size() == 0) {
        result = "E";
    } else {
        if ("A".equals(poList.get(0).getFlag())) {
            result = "Y";
        } else {
            result = "N";
        }
    }
    ```

* 打印日志：
    * 发生异常却未向用户反馈，仍然提示“成功”：实际上已经出错了，应当提示出来。如果确定对用户没有影响，可以忽略，那么应当在注释中明确指出来。
    * 报错信息缺少用户能看懂的语言：应当先提示用户能看得懂的内容，给出大概的错误原因和处理方法。
        ```java
        try {
            ...
            setMessage("保存成功！", MessageLevel.SUCCESS);
        } catch (SQLException e) {
            setMessage(e.getMessage(), MessageLevel.ERROR); // 错误：用户看不懂Exception的内容
            logger.debug("保存过程中发生内部错误", e);
        }
        ```
    * 日志级别与实际情况不一致：例如用error输出调试内容、用debug输出错误信息。
        ```java
        try {
            ...
            setMessage("保存成功！", MessageLevel.SUCCESS);
        } catch (SQLException e) {
            setMessage("保存过程中发生内部错误：" + e.getMessage() + "！", MessageLevel.ERROR);
            logger.debug("保存过程中发生内部错误", e);      // 错误：应该是error
        }
        ```
        如果系统在上线一段时间之后已经比较稳定，建议提高日志级别，以节约服务器空间和I/O资源消耗。
    * 屏幕提示和日志记录不一致：
        ```java
        try {
            ...
            setMessage("保存成功！", MessageLevel.SUCCESS);
        } catch (SQLException e) {
            setMessage("保存过程中发生内部错误：" + e.getMessage() + "！", MessageLevel.ERROR);
            logger.error("查询工作单信息出错", e);      // 错误：与屏幕提示不一致，找日志时会产生困扰
        }
        ```

* 捕获异常但未做任何处理：一旦出现异常，开发人员将无法进行诊断。
    ```java
    try {
        ...
    } catch (Exception e) {
        e.printStackTrace();        // 应向用户反馈（最外层）或向上抛（不是最外层的话）
    }
    ```

* 重复捕获异常：在业务层捕获异常，使得业务调用者无法得知异常，也无法向用户提供反馈。
    ```java
    // 业务逻辑
    public class BusinessBO {
        ...

        public static ApplyPO getApplyInfo(String applyId) {
            try {
                ...     // 业务逻辑
            } catch (SQLException e) {
                logger.error("查询时发生异常", e);
                // 错误：业务层的异常未往上抛，这样即使发生异常用户也无法收到反馈
            }
        }
    }
    ```

    ```java
    // 业务调用者
    @Controller()
    public class BusinessController {
        ...

        @GetMapping("/apply/{id}")
        public String getApplyInfo(...) {
            try {
                ApplyPO applypo = BusinessBO.getApplyInfo(id);
                ...
            } catch (Exception e) {
                // 虽然使用Exception不会产生编译错误，但是这里根本捕捉不到异常
                ...
            }
        }
    }
    ```

* 在Web请求层（SpringMVC的Controller、Struts的Action）或WebService服务上面抛出异常：服务调用者无法捕获服务抛出的异常，顶多能够得知服务返回了500状态码（然而这样是不对的）。应该由双方约定错误信息格式，将抛出异常改成返回错误码。
    ```java
    @WebService(endpointInterface = "com.company.BusinessService")
    public class BusinessService implements IBusinessService {
        ...

        // 错误示例 - Service不能抛出异常
        public String doJob() throws SQLException {
            ...
        }

        // 正确示例 - 返回错误码，使调用者得知接口通了，但是结果异常
        public String doJob() {
            String result = "";
            try {
                ...
                result = "{\"result\": \"SUCCESS\", \"info\": \"操作成功\"}";
            } catch (SQLException e) {
                ...
                result = "{\"result\": \"E01\", \"info\": \"操作失败，数据库异常\"}";
            }
            return result;
        }
    }
    ```

# 数据库操作
* 未关闭资源：未关闭ResultSet、PrepareStatement、Connection或者各种（不一定是数据库的）流。
    ```java
    Connection conn = ...;
    PreparedStatement stmt = null;
    ResultSet rs = null;
    // 错误：未关闭资源
    try {
        stmt = conn.prepareStatement("...");
        rs = stmt.executeQuery();
        while (rs.next()) {
            ...
        }
    } catch (SQLException e) {
        ...
    }

    // 应在finally中释放资源
    try {
        stmt = ...
        ...
    } catch (SQLException e) {
        ...
    } finally {
        try {
            if (rs != null) { rs.close(); }
        } catch (SQLException e) {
            ...
        }
        try {
            if (stmt != null) { stmt.close(); }
        } catch (SQLException e) {
            ...
        }
        try {
            if (conn != null) { conn.close(); }
        } catch (SQLException e) {
            ...
        }
    }
    ```

* 在循环中操作数据库：建立连接、执行SQL和关闭连接需要时间，虽然一次执行时间可能不长，但是在循环中累积会很耗时。因此应当减少数据库操作次数，一次性查询好，或者使用批处理一次性执行修改。
    ```java
    for (String id: idList) {
        // 从数据库获取对象
        ItemPO item = getItem(id);   // 错误：在for循环中操作数据库
        // 进行修改
        item.setColA(...);
        item.setColB(...);
        // 将修改保存到数据库中
        updateItem(item);     // 错误：在for循环中操作数据库
    }

    // 修改成（假定itemList还有其他用途，要不然直接UPDATE就行了）
    // 一次性将idList里的数据都取出来
    List<ItemPO> itemList = getItemList(idList);
    // 将itemList装到Map中以便查询
    Map<String, ItemPO> itemMap = new HashMap<String, ItemPO>();
    for (ItemPO item: itemList) {
        itemMap.put(item.getId(), item);
    }
    
    PreparedStatement stmt = connection.prepareStatement("UPDATE BUSINESS SET AAA=?, BBB=? WHERE ID=?");
    for (String id: idList) {
        // 从Map获取对象
        ItemPO item = itemMap.get(id);
        // 进行修改
        stmt.setString(1, ...);
        stmt.setString(2, ...);
        stmt.setString(3, item.getId());
        // 加入批处理
        stmt.addBatch();
    }
    // 执行批处理
    stmt.executeBatch();
    ```

* getString之后未判断是否为null，或者从DAO取值后未判断是否为null：从可空字段取值之后，返回的可能是null。
    ```java
    String remark = rs.getString("REMARK").trim();      // 错误：未判断是否为null
    ```

* 事务
    * 该有事务的地方没加事务：对于一系列数据库修改操作而言，如果这些操作应当“共进退”，即要么全部执行完，要么出错之后能够全部恢复，那么应当加入事务控制。
    * 发生异常时未回滚事务：
        ```java
        try {
            conn.setAutoCommit(false);
            ...
            conn.commit();
        } catch (SQLException e) {
            // 错误：此处应有conn.rollback();
            ...
        } finally {
            ...
        }
        ```
    * 重复提交/回滚事务：已经commit/rollback之后又执行了commit/rollback。如果在开启事务之后调用了一些函数，但是未注意到函数里面也有事务控制，那么结果可能会出错。

* 该加锁的地方没加锁：例如从流水号表取下一流水号
    ```java
    public static String getNextSerial(String businessType) throws SQLException {
        ...
        try {
            ...
            stmt = conn.prepareStatement("SELECT NEXT_NO FROM T_SERIAL WHERE ...");
            stmt.setString(1, ...);
            rs = stmt.executeQuery();
            if (rs.next()) {
                int next_no = rs.getInt("NEXT_NO");
                result = businessType + "-" + next_no;
                // 将流水号表中的记录加1
                ...
            } else {
                // 将初始值置为1，并向流水号表插入记录
                ...     
            }
            ...
        } catch (SQLException e) {
            ...
        } finally {
            ...
        }
        return result;
    }
    ```
    假如NEXT_NO为5，那么在并发条件下各用户获取到的可能都是5，从而产生冲突，因此需要通过加锁进行控制（例如synchronized）。另外注意这种代码在读取数据时就发生了冲突，所以光加事务控制是不起作用的。

# SQL语句
* SQL语法错误：例如引号不配对、括号不配对、数据类型不匹配，或者拼接的SQL缺空格、有多余AND和多余逗号等。
    ```java
    StringBuilder sql = new StringBuilder("SELECT ID,NAME FROM TAB WHERE");
    if (StringUtils.isNotEmpty(cond1)) {
        // 两个错误：一个是缺空格，另一个是在WHERE后面直接拼接AND了
        sql.append("AND cond1='").append(escapeSQL(cond1)).append("'");
    }
    if (StringUtils.isNotEmpty(cond2)) {
        sql.append(" AND cond2 IN (");
        String[] arr = cond2.split(",");
        for (String s: arr) {
            sql.append("'").append(escapeSQL(s)).append("',");
        }
        // 错误：未处理最后一个多余的逗号
        sql.append(")");
    }
    ```
* 使用SELECT \*：应当写清字段名而非简单粗暴的\*。
* 直接拼接SQL：未对用户输入进行处理，会导致SQL注入，应该用PreparedStatement或者使用转义函数对用户输入内容转义。
    * 接上条，要避免重复转义。
* 对可空字段使用<>或NOT IN：应注意单独判断NULL值。
    ```sql
    -- 假设FLAG是可空字段，那么以下都是有问题的
    SELECT ID, NAME FROM TAB WHERE FLAG<>'1';
    SELECT ID, NAME FROM TAB WHERE FLAG NOT IN ('1', '2');
    -- 应修改成（下面只考虑NULL问题，不考虑效率问题）
    SELECT ID, NAME FROM TAB WHERE FLAG<>'1' OR FLAG IS NULL;
    SELECT ID, NAME FROM TAB WHERE FLAG NOT IN ('1', '2') OR FLAG IS NULL;
    ```
* 子查询返回多条记录：
    ```sql
    SELECT ID, NAME FROM TAB WHERE BUSINO=(SELECT BUSINO FROM APPL WHERE ...);
    -- 如果查询APPL会返回多条记录，那么会出错，因此需要调整子查询条件，保证至多返回一条记录，例如（Oracle）
    SELECT ID, NAME FROM TAB WHERE BUSINO=(SELECT BUSINO FROM APPL WHERE ... AND ROWNUM=1);
    ```
* 用==或<>判断NULL：应使用IS NULL或IS NOT NULL进行判断。
* IN后面没有值，或者取值超过了1000个。
* 参数校验不完整：假如HUGE_TABLE是张很大的表，对于下面代码而言，只要构造不含任何条件的请求，那么就可以把系统搞瘫痪。
    ```java
    // 绕过前台校验，不传任何条件，使程序直接查全表
    StringBuilder sql = new StringBuilder("SELECT NAME,DESCRIPTION FROM HUGE_TABLE WHERE 1=1");
    if (StringUtils.isNotEmpty(cond1)) {
        sql.append(" AND COND1='").append(escapeSQL(cond1)).append("'");
    }
    if (StringUtils.isNotEmpty(cond2)) {
        sql.append(" AND COND2='").append(escapeSQL(cond2)).append("'");
    }
    if (StringUtils.isNotEmpty(cond3)) {
        sql.append(" AND COND3='").append(escapeSQL(cond3)).append("'");
    }
    PreparedStatement stmt = conn.prepareStatement(sql.toString());
    ...
    ```
    另外两个例子：
    * 如果分页程序未对每页最多记录数进行限制，那么用户可以让每页显示10000条记录，从而影响系统运行。
    * 如果参数作为UPDATE或DELETE的条件来使用，那么绕过校验会产生灾难性后果。

# 页面
## HTML/JSP
* 使用过时的标签和属性，例如&lt;font&gt;或者&lt;span color="red"&gt;。
* HTML标签不匹配。
* 修改表格标题内容，未修改待展示的数据，或者未修改带有colspan的单元格。
* 不经转义直接输出动态内容：容易导致XSS注入。

## JavaScript
* 使用document.getElementById等函数之后未判断是否为null。
* 动态添加控件后未绑定事件。
    * 接上条，动态添加控件后，选择器有误，导致既有控件又绑了一遍事件。
* 进行AJAX操作，未处理请求超时、请求错误和返回错误码的情况。
* 后台使用GB2312，前台AJAX内容含有中文，但未进行转码处理。
* 点击提交、删除等具有危险性的按钮，系统直接执行操作，不给出任何确认提示。
* 进行保存、提交等耗时操作时没有等待提示，也未将控制按钮变灰：这样容易使用户以为操作不成功而重复点击。

# 其他
* 线程安全问题：例如使用静态HashMap实例进行缓存。
* 没有设置连接超时：一旦数据库或接口卡死，而用户还在正常使用系统，那么程序会消耗越来越多的资源，最终导致响应慢甚至崩溃。

# 本系列目录
1. **代码审查问题**
2. [应用安全问题](/2019/01/03/java-code-review-2)
3. [关于编程习惯的要求](/2019/01/04/java-code-review-3)
4. [使用Phabricator进行人工代码审查](/2019/02/06/java-code-review-4)
5. 使用FindBugs和SonarQube等工具进行扫描
6. ……
