---
layout: post
title: WebLogic踩坑记录
category: 系统运维
tags:
- WebLogic
---
本文记录我在部署WebLogic时遇到的各种坑。其中JDK为1.6，WebLogic版本11g（10.3.6）。
<!-- more -->
<style>
#post-content table {
	word-break: break-all;
}

code {
	word-break: break-all;
}
</style>

# 开发阶段
## 准备测试区
务必准备一个和生产环境架构接近的测试环境，而且开发环境、测试环境和生产环境的JDK与中间件版本应该保持一致，如果条件不够，至少测试环境和生产环境要一致。开发时用某个版本JDK和Tomcat，部署到生产环境时用另一个版本的JDK和WebLogic，这样很容易遭遇意外。
    
举一些例子，以下几个就属于Tomcat上面测不出来，挪到WebLogic上面就可能会暴露出来的错误，好在下表这些错误通过修改WebLogic服务器启动参数就能在一定程度上解决了：

| 场景							| 错误信息							| 启动参数
|------------------------------|----------------------------------|-----------------------------
| 生成图片						| java.awt.HeadlessException		| -Djava.awt.headless=true
| 访问HTTPS网站					| javax.net.ssl.SSLHandshakeException: sun.security.validator.ValidatorException: No trusted certificate found exception | -DUseSunHttpHandler=true
| Apache CXF提供WebService服务	| javax.xml.ws.soap.SOAPFaultException: Cannot create a secure XMLInputFactory | -Dorg.apache.cxf.stax.allowInsecureParser=1
| 启动报错，提示无法加载config.xml | `Server failed. Reason: [Management:141266]Parsing Failure in config.xml: failed to find method MethodName` | -Dweblogic.configuration.schemaValidationEnabled=false

如何修改WebLogic的启动参数？

* AdminServer启动参数：找到类似于`/u01/Oracle/Middleware/user_projects/domains/base_domain/bin/setDomainEnv.sh`的文件，找到倒数第一个`JAVA_OPTIONS=...`，在它的后面追加参数。
* 修改其他节点的启动参数：进入WebLogic控制台，点击服务器→你的服务器（例如app_server1）→配置→服务器启动，然后往下翻，找到“参数”项。

## JDK版本
如需使用JDK8或更高版本，需要更换新版WebLogic，将版本升级至12.1.3或以上。

如需升级至JDK7：

* 需排查程序代码，改写所有涉及`sun.*`包的程序，否则升级后会报错。
* 安装完成后，需要进入WebLogic安装目录的`modules`目录中，将`javax.annotation_1.0.0.0_1-0.jar`、`javax.xml.bind_2.1.1.jar`、`javax.xml.ws_2.1.1.jar`三个文件拷到`$JAVA_HOME/jre/lib/endorsed`中（如果没有此目录，新建一个即可）。

## JAR包冲突（待撰）
TODO

## 路径问题
假设程序部署在服务器的`/home/weblogic/project`中，WebLogic安装在`/u01/Oracle/Middleware`下面，而且程序会动态生成文件，实际上文件会放在类似于`/u01/Oracle/Middleware/user_projects/domains/base_domain/servers/app_server1/stage/project`的对应位置中，而且激活更新时候文件会丢失，需要重新生成。

避免使用中文文件名和中文路径，以免因字符编码问题导致部署或升级失败。举个例子，如果文件里有中文名，打包并解压之后文件名变成了乱码，那么更新的时候WebLogic会提示`Error occurred while downloading files from admin server for deployment request "xxx,xxx,xxx". Underlying error is: "null"`。

## 数据源名称
假如JNDI数据源名称为dataSource，在Tomcat中运行时，需要写成`java:comp/env/dataSource`，但是在WebLogic中运行时要把`java:comp/env/`去掉，直接写成dataSource。

## 集群Session丢失问题
生产环境通常会架设集群，通过负载均衡进行访问。如果负载均衡未按照Cookie进行分配，或者分配策略不完全正确，那么这样的话很可能会存在串Session的问题，例如登录成功之后进的是节点1，稍微做点操作后默默地跳到了节点3，导致会话丢失，系统提示重新登录。因为平时开发不会去使用负载均衡，所以可能注意不到这个问题。

