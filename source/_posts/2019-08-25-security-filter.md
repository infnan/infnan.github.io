---
layout: post
title: 实现一个简单粗暴的Java Web安全过滤器
category: 教程
tags:
- Web 
- 安全
---
对于行业系统来说，如果开发人员水平一般，而且又忙于赶工期，Web安全问题就很容易抛到脑后。然而，在这类系统中，用户输入内容往往是业务相关的，范围可以预测，不会特意输入敏感词语，因此又可以用简单粗暴的方法挡住大部分常见攻击。

在Java应用中，页面加载之前会先经过过滤器（Filter），我们便可以设置一个安全过滤器SecurityFilter，以“宁可错杀一万，不可放过一个”的方式拦截常见攻击，满足基本的安全需求。
<!-- more -->

# 框架
建立SecurityFilter类，假如包名称为com.testcompany.testapp.utils.filter，骨架如下：

```java
package com.testcompany.testapp.utils;

//import org.springframework.stereotype.Component;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

// @Component
public class SecurityFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {

    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        boolean intercept = false;
        String message = "";

        // 获取请求 URL 和 URI
        String url = httpRequest.getRequestURL().toString();
        String uri = httpRequest.getRequestURI();

        logger.debug("url: " + url);
        logger.debug("uri: " + uri);

        // 判断是否属于白名单，直接放行

        // 各种策略

        // 结果
        if (!intercept) {
            // 正常请求
            chain.doFilter(request, response);
        } else {
            // 被拦截，转发到报错页面
            request.setAttribute("message", message);
            request.getRequestDispatcher("/error").forward(request, response);
        }
    }

    @Override
    public void destroy() {
        // 安全过滤器销毁
    }
}
```
上面代码未进行任何拦截，我们将在后面逐步完善拦截规则。

如果你的项目有web.xml，那么需要加入以下内容：
```xml
<filter>
    <filter-name>SecurityFilter</filter-name>
    <filter-class>com.testcompany.testapp.utils.SecurityFilter</filter-class>
    <init-param>
        <param-name>encoding</param-name>
        <param-value>UTF-8</param-value>
    </init-param>
</filter>
<filter-mapping>
    <filter-name>SecurityFilter</filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
```

如果你的项目没有web.xml，例如SpringBoot项目，那么你需要给SecurityFilter增加相关注解（@Component）。

# 具体规则

## 防止SQL注入、跨站脚本攻击（XSS）
可考虑采取敏感词的形式来预防SQL注入和XSS攻击。假设敏感词列表（具体词语参见文末）放在了`bannedKeywords`中，那么可提取GET/POST参数进行匹配：

```java
if (!intercept) {
    // 获取GET/POST参数
    Map<String, String[]> paramMap = httpRequest.getParameterMap();

    post_filter:
    for (String param: paramMap.keySet()) {
        for (String keyword: bannedKeywords) {
            if (param.toLowerCase().contains(keyword)) {
                intercept = true;
                message = "检测到非法字符【" + keyword + "】，请重新输入！";
                break post_filter;
            }
        }

        String[] values = paramMap.get(param);
        if (values != null) {
            for (String value: values) {
                for (String keyword: bannedKeywords) {
                    if (value.toLowerCase().contains(keyword)) {
                        intercept = true;
                        message = "检测到非法字符【" + keyword + "】，请重新输入！";
                        break post_filter;
                    }
                }
            }
        }
    }
}
```

另外再通过设置安全相关HTTP Header来加强防御：

```java
// 浏览器拒绝响应MIME类型不正确的资源
httpResponse.setHeader("X-Content-Type-Options", "nosniff");

// 内容安全策略（CSP）设置
// 参见：http://www.ruanyifeng.com/blog/2016/09/csp.html
// httpResponse.setHeader("Content-Security-Policy", "default-src 'self'");

// 浏览器防XSS设置
// 参见：https://www.freebuf.com/articles/web/138769.html
httpResponse.addHeader("X-XSS-Protection", "1; mode=block");
```

需要注意的是：

