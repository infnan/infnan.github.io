---
layout: post
title: 从Eclipse切换到IDEA（二）：传统Web项目的Project Structure
category: 教程
tags: 
- IDEA
---
本文主要介绍如何将传统Web项目（不使用Maven、Gradle等构建工具，jar包等全部手工配置）从Eclipse转换到IDEA。主要内容为传统项目的Project Structure配置。
<!-- more -->

# 关于IDEA中的Project Structure和Run Configuration
Project Structure即项目结构。配置Project Structure大体上就是在告诉IDEA以下几件事：

1. 项目用哪个JDK开发？
2. 项目由哪些模块组成？这些模块之间有什么关系？
3. 模块依赖哪些jar包？
4. 模块有哪些特征？（例如是Web项目）
5. 编译完成之后如何打包？

Project Structure配置好之后就可以进行编译。

Run Configuration则是启动配置。它在告诉IDEA编译完成之后如何运行那些代码，所以在编译时不是必需的，但运行时是必需的。

# 简单工程的Project Structure
以一个Helloworld级的SpringMVC项目为例。

```
> HelloSpringMVC
    > src                       ----> Java源代码
    .   > com
    .       > example
    .           > hello
    .               > controller
    .                   HelloController.java
    .               ...
    > config                    ----> 公共配置文件
    .   SpringMVC-servlet.xml
    .   ...
    > WebContent                ----> Web文件目录
        > components
        .   > jquery
        .   ...
        > WEB-INF
        .   > lib
        .   .   commons-logging-1.2.jar
        .   .   ...
        .   > page
        .   .   init.jsp
        .   .   ...
        .   web.xml
        ...
```

直接用IDEA打开项目所在目录（HelloSpringMVC），它会尝试将Eclipse项目转化为IDEA项目（两IDE的配置文件可以同时存在，不会相互冲突），但是自动识别的文件结构并不正确，所以我们仍然需要通过“File”下面的“Project Structure”菜单重新配置项目。

![Project Structure对话框](/img/2019-01-27-switch-to-idea-2/project-structure-0.png)

下面介绍每个页签的设置。注意，我们并不需要把每个参数都设置一遍，也不会严格按照页面选项的顺序进行操作。

## Project
这一页内容比较简单，需要设置项目名称、JDK路径、支持的Java版本以及编译输出文件路径。其中Project compiler output放在哪里都行，只是不要不小心把编译出来的垃圾提交到代码库中。

## Libraries
本页管理的是“应用使用了哪些jar包”。这里相当于把应用所需jar包“打了个捆”来管理，以便后面配置工程依赖项。

![Libraries](/img/2019-01-27-switch-to-idea-2/idea-libraries.png)

没有特殊需求的话，将装jar包的目录（WebContent/WEB-INF/lib）添加成lib即可。

## Modules
IDEA没有Workspace的概念。和Eclipse中Project差不多的东西叫“Module”。一堆Module组成了一个Project。因为两边都有Project这个词语，所以小心不要把自己绕进去。

本页的作用是指出“项目由哪些模块构成”，有点像Eclipse里头的Build Path设置。另外Sources、Dependencies两个子页面也需要关注。

### Sources
Sources子页面的作用是指出“哪些是Java代码，哪些是资源文件，哪些是垃圾”。

![1](/img/2019-01-27-switch-to-idea-2/idea-modules-1.png)

![2](/img/2019-01-27-switch-to-idea-2/eclipse-modules-1.png)

IDEA将目录分成五类（Mark as后面五个）。其中Sources表示需要正常编译的Java代码，Resources表示打包时需要附到一起的文件，而Excluded表示将目录排除。

稍微提一下上图Eclipse里面的config，根据前面提到的文件结构，它并不是Java代码，在Eclipse里标记成Source Folder纯粹是为了便于查找。

对于传统Web项目，Resources怎么标记都无所谓了，后面Artifacts配置正确就行。

### Dependencies
Dependencies子页面的作用是指出依赖关系（例如需要哪些jar包）。在依赖项管理上，IDEA和Eclipse也是既有相同之处也有不同之处。IDEA这边相当于把Eclipse的Projects、Libraries和Order and Export三个页签合并到一起了。

![1](/img/2019-01-27-switch-to-idea-2/idea-modules-2.png)

![2](/img/2019-01-27-switch-to-idea-2/eclipse-modules-2.png)