这个问题可以通过以下几种方法解决：

1. 正确地配置负载均衡，保证同一会话（JSESSIONID）的流量只分配到同一节点上；
2. 使用WebLogic的“会话复制”功能（这个比较正统）；
3. 通过Redis等实现会话共享（比较复杂）。

会话复制的操作方法可以用Google搜索。

## 访问HTTPS网站的问题
如果程序涉及访问HTTPS网站（包括接口），那么JDK最低要1.7。其实并不是说JDK1.6不行，而是碰到问题的话会非常麻烦，解决起来不如升JDK靠谱。

配置新环境时建议用一个小程序来验证HTTPS是否能正常访问：

```java
import java.net.URL;
import java.net.URLConnection;

public class HttpsTest {
    public static void main(String[] args) {
        try {
            String url = "https://www.baidu.com";
            if (args.length > 0) {
                url = args[0];
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://" + url;
            }

            URL u = new URL(url);
            URLConnection conn = u.openConnection();
            conn.setConnectTimeout(2000);
            conn.connect();

            System.out.println("连接成功");
        } catch (Exception e) {
            System.out.println("连接失败");
            e.printStackTrace();
        }
    }
}
```

使用方法：

```
javac HttpsTest.java
java HttpsTest www.baidu.com
```

假如报`sun.security.validator.ValidatorException: PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target`错，说明证书验证未通过，Java主动拒绝访问目标网站。这时候需要检查：

1. 目标网站的HTTPS证书是否有效。可以用Chrome或Firefox浏览器测试一下。
2. 如果目标网站证书有效，你需要检查JDK的根证书库是否正确。
3. 如果目标网站证书无效，你需要将证书加入信任才行。

### cacerts
如果证书有效，但是Java还是报错，可能是JDK本身没有正确加载根证书库。你需要检查`$JAVA_HOME/jre/lib/security/cacerts`存不存在，没有的话，可以从其他装Java 8或10的机器上拷一份。

拷完之后注意检查一下JDK有没有把cacerts文件认出来，命令`keytool -list -storepass changeit`。有的JDK会在其他位置保存根证书库，这样的话你即使拷到security目录也是没用，需要再用`keytool -importkeystore -srckeystore 你的cacerts -srcstorepass changeit -deststorepass changeit`把你的cacerts文件导一遍（如果你知道正确的位置和文件名，直接把cacerts文件扔到正确位置也行）。

另外如果目标网站采用Let's Encrypt证书，那么你需要检查一下JDK版本，7u111+（需要掏钱买才能弄到）、8u101+，因为对Let's Encrypt的信任是后加的，所以低于这个版本的话需要手动导证书，否则还是会报错，跟使用自签名证书没啥区别。

### 导证书
HTTPS证书通常需要花钱，所以开发阶段多会考虑自行签发证书，即自签名证书。系统不信任这种证书，所以你必然要用keytool命令来导证书。操作方法大致是先用浏览器把证书文件保存下来，再运行`keytool -trustcacerts -storepass changeit -importcert -alias zhengshu -file 证书文件.cer`命令加入信任。

除此之外还要注意三个问题：

1. 证书不能过期。过期证书即使设置信任，运行时候也会报错，你必须要求目标网站更换未过期的证书。
2. 若域名与证书的Common Name不一致，那么会报类似`java.security.cert.CertificateException: No name matching xxx found`的错。你可以要求目标换用合法证书或修改域名，调不了域名的话也可以在本地修改hosts。
3. 操作系统时间要正确，不管用北京、南京、东京还是西京的时间，别和地球时间差太多。

## 大文件不要打到WAR包中
如果网站提供了软件、视频等体积较大文件的下载，尽量不要把它们打到应用的WAR包中。部署大文件容易导致超时（`Timed out while activating`），而且如果WAR包解压之后体积太大的话，WebLogic部署会失败。