1. 敏感词机制非常容易导致误判（例如拦截` AND `会把正常的英语内容也给拦截掉），需要增加例外机制，并结合业务进行充分测试。
2. 敏感词机制无法防止所有注入，例如攻击者仍然可以通过字符编码、加空格、加回车、加注释等方式来绕过拦截。
3. 上面GET/POST参数检测无法检测Restful API和JSON请求。如果业务有这两种请求，需另外写代码进行处理。

## 防止跨站请求伪造（CSRF）
可以通过两种方式预防CSRF攻击，一个是校验Referer，另一个是在表单中设置并验证token。对于拦截器来说，前一种实现方式比较简单。

假如Referer域名白名单为`hostWhiteList`，那么代码可以写成：

```java
String referer = httpRequest.getHeader("Referer");
if (!intercept && referer != null) {
    String domain = referer.replaceAll("^https?:\\/\\/(.*?)\\/.*", "$1").toLowerCase();
    if (!hostWhiteList.contains(domain)) {
        intercept = true;
        message = "检测到未经授权的访问，请从官方网站登录系统，并检查操作是否正常！";
    }
}
```

为了防止非法提交，可进一步考虑限制POST请求中必须有合法Referer。

## Host头攻击
此攻击主要针对虚拟主机，换句话说，如果服务器上只有一个站点，Host头攻击实际上没有意义。然而，为了应付甲方检查，可能需要再加一遍限制：

```java
String host = httpRequest.getHeader("Host");
if (!intercept && host != null && !hostWhiteList.contains(host.toLowerCase())) {
    intercept = true;
    message = "检测到未授权访问，请重新从官方网站登录系统！";
}
```

## 点击劫持（Clickjacking）漏洞
加一句话即可：

```java
// 避免点击劫持漏洞
httpResponse.addHeader("X-Frame-Options", "sameorigin");
```

## 防止未登录访问、防止越权访问
应用需要防止用户未登录就直接访问特定功能的URL。由于不同认证组件的管理方式不同，本文不再展开讨论。

在校验Cookie和会话时，需留意生产环境是否为集群。若配置负载均衡等设备，同一用户的请求不见得会被同一台服务器接收，实现会话机制时要考虑会话共享问题（例如配置Redis服务器）。

## Cookie加固
Cookie需设置为HttpOnly、Secure，防止前台通过JavaScript获取到Cookie内容。

使用比较新的中间件，Cookie应该已经是HttpOnly，或者可以很容易设置成HttpOnly。然而，如果Tomcat等软件太老，你需要手工修改Cookie：
```java
HttpSession session = httpRequest.getSession(false);
if (session != null) {
    String sessionId = session.getId();
    String header = "JSESSIONID=" + sessionId + "; Secure; HttpOnly; Path=/";
    httpResponse.setHeader("Set-Cookie", header);
}
```

## “使用HTTP动词篡改的认证旁路”
使用AppScan等扫描软件进行扫描，可能会出现这个问题。解决起来很简单，只留一些常用的动词（GET、POST、OPTIONS等），其余全部拦截。

```java
String method = httpRequest.getMethod();
if (!intercept && !"GET,POST,HEAD,OPTIONS,PUT,DELETE".contains(method)) {
    intercept = true;
    message = "检测到未授权的请求方式！";
}
```

如果你的系统使用了PUT、DELETE等浏览器不支持的动词，需要分两种情况讨论：

* 浏览器页面：框架往往会进行一些特殊处理（例如将实际请求方式保存在name为_method的隐藏域中），使浏览器以POST方式提交用户请求。这样的话不需要特意放行PUT和DELETE。
* 后台接口：由于调用方不是浏览器，可直接使用相应动词，此时过滤器需放行PUT和DELETE等动词。

## 限制指定IP访问 / 获取用户IP地址
不建议在Java层面进行控制。下面只给出获取用户IP的方法：

