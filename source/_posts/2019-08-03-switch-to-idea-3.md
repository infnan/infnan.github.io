---
layout: post
title: 从Eclipse切换到IDEA（三）：传统Web项目转为Gradle项目
category: 教程
tags: 
- Gradle
---
除了在IDEA手工配置项目，也可考虑将传统Web项目转为Gradle项目，以便简化项目依赖管理、实现标准化构建等，也便于后续结合Jenkins等进一步实现自动化。
<!-- more -->

# 项目目录结构
我们以下面项目为例
```
> WebProj1                      ----> Web模块1
    > src                       ----> Java源代码1
    .   > com
    .       ...
    > config                    ----> 模块配置文件1，部署时计划放到 WEB-INF/classes 目录中
    .   SpringMVC-servlet.xml
    .   ...
    > WebContent                ----> Web文件目录
        > WEB-INF
        .   > lib               ----> 所需jar包
        .       ...
        .   web.xml
        .   ...
        index.jsp
        ...

> WebProj2                      ----> Web模块2
    > src                       ----> Java源代码2
    .   > com
    .       ...
    > config                    ----> 模块配置文件2
    .   SpringMVC-servlet.xml
    .   ...
    > WebContent                ----> Web文件目录
        > WEB-INF
        .   > lib               ----> 所需jar包
        .       ...
        .   web.xml
        .   ...
        index.jsp
        ...

> CommonProj                    ----> 公共代码，另外两个Project的依赖项
    > src                       ----> Java源代码
    .   > com
    .       ...
    > commonConfig              ----> 全局配置文件
        log4j.xml
        ...
```

# 准备工作
1. 安装JDK 8：本文所用的Gradle 5.4既不支持古老的JDK 6，也不支持崭新的JDK 10。后文会解释如何保证不同版本JDK的兼容性。
2. 检查各模块是否存在循环依赖：例如WebProj1依赖CommonProj，而CommonProj反过来又依赖WebProj1。这种情况在Eclipse里面能正常打包，然而切换到Gradle之后会出错，需要通过代码重构来消除错误。
3. 统一java文件的字符编码（java就行，其他文件类型无妨）。假如一部分java代码文件是UTF-8，另一部分java代码文件用GBK，要么会出现编译错误，要么会产生乱码。
4. 团队开发时，要提前和团队其他成员打好招呼，让大家有所准备。改造工作需要调整代码结构，因此在正式切换之前需要让大家理清未提交的代码，并保证配置文件能够正确构建。

# 开始改造
## 项目文件结构调整
Maven和Gradle有很多约定俗成的要求，例如Java代码存放位置。我们需要按照这些约定来调整我们的代码结构：
* src（Java代码） → src/main/java
* test（Java代码） → test/main/java
* config（需要拷到 WEB-INF/classes 下面的配置文件） → src/main/resources
* WebContent（Web文件内容，例如jsp等） → src/main/webapp
* 增加gradle相关配置文件，后文将介绍如何编写这些文件。

调整效果如下：
```
> WebProj1                      ----> Web模块1
    > src                       
    .   > 【main】
    .   .   > 【java】          ----> Java源代码1挪到此处
    .   .   .   > com
    .   .   .       ...
    .   .   > 【resources】     ----> 模块配置文件1（原config）挪到此处
    .   .   .   SpringMVC-servlet.xml
    .   .   .   ...
    .   .   > 【webapp】        ----> Web文件目录（原WebContent）挪到此处
    .   .       > WEB-INF
    .   .       .   > lib       ----> 所需jar包
    .   .       .       ...
    .   .       .   web.xml
    .   .       index.jsp
    .   .       ...
    .   > 【test】              ----> 即使未编写测试代码，也建议保留目录结构
    .       > java
    .       > resources
    【build.gradle】            ----> 新增的构建脚本

> WebProj2                      ----> Web模块2
    > src                       
    .   > 【main】
    .   .   > 【java】          ----> Java源代码2挪到此处
    .   .   .   > com
    .   .   .       ...
    .   .   > 【resources】     ----> 模块配置文件2（原config）挪到此处
    .   .   .   SpringMVC-servlet.xml
    .   .   .   ...
    .   .   > 【webapp】        ----> Web文件目录（原WebContent）挪到此处
    .   .       > WEB-INF
    .   .       .   > lib       ----> 所需jar包
    .   .       .       ...
    .   .       .   web.xml
    .   .       index.jsp
    .   .       ...
    .   > 【test】
    .       > java
    .       > resources
    【build.gradle】            ----> 新增的构建脚本

> CommonProj                    ----> 公共代码，另外两个Project的依赖项
    > src                       
    .   > 【main】
    .   .   > 【java】          ----> Java源代码挪到此处
    .   .   .   > com
    .   .   .       ...
    .   .   > 【resources】     ----> 全局配置文件挪到此处
    .   .   .   log4j.xml
    .   .   .   ...
    .   > test
    .       > java
    .       > resources
    > lib                      ----> 为了消除编译错误，这里需要准备一份CommonProj必需的jar包
    .   ...
    【build.gradle】            ----> 新增的构建脚本

> gradle                       ----> Gradle Wrapper，后面会用命令来生成该目录及文件。
    > wrapper
        gradle-wrapper.jar
        gradle-wrapper.properties
build.gradle                   ----> 新增的构建脚本。此脚本范围为整个项目。
settings.gradle
gradle.properties
```