建议将此类额外下载文件放到专门的文件服务器中。

# 部署阶段
## 操作系统时间
用date命令检查一下系统时间是否正确，不对的话要调成正确时间。

## 主机名与hosts
给服务器设置一个固定IP和固定的主机名，然后将服务器的IP与主机名加入到`/etc/hosts`中。对于Oracle厂的产品，即便后续设置用不到主机名，设置好之后也可以避免一些不必要的麻烦。

## 避免放多套Java/WebLogic
Java也好，WebLogic也好，应用也好，要避免在同一服务器放好几份。如果换了新版本，但旧版本没改名、移走或删除，你有可能会坑了你自己：最典型的例子就是在A目录修改配置文件，怎么改都不生效，仔细看进程列表之后才发现实际启动的是B目录里的程序。

及时清理临时文件。如果处理故障时建立了一些临时配置文件，观察一段时间之后发现系统能够稳定运行，那么你需要找时间用已启用的临时配置文件把未启用的正式配置文件换掉，以免造成误导。

## 防火墙配置
默认情况下，管理控制台的端口是7001，应用是7003，节点管理器是5556，初次部署时需要注意让防火墙放行这三个端口。

为了安全，需要仔细控制防火墙的放行范围，不要让7001和5556暴露到互联网上面。

另外不要把应用部署到AdminServer上面，否则封锁7001端口之后应用就无法访问了。

## 不要给控制台配置成HTTPS
虽然HTTPS很安全，然而给控制台配置成HTTPS容易产生问题，例如更新部署时节点无响应。建议采用设置强密码与配置防火墙的方式来加固控制台。

## 进行网络策略测试
在开始部署之前，建议在应用服务器上测试一下能否访问数据库等资源。如果网络不通，那么改WebLogic设置时可能会无响应，卡了半天之后才蹦出一句`The Network adapter could not establish the connection`，白白耽误时间。

如果系统没装telnet，可以简单地测试一下能不能ping通，或者通过以下Java程序来测一下端口通不通（有些机房可能会出现IP能ping通但是端口被拦截的情况）：

```java
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;

public class IpTest {
    public static void main(String[] args){
        Socket connect = new Socket();
        try {
            String ip = "";
            int port = 0;
            int timeout = 100;

            if (args.length < 2) {
                System.out.println("用法：java IpTest <IP地址> <端口号> [超时时间]");
                return;
            } else {
                ip = args[0];
                port = Integer.parseInt(args[1]);
            }
            if (args.length > 2){
                timeout = Integer.parseInt(args[2]);
            }
            System.out.println("正在连接 " + ip + ":" + port);

            InetSocketAddress addr = new InetSocketAddress(ip, port);
            connect.connect(addr, timeout);

            if (connect.isConnected()) {
                System.out.println("连接成功");
            } else {
                System.out.println("连接失败");
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                connect.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
}
```

使用方法：

```
javac IpTest.java
java IpTest 10.15.2.9 1521
```

涉及HTTPS时建议再对HTTPS网站做个访问测试，具体程序见前文。

## 修改java.security（JDK6）
Java 6存在一个关于随机数的bug，如果不Hack，在Linux系统下面WebLogic建域和启动时会特别慢，需要卡很长时间（15分钟左右），因此建议装完Java之后立刻去修改java.security。

假设$JAVA_HOME为`/opt/jdk1.6.0_145`，也就是说JDK装在了这个地方，那么需要修改`$JAVA_HOME/jre/lib/security/java.security`文件，找到

```
securerandom.source=file:/dev/urandom
```

修改成

```
securerandom.source=file:/dev/./urandom
```

之后建域和起停之类操作就不需要再等待十多分钟了。

## 如果通过控制台启动服务器时起不来
如果WebLogic各节点已正确设置，各服务器的防火墙已经开放5556端口，NodeManager也已经启动，但是仍然无法通过控制台启动节点，提示“不兼容的状态”，而且在startNodeManager.sh的输出中出现`javax.net.ssl.SSLKeyException: [Security:090482]BAD_CERTIFICATE alert was received from ...`：