```java
// 获取用户 IP
// 注意：
// （1）X-Real-IP需要反向代理软件进行配合设置才能获取到。
//      如果反向代理软件配置正确，其值可被信任。
// （2）X-Forwarded-For记录了用户真实IP，但该Header能被用户伪造，不可信任。
// （3）getRemoteAddr返回的是直接访问服务器的IP地址。虽然取值可信，
//     但是配置反向代理、负载均衡等设备之后，getRemoteAddr将返回网络设备IP，而不是用户IP。
// 建议：设置nginx等软件，将用户真实IP记录在X-Real-IP头中。
String ip = httpRequest.getHeader("X-Real-IP");
if (StringUtils.isEmpty(ip)) {
    ip = httpRequest.getHeader("X-Forwarded-For");
    if (StringUtils.isNotEmpty(ip)) {
        // X-Forwarded-For中可能有多个IP地址，第一个IP是用户真实IP。
        ip = ip.split(",")[0];
    } else {
        ip = request.getRemoteAddr();
    }
}
logger.debug("ip: " + ip);
```

## 限制指定浏览器访问
如果应用不应该直接通过浏览器访问，可对浏览器UA进行限制。例如仅允许微信浏览器访问：

```java
// 获取用户 User-Agent
// 注意：用户可以篡改User-Agent，伪装成各种浏览器
String ua = httpRequest.getHeader("User-Agent");
logger.debug("ua: " + ua);
if (!intercept && ua != null && !ua.contains("MicroMessenger")) {
    intercept = true;
    message = "请使用微信访问本页面！";
}
```

另外，出于友好性考虑，可将报错页面换成微信公众号二维码，以便用户扫描关注。

## 直接放行
有些文件格式完全无害，例如服务器本身提供的js、css等静态资源，可考虑直接放行此类扩展名。

由于重定向之后会再次经过SecurityFilter，而所有已经拦截的请求都重定向到了报错页面，所以报错页面也需要放行，不要再将报错页面forward到报错页面，导致死循环。

# 注意事项
本过滤器功能简单粗暴，然而仍然会有漏网之鱼，例如通过加注释符号便可绕过SQL注入拦截。

最有效的解决方案，还是要求开发人员平时就注重安全（例如SQL使用参数绑定、页面渲染时进行HTML转义等），测试人员也针对安全问题进行测试，在上线之前就尽量消除隐患。

# 完整代码
以Spring框架为例，将上述代码组合到一起，并加入yml配置文件支持，完整代码如下：