这里面应当至少包含JDK（IDEA自动添加）、源代码中专门放jar包的目录和依赖的其他工程。如果使用了Tomcat和某些类，例如javax.servlet.ServletContext，我们还需要加入Tomcat。

第一次设置时可能找不到所有依赖项，例如Library中没有Tomcat。我们可以先只配置一部分，等到后面设置Library甚至到编译运行出现编译错误时再回来继续配置依赖项。

Scope表示依赖程度：

* 默认是Compile，也就是编译和打包时都要跟着放进去。
* Runtime表示编译时不用编译，但后续运行时要跟着放在一起。
* Provided表示打包时候不用跟着打，Tomcat等Web容器会提供。
* Test表示只有测试时才参与。

## Facets
本页面表示模块“有哪些特征”（例如Web、Spring等）。正确设置“特征”之后IDEA便可识别相应的配置文件。

![1](/img/2019-01-27-switch-to-idea-2/idea-facets.png)

本项目是个简单的Web项目，其“特征”只有Web。添加特征可以从Facets或Modules两个页面进行操作。

对于Web项目，我们需要关注上面的“Web Module Deployment Descriptor”和下面的“Web Resources Directories”两个设置，前者表示web.xml所在位置，后者表示WebContent（即JSP等页面）的目录。

如果中间件有特殊设置，例如通过Tomcat的context.xml设置了数据源，那么可以点击“Add Application Server specific descriptor”按钮添加自定义配置文件，这样启动Tomcat时会加载你配置的context.xml的内容。

## Artifacts
本页面表示“编译完成之后如何打包”。

Eclipse中，类似功能是“Deployment Assembly”：

![1](/img/2019-01-27-switch-to-idea-2/eclipse-artifacts.png)

回到IDEA。点加号可以看到多种打包方法。对于这个Web项目而言，建议选择“Web Application: Exploded”（散装，不打成war包）或“Web Application: Archive”（打成war包）。下面选择了散装：

![1](/img/2019-01-27-switch-to-idea-2/idea-artifacts.png)

上图是已经配置好的结构。其中：

* 'HelloSpringMVC' compile output表示编译好的class文件。
* lib表示项目所依赖的jar包。
* 'HelloSpringMVC' module: 'Web' facet resources表示JSP等文件。需要在前面把Facets配置好才会出现。
* 'config' directory contents通过加号里的“Directory Content”配置，表示把某个目录里的文件直接拷过来。

生成的文件就在Output directory中。如果不考虑数据源等配置，你可以在启动之后把这个目录里的东西拷走然后直接部署。

点击加号，可以看到以下几个菜单：

![1](/img/2019-01-27-switch-to-idea-2/idea-artifacts-2.png)

这分别表示“要把哪种文件拷过来”：

* Library Files表示把jar包拷过来，前提是Libraries页面已经正确配置。
* Module Output表示把编译好的class文件拷过来，前提是Modules页面已经正确配置。
* Module Sources表示把源代码拷过来。
* File、Directory Content分别表示把单个文件和整个目录的文件拷过来。
* Extracted Directory表示把压缩包（例如zip、jar）内容解压之后拷过来。
* JavaEE Facet Resources表示把Web项目的JSP等文件拷过来。

如不熟悉配置，建议参照Eclipse的Deployment Assembly配置，并对比两个IDE生成出来的文件的结构。另外建议仔细检查和测试WEB-INF下面的配置，以免遗漏文件或者文件不更新（即第一次启动时复制过来了，后续这些文件即使修改过也未同步）。

截至这里，Project Structure就大体上配置好了。可以检查项目结构是否正确识别，然后准备配置Run Configuration并启动项目。

# 稍微复杂一点
以上是单模块的简单项目。下面让我们把项目结构弄复杂一点，使用两个Web项目和一个公共代码项目：

```
> WebProj1                      ----> Web项目1
    > src                       ----> Java源代码1
    .   ...
    > config                    ----> 项目配置文件1
    .   SpringMVC-servlet.xml
    .   ...
    > WebContent                ----> Web文件目录
        > WEB-INF
        .   > lib
        .       ...
        .   web.xml
        .   ...
        ...

> WebProj2                      ----> Web项目2
    > src                       ----> Java源代码2
    .   ...
    > config                    ----> 项目配置文件2
    .   SpringMVC-servlet.xml
    .   ...
    > WebContent                ----> Web文件目录
        > WEB-INF
        .   > lib
        .       ...
        .   web.xml
        .   ...
        ...

> CommonProj                    ----> 公共代码
    > src                       ----> Java源代码
    .   ...
    > commonConfig              ----> 全局配置文件
        ...
```