### 方法一：重新设置证书
在集群的每台服务器上面设置一下证书（如果执行第一行命令就报错的话，请把$WL_HOME换成实际安装目录）：

```bash
. $WL_HOME/server/bin/setWLSEnv.sh
cd $WL_HOME/server/lib
java utils.CertGen -keyfilepass DemoIdentityPassPhrase -certfile newcert -keyfile newkey
java utils.ImportPrivateKey -keystore DemoIdentity.jks -storepass DemoIdentityKeyStorePassPhrase -keyfile newkey.pem -keyfilepass DemoIdentityPassPhrase -certfile newcert.pem -alias demoidentity
```

### 方法二：不使用SSL
除此以外，还有一种做法是不使用SSL通信以避免出现证书问题：修改`$WL_HOME/common/nodemanager/nodemanager.properties`文件，将其中的

```
SecureListener = true
```

改成

```
SecureListener = false
```

然后重新启动NodeManager。另外在控制台上建立“计算机”时，类型就不再是“SSL”，而是“普通”（Plain）。

## 组建集群
我们并不需要每一台机器都执行一遍建域之类的操作，而且在每一台机器上都手动建域，即使域的名字相同也不一定能正确连接。

更好的做法是：保证各服务器JDK路径和WebLogic安装路径一致，在主节点上面把WebLogic的各种参数都配置好，然后将user_projects目录打包（或者干脆把整个Middleware打包），复制到其他各服务器的相应位置。

由于NodeManager配置文件不在user_projects目录中，因此前文提到的“NodeManager证书”需要在每台服务器上都配置一遍。

### 服务器监听地址不要写成0.0.0.0
服务器监听地址使用固定IP，不要填0.0.0.0。虽然0.0.0.0也是一个有效的监听地址，但是如此配置之后，AdminServer与各节点之间的通信会出现问题，例如服务器状态变成UNKNOWN，或者部署应用无响应。

## 扩大内存
默认的Xmx和MaxPermSize比较小，建议在setDomainEnv.sh中把这两个参数适当调大一些。

如果采用32位的JDK（Java6/7/8的测试命令：`java -d64 -version`，如果报错说明是32位的），那么可以设置的最大内存不会超过4GB，想继续扩大的话只能换成64位JDK。

## 增加线程数
如果预计并发数比较高，可以增加应用线程池的线程数。修改config.xml配置文件（例如`/u01/Oracle/Middleware/user_projects/base_domain/config/config.xml`）。假如应用服务器叫app_server1，那么需要找到类似以下的代码

```xml
<server>
    <name>app_server1</name>
    ...
```

修改成

```xml
<server>
    <name>app_server1</name>
    <self-tuning-thread-pool-size-min>1000</self-tuning-thread-pool-size-min>
    <self-tuning-thread-pool-size-max>1000</self-tuning-thread-pool-size-max>
    ...
```

需要注意的是，如果数值改得太大，启动时可能会出现以下错误：

```
[ERROR][thread ] Could not start thread [ACTIVE] ExecuteThread: '977' for queue: 'weblogic.kernel.Default (self-tuning)'. Resource temporarily unavailable


Attempting to allocate 8192M bytes

There is insufficient native memory for the Java
Runtime Environment to continue.

Possible reasons:
  The system is out of physical RAM or swap space
  In 32 bit mode, the process size limit was hit

Possible solutions:
  Reduce memory load on the system
  Increase physical memory or swap space
  Check if swap backing store is full
  Use 64 bit Java on a 64 bit OS
  Decrease Java heap size (-Xmx/-Xms)
  Decrease number of Java threads
  Decrease Java thread stack sizes (-Xss)
  Disable compressed references (-XXcompressedRefs=false)

java.lang.OutOfMemoryError: Resource temporarily unavailable in tsStartJavaThread (lifecycle.c:1097).
```

报错信息看起来像是内存不足，实际上不是内存不足，而是Linux系统默认情况下限制了最大线程数，需要进行修改。