SecurityFilter.java：
```java
package com.testcompany.testapp.utils;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.error.YAMLException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class SecurityFilter implements Filter {
    private final static Logger logger = LoggerFactory.getLogger(SecurityFilter.class);

    // 系统安全参数设置
    private static SecurityConfig config = null;

    // 从配置文件读取系统安全参数配置
    static {
        Yaml yaml = new Yaml();
        try (InputStream inputStream = new ClassPathResource("security.yml").getInputStream()) {
            config = yaml.loadAs(inputStream, SecurityConfig.class);

            // 报错页面加入安全白名单
            config.getUriWhiteList().add(config.getErrorPageUrl());
        } catch (IOException | YAMLException e) {
            logger.error("加载安全设置失败", e);
        }
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {

    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        if (config == null) {
            request.setAttribute("message", "系统安全设置加载失败，请检查错误并重新启动系统！");
            request.getRequestDispatcher("/error").forward(request, response);
        }

        // 获取请求 URL 和 URI
        String url = httpRequest.getRequestURL().toString();
        String uri = httpRequest.getRequestURI();

        logger.debug("url: " + url);
        logger.debug("uri: " + uri);

        // 判断是否属于不过滤的白名单URI
        if (config.getUriWhiteList().contains(uri)) {
            chain.doFilter(request, response);
            return;
        }

        // 判断是否为白名单扩展名
        int pos = uri.lastIndexOf(".");
        if (pos > -1) {
            String extName = uri.substring(pos + 1).toLowerCase();
            if (config.extWhiteList.contains(extName)) {
                chain.doFilter(request, response);
                return;
            }
        }

        boolean intercept = false;
        String message = "";

        // 指定输入/输出字符编码
        String encoding = config.getEncoding();
        if (encoding != null) {
            httpRequest.setCharacterEncoding(encoding);
            httpResponse.setCharacterEncoding(encoding);
        }

        // 判断用户是否登录（略）

        // 验证用户权限（略）

        // 增加Cookie安全性：添加HttpOnly和Secure属性，防止Cookie被通过js非法获取
        // 注意：一般是很老的中间件才需要手动设置
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            String sessionId = session.getId();
            String header = "JSESSIONID=" + sessionId + "; Secure; HttpOnly; Path=/";
            httpResponse.setHeader("Set-Cookie", header);
        }

        // 避免点击劫持漏洞
        httpResponse.addHeader("X-Frame-Options", "sameorigin");

        // 跨域资源共享CORS
        String origin = httpRequest.getHeader("Origin");
        if (StringUtils.isNotEmpty(origin)) {
            if (config.getCorsWhiteList().contains(origin)) {
                httpResponse.setHeader("Access-Control-Allow-Origin", origin);
                httpResponse.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
                httpResponse.setHeader("Access-Control-Max-Age", "86400");
            }
        }

        // 浏览器拒绝响应MIME类型不正确的资源
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");

        // 内容安全策略（CSP）设置
        // 参见：http://www.ruanyifeng.com/blog/2016/09/csp.html
        // httpResponse.setHeader("Content-Security-Policy", "default-src 'self'");

        // 浏览器防XSS设置
        // 参见：https://www.freebuf.com/articles/web/138769.html
        httpResponse.addHeader("X-XSS-Protection", "1; mode=block");

        // GET/POST请求参数过滤
        // 主要用于防止各类注入（XSS、SQL注入等）
        if (!intercept) {
            // 获取GET参数，实际上不需要
            // String queryString = httpRequest.getQueryString();
            // MultiValueMap<String, String> parameters = UriComponentsBuilder.fromUriString(uri).build().getQueryParams();

            // 获取GET/POST参数
            Map<String, String[]> paramMap = httpRequest.getParameterMap();

            post_filter:
            for (String param: paramMap.keySet()) {
                for (String keyword: config.getBannedKeywords()) {
                    if (param.toLowerCase().contains(keyword)) {
                        intercept = true;
                        message = "检测到非法字符【" + keyword + "】，请重新输入！";
                        break post_filter;
                    }
                }

                String[] values = paramMap.get(param);
                if (values != null) {
                    Set<String> whiteList = config.getKeywordWhiteList().get(param.toLowerCase());

                    for (String value: values) {
                        for (String keyword: config.getBannedKeywords()) {
                            if (value.toLowerCase().contains(keyword) && !(whiteList != null && whiteList.contains(keyword))) {
                                intercept = true;
                                message = "检测到非法字符【" + keyword + "】，请重新输入！";
                                break post_filter;
                            }
                        }
                    }
                }
            }

            // 注意：如使用Restful风格的URL，还需要考虑检查url本身，并需要防止误判
            // for (String keyword: config.getBannedKeywords()) {
            //     if (uri.toLowerCase().contains(keyword)) {
            //         intercept = true;
            //         message = "检测到非法字符【" + keyword + "】，请重新输入！";
            //         break;
            //     }
            // }

            // 注意：上面无法检查JSON格式内容，如有需要，可在下面代码基础上进行完善
            // String contentType = httpRequest.getHeader("Content-Type");
            // if (contentType != null && contentType.toLowerCase().contains("json")) {
            //     // 获取JSON提交内容
            //     StringBuilder jsonStr = new StringBuilder();
            //     try {
            //         BufferedReader reader = request.getReader();
            //         String line;
            //         while ((line = reader.readLine()) != null) {
            //             jsonStr.append(line);
            //         }
            //     } catch (IOException e) {
            //         logger.error("JSON读取错误", e);
            //     }

            //     // 测试是否为合法JSON对象
            //     String json = jsonStr.toString();
            //     try {
            //         JSON.parse(json);
            //     } catch (JSONException e) {
            //         intercept = true;
            //         message = "无效JSON";
            //     }

            //     // 检查是否包含敏感字符
            //     for (String keyword: config.getBannedKeywords()) {
            //         if ("\"".equals(keyword) || "'".equals(keyword)) {
            //             continue;
            //         }
            //         if (json.toLowerCase().contains(keyword)) {
            //             intercept = true;
            //             message = "检测到非法字符【" + keyword + "】，请重新输入！";
            //             break;
            //         }
            //     }
            // }
        }

        // "使用HTTP动词篡改的认证旁路"
        // 该策略用于应对甲方的安全扫测，实际无安全风险。
        String method = httpRequest.getMethod();
        if (!intercept && !"GET,POST,HEAD,OPTIONS,PUT,DELETE".contains(method)) {
            intercept = true;
            message = "检测到未授权的请求方式！";
        }

        // Host头攻击拦截
        // 该策略用于应对甲方的安全扫测，实际安全风险不大。
        String host = httpRequest.getHeader("Host");
        if (!intercept && host != null && !config.getHostWhiteList().contains(host.toLowerCase())) {
            intercept = true;
            message = "检测到未授权访问，请重新从官方网站登录系统！";
        }

        // Referer拦截
        // 该策略主要用于预防CSRF攻击，并可在一定程度上预防盗链
        // 注意：
        // （1）Referer内容可被用户伪造
        // （2）仅凭Referer拦截的话，防盗链效果有限。如果想有效地防盗链，需要再采取其他措施，这里不再展开讨论。
        String referer = httpRequest.getHeader("Referer");
        if (!intercept) {
            if (referer != null) {
                String domain = referer.replaceAll("^https?:\\/\\/(.*?)\\/.*", "$1").toLowerCase();
                if (!config.getHostWhiteList().contains(domain)) {
                    intercept = true;
                    message = "检测到未经授权的访问，请从官方网站登录系统，并检查操作是否正常！";
                }
            } else {
                // 要求POST请求中包含Referer，防止非法提交表单
                if ("POST".equals(httpRequest.getMethod())) {
                    intercept = true;
                    message = "检测到未经授权的访问，请从官方网站登录系统，并检查操作是否正常！";
                }
            }
        }

        // 结果
        if (!intercept) {
            // 正常请求
            chain.doFilter(request, response);
        } else {
            // 被拦截，转发到报错页面
            request.setAttribute("message", message);
            request.getRequestDispatcher(config.getErrorPageUrl()).forward(request, response);
        }
    }

    @Override
    public void destroy() {

    }

    // 安全配置文件格式
    public static class SecurityConfig {
        private Set<String> uriWhiteList;
        private Set<String> extWhiteList;
        private Set<String> hostWhiteList;
        private List<String> bannedKeywords;
        private Map<String, Set<String>> keywordWhiteList;
        private Set<String> corsWhiteList;
        private String encoding;
        private String errorPageUrl;

        public SecurityConfig() {
        }

        public Set<String> getUriWhiteList() {
            return uriWhiteList;
        }

        public void setUriWhiteList(Set<String> uriWhiteList) {
            this.uriWhiteList = uriWhiteList;
        }

        public Set<String> getExtWhiteList() {
            return extWhiteList;
        }

        public void setExtWhiteList(Set<String> extWhiteList) {
            this.extWhiteList = extWhiteList;
        }

        public Set<String> getHostWhiteList() {
            return hostWhiteList;
        }

        public void setHostWhiteList(Set<String> hostWhiteList) {
            this.hostWhiteList = hostWhiteList;
        }

        public List<String> getBannedKeywords() {
            return bannedKeywords;
        }

        public void setBannedKeywords(List<String> bannedKeywords) {
            this.bannedKeywords = bannedKeywords;
        }

        public Map<String, Set<String>> getKeywordWhiteList() {
            return keywordWhiteList;
        }

        public void setKeywordWhiteList(Map<String, Set<String>> keywordWhiteList) {
            this.keywordWhiteList = keywordWhiteList;
        }

        public Set<String> getCorsWhiteList() {
            return corsWhiteList;
        }

        public void setCorsWhiteList(Set<String> corsWhiteList) {
            this.corsWhiteList = corsWhiteList;
        }

        public String getEncoding() {
            return encoding;
        }

        public void setEncoding(String encoding) {
            this.encoding = encoding;
        }

        public String getErrorPageUrl() {
            return errorPageUrl;
        }

        public void setErrorPageUrl(String errorPageUrl) {
            this.errorPageUrl = errorPageUrl;
        }
    }
}
```