## 配置Gradle
1. [安装Gradle](https://www.yiibai.com/gradle/how-install-gradle-windows.html)
2. 放置Gradle Wrapper：打开终端，进入项目所在的根目录，输入`gradle wrapper`。以后其他成员只要在终端中直接输入“./gradlew”就能自动下载相同版本的Gradle。

考虑到国内网络情况，需要进行两种额外处理步骤（二选一）：
1. 将gradle-5.4-all.zip分发给团队其他成员，让大家都按照上面方法手工安装Gradle。
2. 上传到国内或公司内的服务器，例如`http://10.11.22.33:8088/gradle-5.4-all.zip`，然后修改你项目中的 gradle/wrapper/gradle-wrapper.properties 文件，将 distributionUrl 修改成该地址。后续其他成员只要执行gradlew就会自动从这个URL下载Gradle。

假如需要代理才能访问网络，可在自己电脑 ~/.gradle/gradle.properties（C:\\Users\\xxx\\.gradle\\gradle.properties）中配置网络代理。

若使用HTTP代理，地址为`http://127.0.0.1:1081`，可加入：
```
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=1081
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=1081
```

若使用SOCKS5代理，地址为`127.0.0.1:1080`，则是
```
org.gradle.jvmargs=-DsocksProxyHost=127.0.0.1 -DsocksProxyPort=1080
```

配置代理之后，个别情况下会出现`Error 403 Forbidden`报错，这种情况说明仓库屏蔽了你的代理，你只能换梯子或换国内源了。

## 编写Gradle构建脚本

### /build.gradle
build.gradle是构建脚本的核心。由于本文的案例是多模块项目，build.gradle也就分成了两层，外层是项目整体的，内层是各模块的。本小节是整体的配置。

```groovy
allprojects {
    group = 'com.yourcompany.xxx'
    version = '1.0'
}

// subprojects是各模块的统一配置
subprojects {
    apply plugin: 'java'

    // Java 版本
    sourceCompatibility = 1.8
    targetCompatibility = 1.8

    // 用Maven库管理部分依赖
    repositories {
        mavenCentral()

        // 使用阿里镜像
        maven {
            url 'http://maven.aliyun.com/nexus/content/groups/public/'
        }
        maven {
            url 'http://maven.aliyun.com/nexus/content/repositories/jcenter'
        }
    }

    // 默认编译器是javac，如果构建所用JDK与生产环境JDK版本不一致，可能会产生兼容性问题。
    // 将javac换成Eclipse编译器可避免问题。
    configurations {
        ecj
    }

    dependencies {
        ecj 'org.eclipse.jdt.core.compiler:ecj:4.6.1'
    }

    compileJava {
        options.fork = true
        options.forkOptions.with {
            executable = 'java'
            jvmArgs = ['-classpath', project.configurations.ecj.asPath, 'org.eclipse.jdt.internal.compiler.batch.Main', '-nowarn']
        }
    }
}

// 构建系统
task myproj() {
    dependsOn ':WebProj1:build', ':WebProj2:build'
}
```

如果java代码采用GBK编码，那么需要下面的调整：

```groovy
subprojects {
    // ...

    compileJava {
        // 字符编码
        options.encoding = 'GBK'
    }
}
```

### /settings.gradle
该文件用于表示项目有哪些子模块（subproject）：

```
rootProject.name = 'myproj'

include 'CommonProj'
include 'WebProj1'
include 'WebProj2'
```

### /gradle.properties
该文件用于配置Gradle本身的环境，例如JVM参数等：
```
# 内存设置
org.gradle.jvmargs=-Xmx1280m
# 允许并行
org.gradle.parallel=true
```

如果项目文件使用的字符编码是GBK，可加入（其中Xmx与字符编码无关，需要根据自己电脑情况设置）：
```
systemProp.file.encoding=GBK
org.gradle.jvmargs=-Xmx1280m -Dfile.encoding=GBK
```

### /WebProj1/build.gradle
该文件负责WebProj1模块的构建。

```groovy
plugins {
    id 'war'
}

dependencies {
    // 依赖模块：CommonProj
    implementation(project(':CommonProj')) {
        // 不要引入CommonProj的jar包，否则打包时依赖jar包会被打两遍
        // 但这样做你需要保证WebProj1和WebProj2中有必需的jar包，否则运行应用时会报错
        transitive = false
    }

    // 本地jar包
    providedCompile fileTree(dir: 'src/main/webapp/WEB-INF/lib', include: '*.jar')

    // Servlet API，部署到生产环境时实际由Tomcat等中间件提供
    providedCompile 'javax.servlet:servlet-api:2.5'
    providedCompile 'javax.servlet.jsp:jsp-api:2.1'
}
```

传统项目的jar包需要手动管理，在切换成Gradle之后，可转交Gradle管理，例如删除SpringMVC相关jar包删除，并修改build.gradle：
```groovy
dependencies {
    // ...

    implementation 'org.springframework:spring-webmvc:4.1.6.RELEASE'
}
```

WebProj2/build.gradle内容相同，不再赘述。

### /CommonProj/build.gradle
内容比较简单。实际构建时会被打成jar包并放在其他模块的WEB-INF/lib中。
```groovy
dependencies {
    implementation fileTree(dir: 'lib', include: '*.jar')

    // Servlet API
    implementation 'javax.servlet:servlet-api:2.5'
    implementation 'javax.servlet.jsp:jsp-api:2.1'
}
```

### /.gitignore
需要让版本控制软件忽略Gradle产生的中间文件：

```
.gradle

/WebProj1/build/
/WebProj2/build/
/CommonProj/build/

# 不要忽略gradle-wrapper.jar
!gradle-wrapper.jar
```

虽然gitignore只适用于Git，不过其他版本控制软件要做的事情也是相似的。

# 验证测试
打开终端，进入到项目所在目录，输入`gradle myproj`或`./gradlew myproj`。

如果构建成功，Gradle会生成一个jar包和两个WAR包，分别位于`CommonProj/build/libs`、`WebProj1/build/libs`和`WebProj2/build/libs`。其中CommonProj是jar包，并且会被加到另外两个WAR包中（WEB-INF/lib）。

接下来你需要展开两个WAR包，并与传统方式编译生成出来的内容进行比较。重点检查WEB-INF、WEB-INF/lib和WEB-INF/classes，如果二者一致，就说明打包打出来的内容是对的，否则需要根据实际情况来挪动源代码的文件。

可以确定的是，打出来的包缺少CommonProj模块中的class及配置文件，因为它们都在WEB-INF/lib/CommonProj-1.0.jar中。另外WEB-INF/classes中会缺少config目录，然而事实上也不需要这个目录（将config中的内容摊到WEB-INF/classes下面才是正确的）。如果部署测试之后未发现问题，那么可以忽略这两点差异。

项目能够正确打包，并且部署到Tomcat等中间件之后应用也能正常使用，你就可以把改动提交到版本控制系统，让同事也开始使用Gradle。

# 其他需求（待补完）
## 不要改变项目目录结构
考虑到实际生产过程中开发团队的学习成本与切换成本，可能无法要求团队全部切换到Gradle，也不能改变代码目录结构。这样的话Gradle配置文件需要进行以下额外的调整：

根目录的build.gradle：
```groovy
subprojects {
    // ...

    // 手动指定路径
    sourceSets {
        main {
            java {
                srcDirs = ['src']
            }

            resources {
                srcDirs = ['src/config']
            }
        }

        test {
            java {
                srcDirs = ['test']
            }
        }
    }

    // ...
}
```

WebProj1/build.gradle 和 WebProj2/build.gradle 需在文件中加入：
```groovy
// 手动指定Web文件路径
webAppDirName = 'WebRoot'
```

CommonProj/build.gradle不用调整，然而你仍然需要建立/CommonProj/lib目录，并把CommonProj所需的jar包放进去。

## 不要将CommonProj打成jar包
从上面的项目结构中可以看出，CommonProj中有一些公共的配置文件，将其打成jar包之后可能无法正确加载。为避免这种情况发生，可在打WAR包时将CommonProj的内容展开。

在根目录的build.gradle中进行如下调整：
```groovy
subprojects {
    // ...

    processCommonProj = { excludes = null ->
        war.from(zipTree("${project(':CommonProj').buildDir}/libs/CommonProj.jar")) {
            into 'WEB-INF/classes'

            // WEB-INF/classes/META-INF 是解压之后出现的多余的东西，需要删除
            exclude 'META-INF/**'
            if (excludes != null) {
                for (String s: excludes) {
                    exclude s
                }
            }
        }
        war.rootSpec.exclude 'CommonProj.jar'
    }
}
```

在CommonProj/build.gradle中追加：
```groovy
// 将jar包名字固定下来，以便后面处理
jar {
    archiveName = 'CommonProj.jar'
}
```

在两个WebProj的build.gradle中追加：
```groovy
war {
    processCommonProj()
}
```

## 运行（待补完）
`TODO`

## 按不同环境打包不同的配置文件（待补完）
`TODO`

# 关于IDEA
使用IDEA打开配置好的项目之后，IDEA会发现这是一个Gradle项目，并提示是否“Import”。点击屏幕右下角的“Enable Import”，并等Sync操作完成后，便可以直接在IDEA中执行Gradle任务。

# 本系列目录
* [为什么进行切换](/2018/12/12/switch-to-idea-0/)
* [切换的基本操作](/2018/12/13/switch-to-idea-1/)
* [传统Web项目在IDEA的Project Structure](/2019/01/27/switch-to-idea-2)
* **传统Web项目转为Gradle项目**