如果使用CentOS 6或RHEL6，可以按照以下方法进行修改：

首先修改/etc/security/limits.conf，加入
```
* hard nofile 1048576
* soft nofile 1048576
```

然后修改/etc/security/limits.d/90-nproc.conf，加入
```
weblogic   soft    nproc     655350
```

最后修改/etc/pam.d/login，加入
```
session required /lib64/security/pam_limits.so
```

修改完成后不要马上退出shell，要开个新窗口测试各账号能否登进去。如果登不进去（例如提示`could not open session`），说明参数改得太大，需要适当往小调。

另外如果线程数改大了，内存也应当适当调大，因为每个线程都会占一些内存空间。

## 启动报错“Assertion `ia_addressID' failed”
如果提示`java: Net.c:229: Java_com_bea_wcp_sctp_Net_initIDs: Assertion 'ia_addressID' failed.`，可尝试删除`/u01/Oracle/Middleware/wlserver_10.3/sip/server/native/linux/x86_64/libsctpwrapper.so`文件。

# 运维阶段

## 应用升级
改完文件之后要在控制台的“部署”里面进行更新，否则内容不会生效。改静态文件也是。

每次更新的时候，JVM会把Class信息保存到内存的永久保留区域中，而旧的内容不会释放。如果WebLogic启动参数中的-XX:MaxPermSize比较小，那么更新几次可能就会卡死挂掉，而且应用日志会显示`java.lang.OutOfMemoryError: PermGen space`。在这种情况下，把WebLogic里面的服务器停掉然后再启动一次就好了。

建议每升两三次级就彻底重启一次受管节点，避免出现用一阵子之后莫名其妙死掉的问题。

在开始更新到更新结束，应用会出现短暂的中断，因此要注意选择合适的时间进行操作。另外在业务繁忙时进行更新，不但会影响用户，而且容易因为WebLogic繁忙而导致更新无响应或失败。

建议编写一份升级检查表，将准备工作、实施工作和收尾工作全部列入，以免因漏项导致升级出现问题。

如果更新时遭遇`Error occurred while downloading files from admin server for deployment request "xxx,xxx,xxx". Underlying error is: "null"`，那么需要去检查AdminServer.log的日志（例如`/u01/Oracle/Middleware/user_projects/base_domain/servers/AdminServer/logs/AdminServer.log`）。我碰到过两种会出现这种错误的情况，一种是文件名乱码，另一种是文件权限不正确（例如服务以weblogic用户运行，但是文件所有者是root，WebLogic访问不了）。假如权限不正确，可以`chown -R weblogic:weblogic 存放程序的目录`。

我们部分应用服务器安装了WAF并配置了防篡改，如果升级之前忘记关闭防护功能，在控制台上激活时会报错，提示无法“remove staged files”。

另外建议在系统中加入可配置参数的系统公告功能，这样在升级或者维护之前可以通知用户，使用户及时做好准备。

## 重启服务器
如果只是重启应用节点，操作就比较简单，直接在控制台上操作即可。不过，在WebLogic控制台重启服务的时候不要点完“启动”就不管了，一定要等到状态显示为“RUNNING”之后再收工。如果变成“ADMIN”，那么可能是有报错，需要去应用服务器日志检查一下。若确认不耽误事（例如`java.lang.NoClassDefFoundError: com/ctc/wstx/stax/WstxInputFactory`）那么在控制台点一下“恢复”就好了。

有时观察服务器状态，可以看到状态是“RUNNING”，然而健康状况没有内容，这说明节点可能死了，你可以试一下重启复活。

如果不慎关掉AdminServer，或者打算整个重启，那么操作会比较麻烦，大体上要按以下思路操作：

1. 在管理节点上启动AdminServer（startWebLogic.sh）。
2. 在每个节点上都启动一遍NodeManager（startNodeManager.sh）。
3. 进入管理控制台，启动各应用节点。
4. 启动完成后确认“部署”里面各应用是否启动。

## 打补丁
WebLogic打补丁速度比较慢，在打补丁过程中你需要干等，所以要多留一些操作时间。建议白天操作，晚上就可以少加班了。