security.yml:
```yaml
# 输入/输出字符编码
encoding: UTF-8

# 报错页面
errorPageUrl: /error

# 不拦截的URI的白名单
uriWhiteList:
  - /error

# 不拦截的扩展名
extWhiteList:
  - jpg
  - gif
  - png
  - zip
  - rar
  - pdf
  - doc
  - docx
  - xls
  - xlsx
  - ppt
  - pptx
  - js
  - css

# 可合法访问域名白名单（小写；不写协议；80和443不需要写端口）
# 用于Host和Referer校验
# 注意把自己电脑、测试环境、生产环境等都配置好
hostWhiteList:
  - 127.0.0.1:8080
  - localhost:8080
  - www.yourdomain.com

# XSS、SQL注入字符黑名单（小写）
# 注意：因绕过注入过滤方法很多，安全负责人需持续关注
bannedKeywords:
  # 防SQL注入
  # 各种引号
  - "'"
  - '"'
  - "%uff07"
  - "%u0022"
  - "%u0027"
  - "%22"
  - "%27"
  - "%c0%a7"
  - "%c0%27"

  # SQL关键字
  - "@@"
  - "select "
  - " from "
  - " where "
  - "delete "
  - "update "
  - "exec "
  - "drop "
  - "create "
  - "alter "
  - " union "
  - " or "      # 注意容易误判
  - "+or+"
  - "+or "
  - " or+"
  - " and "     # 注意容易误判
  - "+and+"
  - "+and "
  - " and+"
  - " having "
  - " sys"
  - " sp_"
  - "db_name"
  - "db_id"
  - "host_name"
  - "host_id"

  # 防XSS
  # 标签
  - "<a"
  - "<audio"
  - "<iframe"
  - "<img"
  - "<input"
  - "<noscript"
  - "<object"
  - "<script"
  - "<style"
  - "<title"
  - "< a"
  - "< audio"
  - "< iframe"
  - "< img"
  - "< input"
  - "< noscript"
  - "< object"
  - "< script"
  - "< style"
  - "< title"
  - "%3ca"
  - "%3caudio"
  - "%3ciframe"
  - "%3cimg"
  - "%3cinput"
  - "%3cnoscript"
  - "%3cobject"
  - "%3cscript"
  - "%3cstyle"
  - "%3ctitle"
  - " src="
  - "%20src="
  - "style="
  - "style ="
  - "style%20="
  - "&lt;"
  - "&gt;"
  - "&amp;lt;"
  - "&amp;gt;"
  - "%0a"
  - "%0d"

  # JavaScript
  - "onclick"
  - "ondblclick"
  - "onmousedown"
  - "onmousemove"
  - "onmouseout"
  - "onmouseover"
  - "onmouseup"
  - "onkeydown"
  - "onkeyup"
  - "onkeypress"
  - "onchange"
  - "onselect"
  - "onfocus"
  - "onblur"
  - "onerror"
  - "onhelp"
  - "onload"
  - "onunload"
  - "javascript"
  - "vbscript"
  - "jscript"
  - "window."
  - "window["
  - "document."
  - ".do("
  - ".do ("
  - ".do%20("
  - "expression("
  - "expression ("
  - "expression%20("
  - "eval("
  - "eval ("
  - "eval%20("
  - "function("
  - "function ("
  - "function%20("
  - "=>"

  # 恶意脚本（应付检查的成分更多一些）
  - ".bak"
  - ".php"
  - ".asp"
  - ".source"

  # 其他注入
  - "${"
  - "#{"


# 防注入例外字段名单
# 例如公司英文名字段（company_name）中出现"联合跨国公司"，英文名中带有" UNION "，可加入例外）
keywordWhiteList:
  company_name:
    - " union "
    - " and "

# 允许跨域资源共享白名单（需要完整URL）
corsWhiteList:
  - https://www.theirdomain.com
```

pom.xml：
```xml
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-lang3</artifactId>
    <version>3.9</version>
</dependency>
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>fastjson</artifactId>
    <version>1.2.52</version>
</dependency>
<dependency>
    <groupId>org.yaml</groupId>
    <artifactId>snakeyaml</artifactId>
    <version>1.25</version>
</dependency>
```

build.gradle：
```groovy
dependencies {
    // ...
    implementation 'org.apache.commons:commons-lang3'
    implementation 'com.alibaba:fastjson:1.2.52'
    implementation 'org.yaml:snakeyaml:1.25'
}
```