因为原理实际上是一样的，下面直接给出参考配置。

## Project
![1](/img/2019-01-27-switch-to-idea-2/example2-1.png)

## Libraries
![1](/img/2019-01-27-switch-to-idea-2/example2-6.png)

## Modules
一开始给出的Project可能是错误的，可以将其删除，然后重新添加。添加时点Import菜单来导入现有模块。由于WebProj1和WebProj2结构类似，下面只展示WebProj1的配置。

![1](/img/2019-01-27-switch-to-idea-2/example2-2.png)
![2](/img/2019-01-27-switch-to-idea-2/example2-3.png)
![3](/img/2019-01-27-switch-to-idea-2/example2-4.png)

如果启动时CommonProj提示缺少类，可能是CommonProj的Dependencies需要补jar包。如果WebProj缺少javax的类，那么它们两个的Dependencies需要补Tomcat。

## Facets
![1](/img/2019-01-27-switch-to-idea-2/example2-5.png)

## Artifacts
![1](/img/2019-01-27-switch-to-idea-2/example2-7.png)

由图可见，因为CommonProj不是Web项目，无法单独启动，所以它没有单独的应用。全局配置文件则以“Directory Content”添加了过来。

# Run Configuration
Project Structure配置好之后，就可以准备启动。点击IDEA界面右上角的“Add Configuration...”，或者“Run”菜单下面的“Edit Configurations”即可编辑启动设置。

启动配置界面如下。我们需要先在左侧添加Tomcat（菜单需要翻页才能找到），然后在右面进行设置。

![1](/img/2019-01-27-switch-to-idea-2/idea-run-1.png)

如果Application server中没有应用服务器，或者版本与需求不一致，需要点击右边的Configure按钮配置应用服务器路径。其他设置按提示进行设置即可。

“On frame deactivation”的行为有点类似Eclipse在保存代码时进行热部署。不过IDEA里面不需要点保存按钮，触发条件就变成了窗口失去焦点，例如在运行期间修改一段代码之后点一下Dock（Windows系统是点任务栏）或者切换到浏览器，IDEA就会自动编译和热部署。

对话框下面是项目的构建步骤。构建至少要有两步，一个是编译Java代码（Build），另一个是打包（Build artifacts）。点击对话框上面的“Deployment”即可设置部署哪些应用：

![2](/img/2019-01-27-switch-to-idea-2/idea-run-2.png)

可部署应用与Project Structure的Artifacts关联，具体设置则和Eclipse类似：

![2](/img/2019-01-27-switch-to-idea-2/eclipse-run.png)

配置好之后即可点击运行按钮，确认项目能否启动。

如果启动时候报错，提示找不到类，说明Project Structure里的Dependencies配置不完整，例如缺少某个jar包，或者项目间依赖关系配置不全，这种情况下需要回到Project Structure配置，检查并补充遗漏项。

另外，如果缺少的是“javax.servlet.ServletContext”等类，则需要在Dependencies中添加“Library”，然后在弹出的对话框中选择Tomcat（或类似中间件）。

# 提交到版本控制
当Project Structure和启动设置配置完成，验证启动也没有问题，就可以将当前项目配置文件提交到版本控制，以便团队其他成员配置，也方便大家统一编辑器设置。

## 检查系统设置
有些系统设置和具体项目有关，会随着项目文件一同保存，例如文件编码、代码风格、编译器设置等。在正式投入开发之前建议统一标准，挨个检查一下，将这些参数设置好，然后借助版本控制与大家分享。

## 提交配置文件
如果项目使用Git，直接从GitHub上面取[JetBrains.gitignore](https://github.com/github/gitignore/blob/master/Global/JetBrains.gitignore)，维护成.gitignore即可得知哪些文件应当提交。

对于SVN项目，有一种比较快捷的方式是进入IDEA的Version Control窗口，检查其中未加入版本控制的文件。IDEA会自动隐藏.idea目录中不应当列入版本控制的文件，我们只需要根据实际需要提交展示出来的文件。

# 本系列目录
* [为什么进行切换](/2018/12/12/switch-to-idea-0/)
* [切换的基本操作](/2018/12/13/switch-to-idea-1/)
* **传统Web项目在IDEA的Project Structure**
* [传统Web项目转为Gradle项目](/2019/08/03/switch-to-idea-3/)