安装补丁之前，必须先检查bsu.sh文件（例如`/u01/Oracle/Middleware/utils/bsu/bsu.sh`），将其中的最大内存Xmx改大些，例如-Xmx2048m。因为打补丁实在太慢，等了半天出来的却是java.lang.OutOfMemoryError的话实在太憋屈。

打补丁对业务影响不大，可以随时操作，但是打完之后需要彻底重启WebLogic才能生效。AdminServer也要重启，否则后面容易碰到莫名其妙的问题。

## 搬家/迁移
尽量不要搬家，因为WebLogic安装和建域之后会产生很多已经写好了路径的配置文件。Middleware目录中有个registry.dat，此文件记录了WebLogic的安装情况，而且已经加密，如果贸然搬家会在升级等方面遇到麻烦。确实要进行迁移的话，新服务器WebLogic路径务必与旧服务器相同，想不同就去建立软链接。

## 改密码
### WebLogic控制台密码
修改密码之前先观察系统有没有相关监控或管理软件，例如Oracle Enterprise Manager。假如WebLogic控制台密码改了，依赖控制台的监控软件的密码没改，那么你可能会把自己锁在外面。

找个方便重启的时间来修改WebLogic控制台密码。在控制台修改完成之后，你需要试探性地重启各应用服务器节点，确保各节点不会因密码错误而无法启动。

假如应用节点真的因控制台密码错误而无法启动，你需要在WebLogic“服务器”页面中找到该节点，进入详细设置，在页面上方找到“服务器启动”页面，并在里面（最下方）输入正确的用户密码。

### 数据库/数据源密码
修改数据库密码会造成应用短暂停摆。你需要找个方便关停应用系统的时间来进行操作，或者提前通知系统维护。

在正式修改数据库密码之前，你需要确认数据库账户锁定阈值，或者能够以sysdba身份（Oracle数据库）操作。无论是先改WebLogic数据源密码，还是先修改数据库密码，只要WebLogic连接池尝试以旧密码建立连接，数据库账号就有可能会立刻锁定。

## 监控
建议在服务器上面安装专门的监控软件。像我们项目组那种服务器由用户管理，应用由项目组自行运维的情况，更要有自己的监控程序，这样在出现问题时也好及时定位，以免一塌糊涂。

目前我们项目组自己写了一个监控脚本，在繁忙时期每隔10分钟、空闲时期每隔半小时把WebLogic控制台的一些常用指标记录到日志文件中（通过cron控制），[代码见此](https://github.com/infnan/scripts/blob/master/部署和运维/WebLogic-monitor.sh)。

## 莫名其妙白页（加载JSP页面时提示ClassNotFoundException）
系统运行一段时间之后，有用户反馈系统部分页面莫名其妙白页，没有任何内容，也没有错误信息。

查日志，发现报错信息类似：
```
<Jan 1, 2019 1:23:45 PM CST> <Error> <HTTP> <BEA-101249> <[ServletContext@1302345678[app:appname module:appname path:/appname spec-version:null]]: Servlet
class jsp_servlet._somepackage.__somejsppage for servlet /somepackage/somejsppage.jsp could not be loaded because the requested cl
ass was not found in the classpath /u01/Oracle/Middleware/user_projects/domains/app_domain/servers/app_server1/stage/appname/appname/WEB-INF/classes:/u01
/app/Oracle/Middleware/user_projects/domains/app_domain/servers/app_server1/stage/appname/appname/WEB-INF/lib/……（一大堆jar包的文件名）:/u01/Oracle/Middleware/user_projects/domains/app_domain/servers/app_server1/tmp/_WL_user/appname/wekfjq.
java.lang.ClassNotFoundException: jsp_servlet._somepackage.__somejsppage.>
javax.servlet.ServletException: [HTTP:101249][ServletContext@1302345678[app:appname module:appname path:/appname spec-version:null]]: Servlet class jsp_servlet._somepackage.__somejsppage for servlet /somepackage/somejsppage.jsp could not be loaded because the requested class was not found in the classpath .
java.lang.ClassNotFoundException: jsp_servlet._somepackage.__somejsppage.
        at weblogic.servlet.internal.ServletStubImpl.prepareServlet(ServletStubImpl.java:551)
        at weblogic.servlet.jsp.JspStub.prepareServlet(JspStub.java:283)
        at weblogic.servlet.jsp.JspStub.prepareServlet(JspStub.java:218)
        at weblogic.servlet.internal.ServletStubImpl.execute(ServletStubImpl.java:244)
        at weblogic.servlet.internal.TailFilter.doFilter(TailFilter.java:26)
        at weblogic.servlet.internal.FilterChainImpl.doFilter(FilterChainImpl.java:60)
        at com.xxx.xxx.xxx.XXXXXFilter.doFilter(XXXXXFilter.java:123)
        at weblogic.servlet.internal.FilterChainImpl.doFilter(FilterChainImpl.java:60)
        at weblogic.servlet.internal.RequestDispatcherImpl.invokeServlet(RequestDispatcherImpl.java:527)
        at weblogic.servlet.internal.RequestDispatcherImpl.forward(RequestDispatcherImpl.java:253)
        ......（与我们应用完全无关的堆栈）
        at weblogic.servlet.internal.FilterChainImpl.doFilter(FilterChainImpl.java:60)
        at weblogic.servlet.internal.RequestEventsFilter.doFilter(RequestEventsFilter.java:27)
        at weblogic.servlet.internal.FilterChainImpl.doFilter(FilterChainImpl.java:60)
        at weblogic.servlet.internal.WebAppServletContext$ServletInvocationAction.wrapRun(WebAppServletContext.java:3748)
        at weblogic.servlet.internal.WebAppServletContext$ServletInvocationAction.run(WebAppServletContext.java:3714)
        at weblogic.security.acl.internal.AuthenticatedSubject.doAs(AuthenticatedSubject.java:321)
        at weblogic.security.service.SecurityManager.runAs(SecurityManager.java:120)
        at weblogic.servlet.internal.WebAppServletContext.securedExecute(WebAppServletContext.java:2283)
        at weblogic.servlet.internal.WebAppServletContext.execute(WebAppServletContext.java:2182)
        at weblogic.servlet.internal.ServletRequestImpl.run(ServletRequestImpl.java:1499)
        at weblogic.work.ExecuteThread.execute(ExecuteThread.java:263)
        at weblogic.work.ExecuteThread.run(ExecuteThread.java:221)
```

因为我们的JSP页面是正常的，程序也未进行改动，最初认为是WebLogic内部错误，重启了WebLogic。重启之后，页面能够正常显示，然而过一段时间之后还是莫名其妙白页，而且本来已经变好的页面也坏掉了。重新部署应用、重新建域，甚至重装WebLogic之后仍然白页。

后来在WEB-INF目录放了一个weblogic.xml，内容如下
```xml
<?xml version="1.0" encoding="UTF-8"?>
<weblogic-web-app xmlns="http://xmlns.oracle.com/weblogic/weblogic-web-app" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://java.sun.com/xml/ns/javaee http://java.sun.com/xml/ns/javaee/ejb-jar_3_0.xsd http://xmlns.oracle.com/weblogic/weblogic-web-app http://xmlns.oracle.com/weblogic/weblogic-web-app/1.2/weblogic-web-app.xsd">
  <context-root>appname</context-root>
  <jsp-descriptor>
    <keepgenerated>false</keepgenerated>
    <precompile>true</precompile>
    <precompile-continue>true</precompile-continue>
    <page-check-seconds>-1</page-check-seconds>
    <verbose>false</verbose>
    <debug>false</debug>
  </jsp-descriptor>
  <container-descriptor>
    <servlet-reload-check-secs>-1</servlet-reload-check-secs>
  </container-descriptor>
</weblogic-web-app>
```

要求WebLogic对JSP预编译。重新部署之后，莫名其妙白页的问题解决了。
